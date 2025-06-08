
// src/actions/carpool.ts
'use server';

import { carpoolMatching, type CarpoolMatchingInput, type CarpoolMatchingOutput } from '@/ai/flows/carpool-matching';
import { z } from 'zod';

// The CarpoolMatchingInput type is imported directly from the flow, so no need to redefine schema here.

export async function findMatchingCarpoolsAction(
  input: CarpoolMatchingInput 
): Promise<CarpoolMatchingOutput | { error: string; issues?: z.ZodIssue[] }> {
  try {
    // The AI flow itself handles input validation based on its schema.
    // If additional pre-validation or transformation is needed in the action, it can be done here.
    const result = await carpoolMatching(input); 
    if (!result) {
        return { error: "AI service did not return a valid response." };
    }
    return result;
  } catch (error) {
    console.error("Error in findMatchingCarpoolsAction:", error);
    if (error instanceof z.ZodError) {
        return { error: "AI service returned an invalid data structure or input was invalid.", issues: error.issues };
    }
    // It's good practice to check if error is an instance of Error to access message property safely
    let errorMessage = "An unexpected error occurred while finding carpools. Please try again.";
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    return { error: errorMessage };
  }
}

export async function handleDriverApproval(driverId: string, newStatus: "approved" | "rejected") {
  console.log(`Driver ${driverId} status changed to ${newStatus}`);
  // Here you would update the database with the new approval status for the driver.
  // For example:
  // await db.update('driver_approvals').set({ status: newStatus }).where('driverId', '=', driverId).execute();
  
  // For now, this is a placeholder. In a real application, you would also likely want to
  // revalidate data or use some mechanism to update the UI after this action.
  // Example: revalidatePath('/parent/approvals'); or revalidateTag('driverApprovals');
  
  // Returning a simple object for now, can be expanded to return success/error details.
  return { success: true, driverId, newStatus };
}
