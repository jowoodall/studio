
'use server';

console.log("[File: testLogActions.ts] File loaded on server."); // Top-level file load log

export async function simpleLogTestAction(message: string): Promise<{ success: boolean; response: string }> {
  console.log("----------------------------------------------------");
  console.log("[Action: simpleLogTestAction] Action called on server.");
  console.log(`[Action: simpleLogTestAction] Received message: "${message}"`);
  
  const timestamp = new Date().toISOString();
  const serverResponse = `Server received: "${message}" at ${timestamp}`;
  
  console.log(`[Action: simpleLogTestAction] Prepared response: "${serverResponse}"`);
  console.log("----------------------------------------------------");
  
  // Simulate some work or a condition
  if (message.toLowerCase().includes("error")) {
    console.error("[Action: simpleLogTestAction] Simulated error condition met.");
    return { success: false, response: "Simulated error from server based on input." };
  }
  
  return { success: true, response: serverResponse };
}
