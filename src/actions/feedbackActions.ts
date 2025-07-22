
'use server';

import admin from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import type { UserProfileData } from '@/types';

const db = admin.firestore();

interface SaveFeedbackInput {
  userId?: string;
  feedbackText: string; // Keep this for the main text
  conversationHistory: { role: 'user' | 'assistant'; content: string }[]; // Add conversation history
  context: {
    page?: string;
    role?: string;
  };
}

export async function saveFeedbackAction(
  input: SaveFeedbackInput
): Promise<{ success: boolean; message: string; feedbackId?: string }> {
  const { userId, feedbackText, conversationHistory, context } = input;

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
      conversationHistory: conversationHistory || [], // Save the array of messages
      context: {
        page: context.page || 'unknown',
        role: context.role || 'unknown',
        userAgent: 'server-action', 
      },
      createdAt: FieldValue.serverTimestamp(),
      status: 'new', 
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
