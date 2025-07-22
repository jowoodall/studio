
'use server';

import admin from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import type { UserProfileData } from '@/types';

const db = admin.firestore();

interface SaveFeedbackInput {
  userId?: string;
  feedbackText: string;
  context: {
    page?: string;
    role?: string;
  };
}

export async function saveFeedbackAction(
  input: SaveFeedbackInput
): Promise<{ success: boolean; message: string; feedbackId?: string }> {
  const { userId, feedbackText, context } = input;

  if (!feedbackText.trim()) {
    return { success: false, message: 'Feedback text cannot be empty.' };
  }

  try {
    let userEmail = 'anonymous';
    if (userId) {
      try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (userDoc.exists) {
          userEmail = (userDoc.data() as UserProfileData).email || 'unknown_user';
        }
      } catch (userError) {
        console.warn(`Could not fetch user details for feedback log: ${userError}`);
      }
    }

    const feedbackData = {
      userId: userId || null,
      userEmail: userEmail,
      feedbackText: feedbackText.trim(),
      context: {
        page: context.page || 'unknown',
        role: context.role || 'unknown',
        userAgent: 'server-action', // In a real app you might pass this from client
      },
      createdAt: FieldValue.serverTimestamp(),
      status: 'new', // e.g., new, reviewed, archived
    };

    const docRef = await db.collection('feedback').add(feedbackData);

    console.log(`[Action: saveFeedbackAction] Saved feedback ${docRef.id} from ${userEmail}.`);

    return {
      success: true,
      message: 'Feedback saved successfully.',
      feedbackId: docRef.id,
    };
  } catch (error: any) {
    console.error('[Action: saveFeedbackAction] Error saving feedback to Firestore:', error);
    return {
      success: false,
      message: `An unexpected error occurred: ${error.message}`,
    };
  }
}
