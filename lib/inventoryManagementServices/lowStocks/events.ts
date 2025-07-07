import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";

type details = {
  productId: string,
  productName: string,
  stock: number,
}

export async function triggerPurchaseOrder(event: details) {
  try {
    const { productId, productName, stock } = event;

    const client = new EventBridgeClient({ region: "ap-southeast-1" });

    const input = {
      Entries: [
        {
          EventBusName: 'inventory-event-bus', 
          Source: 'purchase.orders',
          DetailType: 'create-purchase-order',
          Detail: JSON.stringify({
            productId,
            productName,
            stock,
          }),
        },
      ],
    };

    const command = new PutEventsCommand(input);
    const response = await client.send(command);
    
    console.log("Event sent:", response);

    return { message: response };
  } catch (err) {
    console.error("Error triggering purchase event", err);
    throw new Error('Failed to trigger purchase event.');
  }
}