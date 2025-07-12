
'use server';
import admin from '@/lib/firebaseAdmin';

const db = admin.firestore();

// Helper function to delete all documents in a collection in batches.
async function deleteCollection(collectionPath: string, batchSize: number = 100): Promise<{ count: number }> {
  const collectionRef = db.collection(collectionPath);
  let query = collectionRef.orderBy('__name__').limit(batchSize);
  let deletedCount = 0;

  while (true) {
    const snapshot = await query.get();
    if (snapshot.size === 0) {
      break; // No more documents to delete
    }

    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    const commitResult = await batch.commit();
    deletedCount += snapshot.size;

    if (snapshot.size < batchSize) {
      break; // All documents have been deleted
    }

    const lastVisible = snapshot.docs[snapshot.docs.length - 1];
    query = collectionRef.orderBy('__name__').startAfter(lastVisible).limit(batchSize);
  }
  
  console.log(`[Action: deleteCollection] Deleted ${deletedCount} documents from ${collectionPath}`);
  return { count: deletedCount };
}


export async function purgeAllEventsAction(): Promise<{ success: boolean; message: string; }> {
  console.log('[Action: purgeAllEventsAction] Starting...');
  try {
    const { count } = await deleteCollection('events');
    const message = `Successfully purged ${count} event(s).`;
    console.log(`[Action: purgeAllEventsAction] ${message}`);
    return { success: true, message };
  } catch (error: any) {
    console.error('[Action: purgeAllEventsAction] Error:', error);
    return { success: false, message: `Failed to purge events: ${error.message}` };
  }
}

export async function purgeAllRydzAction(): Promise<{ success: boolean; message: string; }> {
    console.log('[Action: purgeAllRydzAction] Starting...');
    try {
      const { count } = await deleteCollection('rydz');
      const message = `Successfully purged ${count} ryd request(s).`;
      console.log(`[Action: purgeAllRydzAction] ${message}`);
      return { success: true, message };
    } catch (error: any) {
      console.error('[Action: purgeAllRydzAction] Error:', error);
      return { success: false, message: `Failed to purge ryd requests: ${error.message}` };
    }
}

export async function purgeAllActiveRydzAction(): Promise<{ success: boolean; message: string; }> {
    console.log('[Action: purgeAllActiveRydzAction] Starting...');
    try {
      const { count } = await deleteCollection('activeRydz');
      const message = `Successfully purged ${count} active rydz.`;
      console.log(`[Action: purgeAllActiveRydzAction] ${message}`);
      return { success: true, message };
    } catch (error: any) {
      console.error('[Action: purgeAllActiveRydzAction] Error:', error);
      return { success: false, message: `Failed to purge active rydz: ${error.message}` };
    }
}


interface ImpersonateUserInput {
  impersonatorEmail: string;
  targetEmail: string;
}

export async function impersonateUserAction(
  input: ImpersonateUserInput
): Promise<{ success: boolean; message: string; customToken?: string }> {
  const { impersonatorEmail, targetEmail } = input;
  console.log(`[Action: impersonateUserAction] Received request from ${impersonatorEmail} to impersonate ${targetEmail}.`);

  const ALLOWED_IMPERSONATOR_EMAIL = 'joey.woodall@gmail.com';

  // CRITICAL: Verify the user attempting the action is authorized.
  if (impersonatorEmail !== ALLOWED_IMPERSONATOR_EMAIL) {
    console.warn(`[Action: impersonateUserAction] Unauthorized impersonation attempt by ${impersonatorEmail}.`);
    return { success: false, message: "Unauthorized: You do not have permission to impersonate users." };
  }

  try {
    const targetUserRecord = await admin.auth().getUserByEmail(targetEmail);
    if (!targetUserRecord) {
      return { success: false, message: `Target user with email ${targetEmail} not found.` };
    }

    const targetUid = targetUserRecord.uid;
    console.log(`[Action: impersonateUserAction] Found target user UID: ${targetUid}. Generating custom token.`);
    
    // Generate a custom token for the target user.
    const customToken = await admin.auth().createCustomToken(targetUid);
    
    console.log(`[Action: impersonateUserAction] Custom token generated successfully for ${targetEmail}.`);
    return {
      success: true,
      message: `Custom token created for ${targetUserRecord.displayName || targetEmail}.`,
      customToken,
    };

  } catch (error: any) {
    console.error(`[Action: impersonateUserAction] Error:`, error);
    if (error.code === 'auth/user-not-found') {
      return { success: false, message: `User with email ${targetEmail} not found.` };
    }
    return { success: false, message: `An unexpected error occurred: ${error.message}` };
  }
}
