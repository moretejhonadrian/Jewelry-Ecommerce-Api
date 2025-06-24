import { APIGatewayProxyHandler } from 'aws-lambda';
import * as AWS from 'aws-sdk';
import { decrypt } from '../utils/aes';

const table = process.env.DYNAMODB_TABLE!;
const dynamoDb = new AWS.DynamoDB.DocumentClient();

export const handler: APIGatewayProxyHandler = async (event) => {
    const id = event.pathParameters?.id;
    
    if (!id) {
        return {
            statusCode: 400,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': '*',
            },
            body: JSON.stringify({ message: 'Missing product ID' }),
        };
    }

    // fetch specific item by ID
    const params = {
        TableName: table,
        Key: { id },
    };

    const result = await dynamoDb.get(params).promise();

    if (result.Item) {
        const item = result.Item;
        
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': '*',
            },
            body: JSON.stringify({
                id: item.id,
                productName: decrypt(item.productName),
                price: parseFloat(decrypt(item.price.toString())),
                category: decrypt(item.category),
                imageUrl: decrypt(item.imageUrl), 
                description: decrypt(item.description),
                features: Array.isArray(item.features)
                    ? item.features.map((f: string) => decrypt(f))
                    : [],
            }, null, 2),
        };
    } else {
        return {
            statusCode: 404,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': '*',
            },
            body: JSON.stringify({ message: "Item not found" }, null, 2),
        };
    }
};