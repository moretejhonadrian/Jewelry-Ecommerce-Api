import { DynamoDB } from 'aws-sdk';

const dynamoDb = new DynamoDB.DocumentClient();
const tableName = process.env.INVENTORY_TABLE!;

if (!tableName) {
  throw new Error("Missing INVENTORY_TABLE environment variable");
}

export const handler = async (event: any) => {
  console.log("UpdateInventory Lambda received event:", JSON.stringify(event, null, 2));

  const productId = event.productId ?? event.detail?.productId;
  const amount = event.amount ?? event.detail?.amount;

  if (!productId || typeof amount !== 'number') {
    throw new Error("Missing or invalid 'productId' or 'amount' in the event");
  }

  const now = new Date().toISOString();

  const params: DynamoDB.DocumentClient.UpdateItemInput = {
    TableName: tableName,
    Key: { productId },
    UpdateExpression: 'SET stock = if_not_exists(stock, :zero) + :amount, lastUpdated = :updatedAt',
    ConditionExpression: 'stock >= :amount OR attribute_not_exists(stock)', // optional: skip check if new
    ExpressionAttributeValues: {
      ':amount': amount,
      ':zero': 0,
      ':updatedAt': now
    },
    ReturnValues: 'UPDATED_NEW'
  };

  try {
    const result = await dynamoDb.update(params).promise();
    console.log("Inventory updated:", result);
    return {
      status: 'INVENTORY_UPDATED',
      updated: result.Attributes
    };
  } catch (error) {
    console.error("Failed to update inventory:", error);
    throw error;
  }
};
