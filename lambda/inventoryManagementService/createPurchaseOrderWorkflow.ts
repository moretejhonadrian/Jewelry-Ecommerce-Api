
export const handler = async (event: any) => {
    console.log("Received event:", JSON.stringify(event));
    return {
        statusCode: 200,
        body: JSON.stringify({ message: "Reserve stock workflow started" }),
    };
};
