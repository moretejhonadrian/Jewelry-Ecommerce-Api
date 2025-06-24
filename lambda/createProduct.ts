import * as AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import { encrypt } from '../utils/aes';

const table = process.env.DYNAMODB_TABLE!;
const dynamoDb = new AWS.DynamoDB.DocumentClient();

interface CreateProductRequest {
  productName: string;
  price: number;
  category: string;
  imageUrl: string;
  description: string;
  features: string[];
}

export const createProduct = async (event: any) => {
  try {
    const body: CreateProductRequest = JSON.parse(event.body || '{}');
    const { productName, price, category, imageUrl, description, features } = body;
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
      body: JSON.stringify({ error: 'Error creating product', details: (err as Error).message }),
    };
  }
}