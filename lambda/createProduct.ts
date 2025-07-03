import { APIGatewayProxyHandler } from 'aws-lambda';
import * as AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import { encrypt } from '../utils/aes';
import { z } from 'zod';

const table = process.env.DYNAMODB_TABLE!;
const dynamoDb = new AWS.DynamoDB.DocumentClient();

const CreateProductSchema = z.object({
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


export const handler: APIGatewayProxyHandler = async (event) =>  {
  try {
    const parsed = CreateProductSchema.safeParse(JSON.parse(event.body || '{}'));

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
    const id = uuidv4();

    const params = {
      TableName: table,
      Item: {
        id,
        productName: encrypt(productName),
        price: encrypt(price.toString()),
        category: encrypt(category),
        imageUrl: encrypt(imageUrl),
        description: encrypt(description),
        features: features.map(f => encrypt(f)),
      },
    };

    await dynamoDb.put(params).promise();

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
      },
      body: JSON.stringify({
        message: 'Data saved to DynamoDB (v2)',
        id,
        productName,
        price,
        category,
        imageUrl,
        description,
        features,
      }, null, 2),
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
      },
      body: JSON.stringify({ error: 'Internal server error', details: (err as Error).message }),
    };
  }
};
