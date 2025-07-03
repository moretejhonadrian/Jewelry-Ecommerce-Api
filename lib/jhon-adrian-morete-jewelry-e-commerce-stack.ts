import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cognito from 'aws-cdk-lib/aws-cognito';
//import * as lambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as events from 'aws-cdk-lib/aws-events';
import * as dotenv from 'dotenv';


import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';

import * as lambda from 'aws-cdk-lib/aws-lambda';
import { getExistingLogGroup } from './utils/logGroups';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as stepfunctions from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';


dotenv.config();

export class JhonAdrianMoreteJewelryECommerceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    //DynamoDB Table (CDK)
    const table = new dynamodb.Table(this, 'MyTable', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      tableName: process.env.DYNAMODB_TABLE,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For dev only!
    });

    //Cognito User Pool (CDK)
    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'jhonAdrianMoreteJewelryECommerceUserPool',
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
    });

    const userPoolDomain = userPool.addDomain('UserPoolDomain', {
      cognitoDomain: {
        domainPrefix: 'jhon-jewerly-e-commerce',
      },
    })
    
    const userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool,
      authFlows: {
        userPassword: true,
      },
      oAuth: {
        flows: {
          implicitCodeGrant: true,
        },
        scopes: [cognito.OAuthScope.EMAIL, cognito.OAuthScope.OPENID],
        callbackUrls: ['https://localhost:3000'],
        logoutUrls: ['https://localhost:3000'],
      }
    });
    //CDK lambda resources

    //CREATE request lambda
    const createProductLambda = new NodejsFunction(this, 'CreateProductRequest', {
      entry: 'lambda/createProduct.ts',
      handler: 'handler',
      environment: {
        DYNAMODB_TABLE: table.tableName,
        AES_SECRET_KEY: process.env.AES_SECRET_KEY!,
      },
    });
    table.grantWriteData(createProductLambda);

    //READ request lambda (get all)
    const getAllProductsLambda = new NodejsFunction(this, 'GetAllProductsRequest', {
      entry: 'lambda/getAllProducts.ts',
      handler: 'handler',
      environment: {
        DYNAMODB_TABLE: table.tableName,
        AES_SECRET_KEY: process.env.AES_SECRET_KEY!,
      },
    });
    table.grantReadData(getAllProductsLambda);

    //READ request lambda (get id)
    const getProductByIdLambda = new NodejsFunction(this, 'GetProductByIdRequest', {
      entry: 'lambda/getProductById.ts',
      handler: 'handler',
      environment: {
        DYNAMODB_TABLE: table.tableName,
        AES_SECRET_KEY: process.env.AES_SECRET_KEY!,
      },
    });
    table.grantReadData(getProductByIdLambda);

    //UPDATE request lambda
    const updateProductLambda = new NodejsFunction(this, 'UpdateProductRequest', {
      entry: 'lambda/updateProduct.ts',
      handler: 'handler',
      environment: {
        DYNAMODB_TABLE: table.tableName,
        AES_SECRET_KEY: process.env.AES_SECRET_KEY!,
      },
    });
    table.grantReadWriteData(updateProductLambda);

    //DELETE request 
    const deleteProductLambda = new NodejsFunction(this, 'DeleteProductRequest', {
      entry: 'lambda/deleteProduct.ts',
      handler: 'handler',
      environment: {
        DYNAMODB_TABLE: table.tableName,
        AES_SECRET_KEY: process.env.AES_SECRET_KEY!,
      },
    });
    table.grantReadWriteData(deleteProductLambda);

    //CDK Authorizer Resource
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools: [userPool],
    });

    // API Gateway (CDK) with CORS
    const api = new apigateway.RestApi(this, 'jewelECommerceApi', {
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS, // urls to be added
        allowMethods: apigateway.Cors.ALL_METHODS, // or specify methods
      },
    });

    const resource = api.root.addResource('products');

    // POST request
    resource.addMethod('POST', new apigateway.LambdaIntegration(createProductLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // READ request
    resource.addMethod('GET', new apigateway.LambdaIntegration(getAllProductsLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    //for product/{id}
    const productIdResource = resource.addResource('{id}');

    // READ request for specific id
    productIdResource.addMethod('GET', new apigateway.LambdaIntegration(getProductByIdLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // UPDATE request
    productIdResource.addMethod('PATCH', new apigateway.LambdaIntegration(updateProductLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // DELETE request
    productIdResource.addMethod('DELETE', new apigateway.LambdaIntegration(deleteProductLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    //INVENTORYYYY
    // 1. EventBus
    const eventBus = new events.EventBus(this, 'PurchaseOrderEventBus', {
      eventBusName: 'PurchaseOrderEventBus'
    });

    // 2. DynamoDB Inventory Table
    const inventoryTable = new dynamodb.Table(this, 'InventoryTable', {
      partitionKey: { name: 'productId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST
    });

    // 3. Lambda: Send email
    const emailLambda = new NodejsFunction(this, 'SendEmailLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../lambda/send-email.ts'), 
      handler: 'handler',
      environment: {
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      }
    });

    emailLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ses:SendEmail'],
      resources: ['*'],
    }));

    const approvalLambda = new lambda.Function(this, 'WaitForApprovalLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log("Approval callback simulated", event);
          return { approvalStatus: "APPROVED" };
        }
      `),
      handler: 'index.handler',
    });

    // 5. Lambda: Update inventory
    const updateInventoryLambda = new lambda.Function(this, 'UpdateInventoryLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromInline(`
        const AWS = require('aws-sdk');
        const ddb = new AWS.DynamoDB.DocumentClient();
        exports.handler = async (event) => {
          const { productId, amount } = event;
          await ddb.update({
            TableName: process.env.TABLE_NAME,
            Key: { productId },
            UpdateExpression: "ADD stock :amount SET status = :status",
            ExpressionAttributeValues: {
              ":amount": amount,
              ":status": "IN STOCK"
            }
          }).promise();
          return { updated: true };
        }
      `),
      handler: 'index.handler',
      environment: {
        TABLE_NAME: inventoryTable.tableName
      }
    });
    inventoryTable.grantWriteData(updateInventoryLambda);

    // 6. Step Function Definition
    const definition = new tasks.LambdaInvoke(this, 'Send PO Email', {
      lambdaFunction: emailLambda,
      outputPath: '$.Payload'
    })
      .next(new tasks.LambdaInvoke(this, 'Wait for Approval Callback', {
        lambdaFunction: approvalLambda,
        outputPath: '$.Payload'
      }))
      .next(new stepfunctions.Choice(this, 'Approved?')
        .when(stepfunctions.Condition.stringEquals('$.approvalStatus', 'APPROVED'),
          new tasks.LambdaInvoke(this, 'Update Inventory', {
            lambdaFunction: updateInventoryLambda
          })
        )
        .otherwise(new stepfunctions.Fail(this, 'Rejected')));

    const poStateMachine = new stepfunctions.StateMachine(this, 'CreatePurchaseOrderWorkflow', {
      definition,
      timeout: cdk.Duration.minutes(5)
    });

    // 7. EventBridge Rule to trigger Step Function
    new events.Rule(this, 'CreatePurchaseOrderRule', {
      eventBus,
      eventPattern: {
        source: ['purchase.orders'],
        detailType: ['create-purchase-order']
      },
      targets: [
        new targets.SfnStateMachine(poStateMachine)
      ]
    });
  }
}
