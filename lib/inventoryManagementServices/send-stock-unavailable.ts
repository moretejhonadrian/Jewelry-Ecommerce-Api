import { Stack } from 'aws-cdk-lib';
import { EventBus } from 'aws-cdk-lib/aws-events';
import * as dotenv from 'dotenv';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cdk from 'aws-cdk-lib';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import { Duration } from 'aws-cdk-lib';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as events from 'aws-cdk-lib/aws-events';

dotenv.config();

export function sendStockUnavailable(stack: Stack, eventBus: EventBus) {
    const lowStockNotificationTable = new dynamodb.Table(stack, ' lowStockNotificationTable', {
        partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
        tableName: process.env.LOW_STOCK_NOTIFICATION_TABLE,
        removalPolicy: cdk.RemovalPolicy.DESTROY, // For dev only!
    });

    //two lambdas;
    //  one for storing the notification
    //  two for the notification proper

    const storeNotificationLambda = new NodejsFunction(stack, 'StoreNotificationLambda', {
        runtime: lambda.Runtime.NODEJS_22_X,
        //entry: path.join(__dirname, '../../lambdas/inventoryManagementService/storeNotification.ts'),
        entry: path.join(__dirname, '../../lambda/storeNotification.ts'),
        handler: 'handler',
        environment: {
            AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
            LOW_STOCK_NOTIFICATION_TABLE: lowStockNotificationTable.tableName,
        },
    });
    lowStockNotificationTable.grantWriteData(storeNotificationLambda);

    storeNotificationLambda.addToRolePolicy(new iam.PolicyStatement({
        actions: ['*'],
        resources: ['*'],
    }));

    // Step Function Definition
    const storeNotificationDefinition = new tasks.LambdaInvoke(stack, 'Store Notification', {
        lambdaFunction: storeNotificationLambda,
        resultPath: '$.storeResult',
    })
    /*.next(new tasks.LambdaInvoke(stack, 'Approval Request Logged', {
    lambdaFunction: approvalLambda,
    resultPath: '$.approvalResult',
    }));*/

    const notificationStateMachine = new sfn.StateMachine(stack, 'lowStocksNotificationWorkflow', {
        definitionBody: sfn.DefinitionBody.fromChainable(storeNotificationDefinition),
        timeout: Duration.minutes(5),
    });
    
    // EventBridge rule to start Step Function
    new events.Rule(stack, 'StoreNotificationRule', {
        eventBus,
        eventPattern: {
            source: ['storeLowStocks.jewels'],
            detailType: ['store-low-stocks-notifications'],
        },
        targets: [
            new targets.SfnStateMachine(notificationStateMachine),
        ],
    });
}
/*
[WARNING] aws-cdk-lib.aws_stepfunctions.StateMachineProps#definition is deprecated.
  use definitionBody: DefinitionBody.fromChainable()
  This API will be removed in the next major release.
[WARNING] aws-cdk-lib.aws_stepfunctions.StateMachineProps#definition is deprecated.
  use definitionBody: DefinitionBody.fromChainable()
  This API will be removed in the next major release.
*/