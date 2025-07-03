import { SES } from 'aws-sdk';

const ses = new SES();

export const handler = async (event: any) => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  const recipient = event.detail?.email;
  const productId = event.detail?.productId;
  const amount = event.detail?.amount;

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
          Data: `You have a new purchase order for product ${productId} with quantity ${amount}.`,
        },
      },
      Subject: {
        Data: 'New Purchase Order',
      },
    },
    Source: 'jhoe.h@strastan.com',
  };

  try {
    const result = await ses.sendEmail(params).promise();
    console.log(`Email sent successfully to ${recipient}. Message ID: ${result.MessageId}`);
    return { status: 'EMAIL_SENT', messageId: result.MessageId };
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
};
