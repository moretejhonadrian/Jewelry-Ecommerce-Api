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
  const productIds: string[] = event.detail?.productIds || event.detail?.approvedProductIds;
  const productNames: string[] = event.detail?.productNames || [];
  const quantities: number[] = event.detail?.quantities || [];
  const purchasePrices: number[] = event.detail?.purchasePrices || [];
  const approvalStatus = event.approvalStatus ?? event.detail?.approvalStatus;

  const now = new Date().toISOString();

  if (!orderId || !approvalStatus) {
    throw new Error("Missing 'orderId' or 'approvalStatus'.");
  }

  //  Check if the order exists first
  const existingOrder = await dynamoDb.get({
    TableName: ordersTable,
    Key: { orderId },
  }).promise();

  if (!existingOrder.Item) {
    console.warn(`Order ${orderId} not found. Skipping inventory update.`);
    return {
      status: 'SKIPPED',
      message: `Order ${orderId} not found. No action taken.`,
    };
  }

  //  Validate array shapes
  if (
    !Array.isArray(productIds) ||
    !Array.isArray(productNames) ||
    !Array.isArray(quantities) ||
    !Array.isArray(purchasePrices) ||
    productIds.length !== productNames.length ||
    productNames.length !== quantities.length ||
    quantities.length !== purchasePrices.length
  ) {
    throw new Error("Invalid or mismatched productIds, productNames, quantities, and purchasePrices arrays.");
  }

  //  Skip if not approved
  if (approvalStatus !== 'APPROVED') {
    console.log(`Order ${orderId} was not approved. Skipping inventory update.`);

    await dynamoDb.update({
      TableName: ordersTable,
      Key: { orderId },
      UpdateExpression: 'SET inventoryUpdated = :updated, responseDate = :now',
      ExpressionAttributeValues: {
        ':updated': false,
        ':now': now,
      },
    }).promise();

    return {
      status: 'SKIPPED',
      message: `Inventory update skipped for denied order ${orderId}`,
    };
  }

  //  Proceed with inventory update
  try {
    const updates = productIds.map((productId, i) => {
      const quantity = quantities[i];
      const purchasePrice = purchasePrices[i];
      const productName = productNames[i];

      console.log(`Updating product ${productId} with quantity ${quantity} and price ${purchasePrice}`);

      return dynamoDb.update({
        TableName: inventoryTable,
        Key: { productId },
        UpdateExpression: 'SET stock = if_not_exists(stock, :zero) + :amount, lastUpdated = :now, purchasePrice = :purchasePrice, productName = if_not_exists(productName, :productName)',
        ExpressionAttributeValues: {
          ':amount': quantity,
          ':zero': 0,
          ':now': now,
          ':purchasePrice': purchasePrice,
          ':productName' : productName,
        },
        ReturnValues: 'UPDATED_NEW',
      }).promise();
    });

    const inventoryResults = await Promise.all(updates);

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
      updatedItems: inventoryResults.map((res, i) => ({
        productId: productIds[i],
        newStock: res.Attributes?.stock,
      })),
    };
  } catch (error) {
    console.error("Failed to update inventory:", error);
    throw error;
  }
};
