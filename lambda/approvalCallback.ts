import { Handler } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';

const dynamoDb = new DynamoDB.DocumentClient();
const tableName = process.env.PURCHASE_ORDER_TABLE!;

if (!tableName) {
  throw new Error("Missing PURCHASE_ORDER_TABLE environment variable");
}

export const handler: Handler = async (event) => {
  console.log("Approval callback event received:", JSON.stringify(event, null, 2));

  const {
    approvalStatus,
    productIds,
    productNames,
    quantities,
    purchasePrices,
    orderId,
  } = event.detail;

  if (!orderId || !approvalStatus) {
    throw new Error("Missing orderId or approvalStatus in event detail");
  }

  const hasArrays =
    productIds && productNames && quantities &&
    Array.isArray(productIds) &&
    Array.isArray(productNames) &&
    Array.isArray(quantities);

  if (hasArrays) {
    if (
      productIds.length !== productNames.length ||
      productNames.length !== quantities.length
    ) {
      throw new Error("Mismatch between productIds, productNames, and quantities array lengths.");
    }

    if (purchasePrices) {
      if (
        !Array.isArray(purchasePrices) ||
        purchasePrices.length !== quantities.length
      ) {
        throw new Error("purchasePrices must be an array of same length as quantities.");
      }
    }
  }

  try {
    // Step 1: Check if order exists
    const existing = await dynamoDb.get({
      TableName: tableName,
      Key: { orderId },
    }).promise();

    if (!existing.Item) {
      console.warn(`Order ${orderId} not found. Skipping update.`);
      return {
        message: `Order ${orderId} does not exist. No update performed.`,
        skipped: true,
      };
    }

    // Step 2: Build update
    const updateExpressions = [
      'set #s = :status',
      'responseDate = :now'
    ];
    const expressionAttributeValues: any = {
      ':status': approvalStatus,
      ':now': new Date().toISOString(),
    };
    const expressionAttributeNames: any = { '#s': 'status' };

    if (hasArrays) {
      updateExpressions.push(
        'productIds = :pids',
        'productNames = :pnames',
        'quantities = :qtys'
      );
      expressionAttributeValues[':pids'] = productIds;
      expressionAttributeValues[':pnames'] = productNames;
      expressionAttributeValues[':qtys'] = quantities;

      if (purchasePrices) {
        updateExpressions.push('purchasePrices = :prices');
        expressionAttributeValues[':prices'] = purchasePrices;
      }
    }

    const updateParams: DynamoDB.DocumentClient.UpdateItemInput = {
      TableName: tableName,
      Key: { orderId },
      UpdateExpression: updateExpressions.join(', '),
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: "UPDATED_NEW",
    };

    const result = await dynamoDb.update(updateParams).promise();

    console.log(`Order ${orderId} updated with status: ${approvalStatus}`, result);

    return {
      message: `Order ${orderId} updated with status ${approvalStatus}`,
      updated: true,
    };
  } catch (error) {
    console.error("Failed to update approval status:", error);
    throw new Error("Could not update approval status in DynamoDB");
  }
};
