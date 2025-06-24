import { DynamoDB } from 'aws-sdk';

const dynamoDb = new DynamoDB.DocumentClient();
const table = process.env.DYNAMODB_TABLE!;

export const deleteProduct = async (event: any) => {
    const id = event.pathParameters?.id;

    if (!id) {
        return {
            statusCode: 400,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': '*',
            },
            body: JSON.stringify({ message: 'Missing ID for deletion' }),
        };
    }

    const params = {
        TableName: table,
        Key: { id },
    };

    const exist = await dynamoDb.get(params).promise();

    if (!exist.Item) {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': '*',
            },
            body: JSON.stringify({ message: `Item with id ${id} don't exist or already deleted.` }, null, 2),
        };
    }

    await dynamoDb.delete(params).promise();

    return {
        statusCode: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': '*',
        },
        body: JSON.stringify({ message: `Item with id ${id} deleted` }, null, 2),
    };
}