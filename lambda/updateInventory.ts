import { DynamoDB } from 'aws-sdk';

const dynamoDb = new DynamoDB.DocumentClient();
const inventoryTable = process.env.INVENTORY_TABLE!;
const ordersTable = process.env.PURCHASE_ORDER_TABLE!;

if (!inventoryTable || !ordersTable) {
  throw new Error("Missing INVENTORY_TABLE or PURCHASE_ORDER_TABLE environment variable");
}

export const handler = async (event: any) => {
  console.log("UpdateInventory Lambda received event:", JSON.stringify(event, null, 2));

  const orderId = event.detail?.orderId;
  const productId = event.detail?.productId;
  const quantity = event.detail?.quantity;
  const approvalStatus = event.detail?.approvalStatus;
  const productName = event.detail?.productName ?? "";

  if (!orderId || !productId || typeof quantity !== 'number' || !approvalStatus) {
    throw new Error("Missing or invalid 'orderId', 'productId', 'quantity', or 'approvalStatus'");
  }

  const now = new Date().toISOString();

  if (approvalStatus !== 'APPROVED') {
    console.log(`Order ${orderId} was not approved. Skipping inventory update.`);
    
    // Optionally mark the order as "denied & inventory unchanged"
    await dynamoDb.update({
      TableName: ordersTable,
      Key: { orderId },
      UpdateExpression: 'SET inventoryUpdated = :updated, responseDate = :now',
      ExpressionAttributeValues: {
        ':updated': false,
        ':now': now,
      }
    }).promise();

    return {
      status: 'SKIPPED',
      message: `Inventory update skipped for denied order ${orderId}`,
    };
  }

  // Update inventory if approved
  try {
    const inventoryResult = await dynamoDb.update({
      TableName: inventoryTable,
      Key: { productId },
      UpdateExpression: 'SET stock = if_not_exists(stock, :zero) + :quantity, lastUpdated = :now, productName = if_not_exists(productName, :productName)',
      ExpressionAttributeValues: {
        ':quantity': quantity,
        ':zero': 0,
        ':now': now,
        ':productName': productName,
      },
      ReturnValues: 'UPDATED_NEW',
    }).promise();

    console.log("Inventory updated:", inventoryResult);

    // Mark the order as updated
    await dynamoDb.update({
      TableName: ordersTable,
      Key: { orderId },
      UpdateExpression: 'SET inventoryUpdated = :updated, responseDate = :now',
      ExpressionAttributeValues: {
        ':updated': true,
        ':now': now,
      },
    }).promise();

    return {
      status: 'INVENTORY_UPDATED',
      orderId,
      productId,
      updatedStock: inventoryResult.Attributes,
    };
  } catch (error) {
    console.error("Failed to update inventory:", error);
    throw error;
  }
};