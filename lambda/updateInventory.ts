import { DynamoDB } from 'aws-sdk';

const dynamoDb = new DynamoDB.DocumentClient();
const inventoryTable = process.env.INVENTORY_TABLE!;

if (!inventoryTable) {
  throw new Error("Missing INVENTORY_TABLEenvironment variable");
}

export const handler = async (event: any) => {
  console.log("UpdateInventory Lambda received event:", JSON.stringify(event, null, 2));

  const productId = event.detail?.productId;
  const quantity = event.detail?.quantity;
  const approvalStatus = event.detail?.approvalStatus;
  const productName = event.detail?.productName ?? "";

  if (!productId || typeof quantity !== 'number' || !approvalStatus) {
    throw new Error("Missing or invalid 'productId', 'quantity', or 'approvalStatus'");
  }

  const now = new Date().toISOString();

  // Update inventory if approved
  try {
    const inventoryResult = await dynamoDb.update({
      TableName: inventoryTable,
      Key: { productId },
      UpdateExpression: 'SET stock = if_not_exists(stock, :zero) + :quantity, lastUpdated = :now, productName = if_not_exists(productName, :productName), productStatus = :productStatus',
      ExpressionAttributeValues: {
        ':quantity': quantity,
        ':zero': 0,
        ':now': now,
        ':productName': productName,
        ':productStatus': 'IN STOCK'
      },
      ReturnValues: 'UPDATED_NEW',
    }).promise();

    console.log("Inventory updated:", inventoryResult);

  } catch (error) {
    console.error("Failed to update inventory:", error);
    throw error;
  }
};