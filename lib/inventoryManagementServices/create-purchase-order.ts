import { Stack } from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
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
import { EventBus } from 'aws-cdk-lib/aws-events';
import { DynamoEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import * as dotenv from 'dotenv';

dotenv.config();

export function createPurchase(stack: Stack, eventBus: EventBus) {
  
  const inventoryTable = new dynamodb.Table(stack, 'InventoryTable', {
    partitionKey: { name: 'productId', type: dynamodb.AttributeType.STRING },
    tableName: process.env.INVENTORY_TABLE,
    stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES, // if needed
    removalPolicy: cdk.RemovalPolicy.DESTROY, // For dev only!
  });

  const notificationTable = new dynamodb.Table(stack, ' notificationTable', {
    partitionKey: { name: 'messageId', type: dynamodb.AttributeType.STRING },
    tableName: process.env.NOTIFICATION_TABLE,
    removalPolicy: cdk.RemovalPolicy.DESTROY, // For dev only!
  });

  //store all the purchase requests waiting for approval
  const purchaseOrderTable = new dynamodb.Table(stack, 'PurchaseOrderTable', {
    partitionKey: { name: 'orderId', type: dynamodb.AttributeType.STRING },
    tableName: process.env.PURCHASE_ORDER_TABLE,
    removalPolicy: cdk.RemovalPolicy.DESTROY, // For dev only!
  });

  const purchaseOrderNotif = new NodejsFunction(stack, 'PurchaseOrderNotif', {
    runtime: lambda.Runtime.NODEJS_22_X,
    //entry: path.join(__dirname, '../../lambdas/inventoryManagementService/sendEmail.ts'),
    entry: path.join(__dirname, '../../lambda/purchaseOrderNotif.ts'),
    handler: 'handler',
    environment: {
      AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      NOTIFICATION_TABLE: notificationTable.tableName, 
    },
  });

  purchaseOrderNotif.addToRolePolicy(new iam.PolicyStatement({
    actions: ['*'],
    resources: ['*'],
  }));

  const approvalLambda = new NodejsFunction(stack, 'WaitForApprovalLambda', {
    runtime: lambda.Runtime.NODEJS_22_X,
    //entry: path.join(__dirname, '../../lambdas/inventoryManagementService/approval.ts'),
    entry: path.join(__dirname, '../../lambda/approval.ts'),
    handler: 'handler',
    environment: {
      AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      PURCHASE_ORDER_TABLE: purchaseOrderTable.tableName, 
    },
  });
  purchaseOrderTable.grantWriteData(approvalLambda);

  const approvalCallbackLambda = new NodejsFunction(stack, 'ApprovalCallbackLambda', {
    runtime: lambda.Runtime.NODEJS_22_X,
    //entry: path.join(__dirname, '../../lambdas/inventoryManagementService/approvalCallback.ts'),
    entry: path.join(__dirname, '../../lambda/approvalCallback.ts'),
    handler: 'handler',
    environment: {
      AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      NOTIFICATION_TABLE: notificationTable.tableName, 
    },
  });
  purchaseOrderTable.grantWriteData(approvalCallbackLambda);

  approvalCallbackLambda.addToRolePolicy(new iam.PolicyStatement({
    actions: ['*'],
    resources: ['*']
  }));

  const updateInventoryLambda = new NodejsFunction(stack, 'UpdateInventoryLambda', {
    runtime: lambda.Runtime.NODEJS_22_X,
    //entry: path.join(__dirname, '../../lambdas/inventoryManagementService/updateInventory.ts'),
    entry: path.join(__dirname, '../../lambda/updateInventory.ts'),
    handler: 'handler',
    environment: {
      AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      INVENTORY_TABLE: inventoryTable.tableName,
      PURCHASE_ORDER_TABLE: purchaseOrderTable.tableName, 
    },
  });
  inventoryTable.grantReadWriteData(updateInventoryLambda);
  purchaseOrderTable.grantReadWriteData(updateInventoryLambda);

  // Step Function Definition
  const createPoDefinition = new tasks.LambdaInvoke(stack, 'Send PO Email', {
    lambdaFunction: purchaseOrderNotif,
    resultPath: '$.purchaseMessageResult',
  })

  const poStateMachine = new sfn.StateMachine(stack, 'CreatePurchaseOrderWorkflow', {
    definitionBody: sfn.DefinitionBody.fromChainable(createPoDefinition),
    timeout: Duration.minutes(5),
  });

  const updateOrderDefinition = new tasks.LambdaInvoke(stack, 'Get Callback', {
    lambdaFunction: approvalCallbackLambda,
    resultPath: '$.callbackResult', // Puts callback output into $.callbackResult
  })
  .next(new tasks.LambdaInvoke(stack, 'Update Inventory', {
    lambdaFunction: updateInventoryLambda,
    resultPath: '$.updateResult',
  }));

  const updateApprovedOrder = new sfn.StateMachine(stack, 'UpdateApprovedOrder', {
    definitionBody: sfn.DefinitionBody.fromChainable(updateOrderDefinition),
    timeout: Duration.minutes(5),
  });

  // EventBridge rule to start Step Function
  new events.Rule(stack, 'CreatePurchaseOrderRule', {
    eventBus,
    eventPattern: {
      source: ['purchase.orders'],
      detailType: ['create-purchase-order'],
    },
    targets: [
      new targets.SfnStateMachine(poStateMachine),
    ],
  });

  // EventBridge rule to receive approval result and trigger approvalCallbackLambda
  new events.Rule(stack, 'ApprovalCallbackRule', {
    eventBus,
    eventPattern: {
      source: ['human.approvals'],
      detailType: ['purchase-approval'],
    },
    targets: [
      new targets.SfnStateMachine(updateApprovedOrder),
    ],
  });

  //try to invoke an event inside an event
    const callPurchaseEventLambda = new NodejsFunction(stack, 'callPurchaseEventLambda', {
      runtime: lambda.Runtime.NODEJS_22_X,
      //entry: path.join(__dirname, '../../lambdas/inventoryManagementService/sendEmail.ts'),
      entry: path.join(__dirname, '../../lambda/callPurchaseEvent.ts'),
      handler: 'handler',
      environment: {
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      },
    });

    callPurchaseEventLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['*'],
      resources: ['*']
    }));

    const callPurchaseDefinition = new tasks.LambdaInvoke(stack, 'Call Purchase Event', {
      lambdaFunction: callPurchaseEventLambda,
      resultPath: '$.callPurchaseResult',
    })

    const callPurchaseOrder = new sfn.StateMachine(stack, 'CallPurchaseOrder', {
      definitionBody: sfn.DefinitionBody.fromChainable(callPurchaseDefinition),
      timeout: Duration.minutes(5),
    });

    // EventBridge rule to start Step Function
    new events.Rule(stack, 'CallPurchaseOrderRule', {
      eventBus,
      eventPattern: {
        source: ['callpurchase.orders'],
        detailType: ['call-create-purchase-order'],
      },
      targets: [
        new targets.SfnStateMachine(callPurchaseOrder),
      ],
    });

  const inventoryStreamsLambda = new NodejsFunction(stack, 'InventoryStreamsLambda', {
      entry: 'lambda/inventory-streams.ts',
      handler: 'handler',
      environment: {
        INVENTORY_TABLE: inventoryTable.tableName,
      },
  });

  inventoryStreamsLambda.addToRolePolicy(new iam.PolicyStatement({
    actions: [
      "dynamodb:DescribeStream",
      "dynamodb:GetRecords",
      "dynamodb:GetShardIterator",
      "dynamodb:ListStreams",
      "events:PutEvents",
    ],
    resources: [inventoryTable.tableStreamArn!, "arn:aws:events:ap-southeast-1:066926217034:event-bus/inventory-event-bus"], // ! ensures it's defined
  }));

  /*inventoryStreamsLambda.addEventSource(
    new DynamoEventSource(inventoryTable, {
      startingPosition: lambda.StartingPosition.LATEST,
      batchSize: 1, // Optional: how many records per batch
      retryAttempts: 2,
    })
  );*/

  //inventoryTable.grantStreamRead(inventoryStreamsLambda);
  inventoryTable.grantReadWriteData(inventoryStreamsLambda);
}
