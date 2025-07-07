import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dotenv from 'dotenv';
import * as events from 'aws-cdk-lib/aws-events';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { createPurchase } from './inventoryManagementServices/create-purchase-order'
import { sendStockUnavailable } from './inventoryManagementServices/send-stock-unavailable'

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

    const InventoryEventBus = new events.EventBus(this, 'InventoryEventBus', {
      eventBusName: 'inventory-event-bus',
    });

    createPurchase(this, InventoryEventBus);
    //sendStockUnavailable(this, InventoryEventBus);
  }
}
