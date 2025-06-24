import { APIGatewayProxyHandler } from 'aws-lambda';
import * as AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import { encrypt } from '../utils/aes';
import { z } from 'zod';

const table = process.env.DYNAMODB_TABLE!;
const dynamoDb = new AWS.DynamoDB.DocumentClient();

const CreateProductSchema = z.object({
  productName: z.string(),
  price: z.number(),
  category: z.string(),
  imageUrl: z.string(),
  description: z.string(),
  features: z.array(z.string()),
});

export const handler: APIGatewayProxyHandler = async (event) =>  {
  try {
    const parsed = CreateProductSchema.parse(JSON.parse(event.body || '{}'));
    const { productName, price, category, imageUrl, description, features } = parsed;
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
        body: JSON.stringify({ //all fields inumerated to maintain order
          message: 'Data saved to DynamoDB (v2)',
          id,
          productName,
          price,
          category,
          imageUrl,
          description,
          features,
          }, null, 2  // <-- pretty print with 2-space indentation
        ),
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
      },
      body: JSON.stringify({ error: 'Error creating product. One or more fields may be invalid.', details: (err as Error).message }),
    };
  }
}