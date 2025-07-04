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

  const input = event.detail;

  const productIds: string[] = input?.productIds || [];
  const productNames: string[] = input?.productNames || [];
  const quantities: number[] = input?.quantities || [];
  const purchasePrices: number[] = input?.purchasePrices || [];
  const email: string = input?.email;

  if (!email) {
    throw new Error("Missing 'email' field in the input.");
  }

  if (
    !Array.isArray(productIds) ||
    !Array.isArray(productNames) ||
    !Array.isArray(quantities) ||
    !Array.isArray(purchasePrices) ||
    productIds.length !== productNames.length ||
    productNames.length !== quantities.length ||
    quantities.length !== purchasePrices.length
  ) {
    throw new Error("Mismatch or invalid format in productIds, productNames, quantities, or purchasePrices arrays.");
  }

  const orderItem = {
    orderId: uuidv4(),
    email,
    productIds,
    productNames,
    quantities,
    purchasePrices,
    status: 'PENDING',
    orderDate: new Date().toISOString(),
    responseDate: 'PENDING',
    // taskToken: event.taskToken, 
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
