
// src/actions/carpool.ts
'use server';

import { carpoolMatching, type CarpoolMatchingInput, type CarpoolMatchingOutput } from '@/ai/flows/carpool-matching';
import { z } from 'zod';

// Re-define or import the schema for validation if needed on the action side too.
// For now, assuming CarpoolMatchingInput is correctly typed from the flow.

export async function findMatchingCarpoolsAction(
  input: CarpoolMatchingInput
): Promise<CarpoolMatchingOutput | { error: string; issues?: z.ZodIssue[] }> {
  // Optional: Validate input again here if necessary, though the AI flow itself has schema validation.
  // const CarpoolMatchingInputSchema = z.object({ ... }); // If you need to re-validate
  // const validationResult = CarpoolMatchingInputSchema.safeParse(input);
  // if (!validationResult.success) {
  //   return { error: "Invalid input.", issues: validationResult.error.issues };
  // }

  try {
    const result = await carpoolMatching(input);
    if (!result) {
        // This case might happen if the AI flow returns undefined or null unexpectedly.
        return { error: "AI service did not return a valid response." };
    }
    return result;
  } catch (error) {
    console.error("Error in findMatchingCarpoolsAction:", error);
    // Check if the error is a ZodError from the AI flow's output validation
    if (error instanceof z.ZodError) {
        return { error: "AI service returned an invalid data structure.", issues: error.issues };
    }
    return { error: "An unexpected error occurred while finding carpools. Please try again." };
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
