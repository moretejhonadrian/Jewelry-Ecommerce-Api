import { Handler } from 'aws-lambda';
import { triggerPurchaseOrder } from '../lib/inventoryManagementServices/lowStocks/events'

export const handler: Handler = async (event) => {
    console.log(`In calling purchase order handler.`);
    const params = {
        productId: "J-2003",
        productName: 'Silver Bracelet',
        quantity: 29,
        //purchasePrice: 23
        email: 'moretejhonadrian@gmail.com'
    };

    await triggerPurchaseOrder(params); //WAIT

    console.log(`After the purchase.`);
}