import { SES } from 'aws-sdk';

const ses = new SES();

export const handler = async (event: any) => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  const recipient = event.detail?.email;
  const productId = event.detail?.productId;
  const quantity = event.detail?.quantity;
  const productName = event.detail?.productName;

  if (!recipient) {
    throw new Error("Missing 'email' field in the event payload.");
  }

  const params = {
    Destination: {
      ToAddresses: [recipient],
    },
    Message: {
      Body: {
        Text: {
          Data: `Dear Supplier,

We would like to place a new purchase order for the following item:

- Jewelry ID: ${productId}
- Jewelry Name: ${productName}
- Quantity: ${quantity}

Please confirm receipt of this order and provide an estimated delivery timeline at your earliest convenience.`,
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

  //return { status: 'EMAIL_SENT'};
};