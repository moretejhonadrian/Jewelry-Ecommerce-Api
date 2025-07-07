import { Handler } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';

const dynamoDb = new DynamoDB.DocumentClient();
const tableName = process.env.NOTIFICATION_TABLE!;

if (!tableName) {
  throw new Error("Missing PURCHASE_ORDER_TABLE environment variable");
}

export const handler: Handler = async (event) => {
  console.log("Approval callback event received:", JSON.stringify(event, null, 2));
    
  const { messageStatus, messageId } = event.detail;

  if (!messageId || !messageStatus) {
    throw new Error("Missing messageId or approvalStatus in event detail");
  }

  try {
    const updateParams: DynamoDB.DocumentClient.UpdateItemInput = {
      TableName: tableName,
      Key: { messageId },
      UpdateExpression: "set messageStatus = :messageStatus, responseDate = :now",
      ExpressionAttributeValues: {
        ":messageStatus": messageStatus,
        ":now": new Date().toISOString(),
      },
      ReturnValues: "UPDATED_NEW",
    };

    const result = await dynamoDb.update(updateParams).promise();

    console.log(`Message ${messageId} updated with status: ${messageStatus}`, result);

    return {
      message: `Order ${messageId} updated with status ${messageStatus}`,
      messageStatus,
    };
  } catch (error) {
    console.error("Failed to update approval status:", error);
    throw new Error("Could not update approval status in DynamoDB");
  }
};