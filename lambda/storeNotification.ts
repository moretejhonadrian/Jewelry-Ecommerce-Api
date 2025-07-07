import { Handler } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid'; 

const dynamoDb = new DynamoDB.DocumentClient();
const tableName = process.env.LOW_STOCK_NOTIFICATION_TABLE!;

if (!tableName) {
  throw new Error("Missing LOW_STOCK_NOTIFICATION_TABLE environment variable");
}

//storing the notification
export const handler: Handler = async (event: any) => {
    console.log("Received event:", JSON.stringify(event, null, 2));

    const productId = event.detail?.productId; //product with low stock
    const quantity = event.detail?.quantity; //remaining in the inventory
    const productName = event.detail?.productName;

    const params = {
        id: uuidv4(), 
        dateCreated: new Date().toISOString(),
        productId,
        productName,
        quantity
    };

    try {
        await dynamoDb.put({
            TableName: tableName,
            Item: params,
        }).promise();

        console.log("Product with low stocks:", params);

        return {
            message: 'Product successfully added for notifiaction.',
            notificationId: params.id,
        };
  } catch (error) {
        console.error("Error storing notification:", error);
        throw new Error('Failed to store notification in DynamoDB.');
  }
}