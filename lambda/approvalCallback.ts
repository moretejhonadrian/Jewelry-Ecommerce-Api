import { Handler } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';

const dynamoDb = new DynamoDB.DocumentClient();
const tableName = process.env.PURCHASE_ORDER_TABLE!;

if (!tableName) {
  throw new Error("Missing PURCHASE_ORDER_TABLE environment variable");
}

export const handler: Handler = async (event) => {
  console.log("Approval callback event received:", JSON.stringify(event, null, 2));

  const { approvalStatus, approvedProductId, quantity, orderId } = event.detail;

  if (!orderId || !approvalStatus) {
    throw new Error("Missing orderId or approvalStatus in event detail");
  }

  try {
    const updateParams: DynamoDB.DocumentClient.UpdateItemInput = {
      TableName: tableName,
      Key: { orderId },
      UpdateExpression: "set #s = :status, responseDate = :now",
      ExpressionAttributeNames: {
        "#s": "status", // 'status' is a reserved word in DynamoDB, so we alias it
      },
      ExpressionAttributeValues: {
        ":status": approvalStatus,
        ":now": new Date().toISOString(),
      },
      ReturnValues: "UPDATED_NEW",
    };

    const result = await dynamoDb.update(updateParams).promise();

    console.log(`Order ${orderId} updated with status: ${approvalStatus}`, result);

    return {
      message: `Order ${orderId} updated with status ${approvalStatus}`,
    };
  } catch (error) {
    console.error("Failed to update approval status:", error);
    throw new Error("Could not update approval status in DynamoDB");
  }
};