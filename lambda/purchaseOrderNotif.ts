import { Handler } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';

const dynamoDb = new DynamoDB.DocumentClient();
const tableName = process.env.NOTIFICATION_TABLE!;

if (!tableName) {
  throw new Error("Missing NOTIFICATION_TABLE environment variable");
}

export const handler: Handler = async (event: any) => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  const productId = event.detail?.productId;
  const stock = event.detail?.stock;
  const productName = event.detail?.productName;

  if (!productId || stock === undefined || !productName) {
    console.warn("Missing required product data in event:", event.detail);
    throw new Error("Invalid event payload — missing productId, stock, or productName");
  }

  // Check if there's an existing unread low-stock notification for the product
  const existing = await dynamoDb.query({
    TableName: tableName,
    IndexName: "productId-type-index", // You need this GSI
    KeyConditionExpression: "productId = :pid AND #type = :type",
    FilterExpression: "messageStatus <> :resolved",
    ExpressionAttributeNames: {
      "#type": "type"
    },
    ExpressionAttributeValues: {
      ":pid": productId,
      ":type": "low stock",
      ":resolved": "resolved"
    }
  }).promise();

  if (existing.Items && existing.Items.length > 0) {
    const existingItem = existing.Items[0];

    const updatedParams = {
        TableName: tableName,
        Key: { messageId: existingItem.messageId },
        UpdateExpression: "set inStock = :stock, message = :msg, updatedAt = :now",
        ExpressionAttributeValues: {
        ":stock": stock,
        ":msg": `Low Stock Alert: '${productName}' (Product ID: ${productId}) only has ${stock} left in stock. Consider purchasing more.`,
        ":now": new Date().toISOString(),
        },
        ReturnValues: "UPDATED_NEW",
    };

    await dynamoDb.update(updatedParams).promise();

    console.log(`Notification for ${productId} updated instead of creating new.`);

    return {
        message: "Existing notification updated.",
        updatedNotificationId: existingItem.messageId,
    };}

  // Create a new notification
  const message = `Low Stock Alert: '${productName}' (Product ID: ${productId}) only has ${stock} left in stock. Consider purchasing more.`;

  const params = {
    messageId: uuidv4(),
    createdAt: new Date().toISOString(),
    message,
    messageStatus: 'unread',
    productId,
    productName,
    inStock: stock,
    type: 'low stock',
    recipient: 'admin'
  };

  try {
    await dynamoDb.put({
      TableName: tableName,
      Item: params,
    }).promise();

    console.log("Message added to the table:", params);

    return {
      message: 'Notification successfully added.',
      notificationId: params.messageId,
    };
  } catch (error) {
    console.error("Error storing notification:", error);
    throw new Error('Failed to store notification in DynamoDB.');
  }
};
