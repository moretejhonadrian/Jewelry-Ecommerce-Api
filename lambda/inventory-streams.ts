import { DynamoDBStreamEvent } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';
import { triggerPurchaseOrder } from '../lib/inventoryManagementServices/lowStocks/events'

const dynamoDb = new DynamoDB.DocumentClient();
const inventoryTable = process.env.INVENTORY_TABLE!;

if (!inventoryTable) {
  throw new Error("Missing INVENTORY_TABLE environment variable");
}

const LOW_STOCK_THRESHOLD = 10;

export const handler = async (event: DynamoDBStreamEvent): Promise<void> => {
  console.log("Dynamodb table is changed:", JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    if (record.eventName !== 'MODIFY') continue;

    const newImage = record.dynamodb?.NewImage;

    const productId = newImage?.productId?.S;
    const stockStr = newImage?.stock?.N;

    if (!productId || !stockStr) continue;
    
    const productName = newImage?.productName?.S!;

    const stock = parseInt(stockStr);

    if (stock < LOW_STOCK_THRESHOLD) {
      await updateStatus(productId, "LOW STOCK");
      
      console.warn(`⚠️ LOW STOCK: Product ${productId} has only ${stock} left.`);
      //call purchase event
      const params = {
        productId,
        productName,
        stock, 
      };

      await triggerPurchaseOrder(params); //WAIT
      
      console.log(`Purchase event triggered.`);

    } //if stock is zero, update the 

    if (stock == 0) {
      // Update inventory if approved
      await updateStatus(productId, "OUT OF STOCK");
    }

    //if stock is greater or equals to threshold
    if (stock > LOW_STOCK_THRESHOLD) {
      await updateStatus(productId, "IN STOCK");
    }
  }
};

async function updateStatus(productId: string, productStatus: string) {
  try {
      const inventoryResult = await dynamoDb.update({
        TableName: inventoryTable,
        Key: { productId },
        UpdateExpression: 'SET productStatus = :productStatus',
        ExpressionAttributeValues: {
          ':productStatus': productStatus,
        },
        ReturnValues: 'UPDATED_NEW',
      }).promise();

      console.log("Inventory updated:", inventoryResult);

    } catch (error) {
      console.error("Failed to update inventory:", error);
      throw error;
    }
}
