import * as AWS from 'aws-sdk';
import { decrypt } from '../utils/aes';

const table = process.env.DYNAMODB_TABLE!;
const dynamoDb = new AWS.DynamoDB.DocumentClient();

export const getAllProducts = async (event: any) => {
    //handle pagination
    const limit = parseInt(event.queryStringParameters?.limit || '5');
    const startKey = event.queryStringParameters?.startKey
        ? JSON.parse(Buffer.from(event.queryStringParameters.startKey, 'base64').toString('utf-8'))
        : undefined;

    const scanParams: AWS.DynamoDB.DocumentClient.ScanInput = {
        TableName: table,
        Limit: limit,
    };

    if (startKey) {
        scanParams.ExclusiveStartKey = startKey;
    }

    const data = await dynamoDb.scan(scanParams).promise();

    const items = (data.Items || []).map(item => ({
        id: item.id,
        productName: decrypt(item.productName),
        price: parseFloat(decrypt(item.price.toString())),
        category: decrypt(item.category),
        imageUrl: decrypt(item.imageUrl), 
        description: decrypt(item.description),
        features: Array.isArray(item.features)
            ? item.features.map((f: string) => decrypt(f))
            : [],
    }));

    return {
        statusCode: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': '*',
        },
        body: JSON.stringify({
            items,
            nextStartKey: data.LastEvaluatedKey
                ? Buffer.from(JSON.stringify(data.LastEvaluatedKey)).toString('base64')
                : null,
        }, null, 2),
    };
};