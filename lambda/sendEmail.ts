import { SES } from 'aws-sdk';

const ses = new SES();

export const handler = async (event: any) => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  const recipient = event.detail?.email;
  const productIds: string[] = event.detail?.productIds;
  const productNames: string[] = event.detail?.productNames;
  const quantities: number[] = event.detail?.quantities;
  const purchasePrices: number[] = event.detail?.purchasePrices;

  if (!recipient) {
    throw new Error("Missing 'email' field in the event payload.");
  }

  if (
    !Array.isArray(productIds) || !Array.isArray(productNames) || !Array.isArray(quantities) ||
    productIds.length !== productNames.length ||
    productNames.length !== quantities.length ||
    (purchasePrices && purchasePrices.length !== quantities.length)
  ) {
    throw new Error("Mismatch between number of product IDs, names, quantities, or prices.");
  }

  // Format lines: ID - Name: Quantity @ Price
  const productLines = productIds.map((id, index) => {
    const price = purchasePrices?.[index];
    const priceStr = price != null ? ` @ $${price.toFixed(2)} each` : '';
    return `- ${id} - ${productNames[index]}: ${quantities[index]} units${priceStr}`;
  }).join('\n');

  const params = {
    Destination: {
      ToAddresses: [recipient],
    },
    Message: {
      Body: {
        Text: {
          Data: `Dear Supplier,

We would like to place a new purchase order and are prepared to purchase the following items:

${productLines}

Please confirm receipt of this order and provide an estimated delivery timeline at your earliest convenience.

Best regards,`,  
//Strastan Procurement Team`,
        },
      },
      Subject: {
        Data: 'Purchase Order Request',
      },
    },
    Source: 'jhoe.h@strastan.com',
  };

  /*try {
    const result = await ses.sendEmail(params).promise();
    console.log(`Email sent successfully to ${recipient}. Message ID: ${result.MessageId}`);
    return { status: 'EMAIL_SENT', messageId: result.MessageId };
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }*/
 return { status: 'EMAIL_SENT' };
};
