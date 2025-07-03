import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';
import { encrypt, decrypt } from '../utils/aes'; 
import { z } from 'zod';

const dynamoDb = new DynamoDB.DocumentClient();
const table = process.env.DYNAMODB_TABLE!;

const productSchema = z.object({
  productName: z.string({
    required_error: "Product name is required",
    invalid_type_error: "Product name must be a string"
  }).min(1, "Product name cannot be empty"),

  price: z.number({
    required_error: "Price is required",
    invalid_type_error: "Price must be a number"
  }),

  category: z.string({
    required_error: "Category is required",
    invalid_type_error: "Category must be a string"
  }).min(1, "Category cannot be empty"),

  description: z.string({
    required_error: "Description is required",
    invalid_type_error: "Description must be a string"
  }).min(1, "Description cannot be empty"),

  imageUrl: z.string({
    required_error: "Image URL is required",
    invalid_type_error: "Image URL must be a string"
  }).url("Image URL must be a valid URL"),

  features: z.array(
    z.string({ required_error: "Each feature must be a string" }).min(1, "Feature cannot be empty"),
    {
      required_error: "Features are required",
      invalid_type_error: "Features must be an array"
    }
  ).min(1, "At least one feature is required")
});

const UpdateProductSchema = productSchema.partial();

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

        const parsed = UpdateProductSchema.safeParse(JSON.parse(event.body || '{}'));

        if (!parsed.success) {
            const messages = parsed.error.issues.map(issue => issue.message);
            return {
                statusCode: 400,
                headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': '*',
                },
                body: JSON.stringify({ error: 'Validation failed', messages }),
            };
        }
        const { productName, price, category, imageUrl, description, features } = parsed.data;

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