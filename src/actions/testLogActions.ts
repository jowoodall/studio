
'use server';

console.log("[File: testLogActions.ts] File loaded on server."); // Top-level file load log


import * as z from 'zod';
import { offerDriveFormStep1Schema, type OfferDriveFormStep1Values } from '@/schemas/activeRydSchemas';
import { db } from '@/lib/firebase';
import { doc, getDoc, Timestamp, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import type { ActiveRyd, ActiveRydStatus } from '@/types'; // Added ActiveRyd types


export async function TestEventAction() {

  console.log("start event action 2");
  try {

    const eventDocRef = doc(db, "events", "KCqRCu4uasMRkrhmijRZ");
    console.log(eventDocRef);
    const eventDocSnap = await getDoc(eventDocRef);
    console.log(eventDocSnap);
    console.log("event log created");

  } catch(error: any){

    console.log(error.message);

  }
  console.log("end event action")


}


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
