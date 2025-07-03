// lambda/approval/index.ts
import { DynamoDB } from 'aws-sdk';

const db = new DynamoDB.DocumentClient();

export const handler = async (event: any) => {
  console.log("Received task token for approval callback:", JSON.stringify(event, null, 2));

  const { token, input } = event;

  // Store the token and context somewhere — e.g., DynamoDB
  await db.put({
    TableName: process.env.APPROVAL_TABLE!,
    Item: {
      id: input.purchaseOrderId,
      taskToken: token,
      status: 'PENDING',
      email: input.email,
      timestamp: new Date().toISOString(),
    },
  }).promise();

  return { status: 'Waiting for approval' };
};
