export const handler = async (event: any) => {
  console.log("Approval Lambda received event:", JSON.stringify(event, null, 2));

  // Simulated approval logic – replace with actual logic as needed
  const approved = true; // Set to false to simulate rejection

  return {
    approvalStatus: approved ? 'APPROVED' : 'REJECTED',
    reason: approved ? 'Auto-approved for testing' : 'Auto-rejected for testing',
    originalRequest: {
      productId: event.productId,
      amount: event.amount,
      email: event.email
    }
  };
};
