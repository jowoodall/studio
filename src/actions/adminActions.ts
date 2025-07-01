
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
