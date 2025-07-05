// lambdas/inventoryManagementService/approval.ts

import { Handler } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid'; 

const dynamoDb = new DynamoDB.DocumentClient();
const tableName = process.env.PURCHASE_ORDER_TABLE!;

if (!tableName) {
  throw new Error("Missing PURCHASE_ORDER_TABLE environment variable");
}

export const handler: Handler = async (event) => {
  console.log("Approval request received:", JSON.stringify(event, null, 2));

  //const taskToken = event.taskToken;
  const input = event.detail;

  const orderItem = {
    orderId: uuidv4(), // Unique ID for the order
    email: input.email,
    amount: input.quantity,
    productId: input.productId,
    status: 'PENDING',
    orderDate: new Date().toISOString(),
    responseDate: 'PENDING',
    //taskToken, // Useful if using Step Functions for manual approval
  };

  try {
    await dynamoDb.put({
      TableName: tableName,
      Item: orderItem,
    }).promise();

    console.log("Order stored:", orderItem);

    return {
      message: 'Order successfully stored for approval.',
      orderId: orderItem.orderId,
    };
  } catch (error) {
    console.error("Error storing order:", error);
    throw new Error('Failed to store the order in DynamoDB.');
  }
};