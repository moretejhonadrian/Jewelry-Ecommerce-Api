import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';
import { encrypt, decrypt } from '../utils/aes'; 
import { z } from 'zod';

const dynamoDb = new DynamoDB.DocumentClient();
const table = process.env.DYNAMODB_TABLE!;

const UpdateProductSchema = z.object({
  productName: z.string().optional().nullable(),
  price: z.number().optional().nullable(),
  category: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  features: z.array(z.string()).optional().nullable(),
});

export const handler: APIGatewayProxyHandler = async (event) => {
    const id = event.pathParameters?.id;

    if (!id) {
        return {
            statusCode: 400,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': '*',
            },
            body: JSON.stringify({ message: 'Missing ID for update' }),
        };
    }

    try{
        const params = {
            TableName: table,
            Key: { id },
        };

        const existing = await dynamoDb.get(params).promise();

        //if no product with the given id is returned
        if (!existing.Item) {
            return {
                statusCode: 404,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': '*',
                },
                body: JSON.stringify({ message: "Item not found" }, null, 2),
            }
        }

        const parsed = UpdateProductSchema.parse(JSON.parse(event.body || '{}'));
        const { productName, price, category, imageUrl, description, features } = parsed;

        //  Merge updates
        const updatedItem = {
        id: existing.Item.id,
        productName: productName ? encrypt(productName) : existing.Item.productName,
        price: price ? encrypt(price.toString()) : existing.Item.price,
        category: category ? encrypt(category) : existing.Item.category,
        imageUrl: imageUrl ? encrypt(imageUrl) : existing.Item.imageUrl,
        description: description ? encrypt(description) : existing.Item.description,
        features: Array.isArray(features)
            ? features.map((f: string) => encrypt(f))
            : existing.Item.features,
        };

        // save updated
        await dynamoDb.put({ TableName: table, Item: updatedItem, }).promise();

        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': '*',
            },
            body: JSON.stringify({
                message: "Product updated succesfully",
                id,
                productName: decrypt(updatedItem.productName),
                price: parseFloat(decrypt(updatedItem.price)),
                category: decrypt(updatedItem.category),
                imageUrl: decrypt(updatedItem.imageUrl),
                description: decrypt(updatedItem.description),
                features: Array.isArray(updatedItem.features)
                ? updatedItem.features.map((f: string) => decrypt(f))
                : [],
            }),
        };

    } catch (err) {
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': '*',
            },
            body: JSON.stringify({ error: 'Failed to update product. One or more fields may be invalid.', details: (err as Error).message }),
        };
    }
}