
'use server';

import admin from '@/lib/firebaseAdmin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { NotificationData, NotificationType } from '@/types';

const db = admin.firestore();

// Internal helper function to create a notification
export async function createNotification(
  userId: string,
  title: string,
  message: string,
  type: NotificationType,
  link?: string
): Promise<{ success: boolean; message: string; notificationId?: string }> {
  if (!userId) {
    console.error('[Action: createNotification] Error: No userId provided.');
    return { success: false, message: 'User ID is required to create a notification.' };
  }
  try {
    const notification: Omit<NotificationData, 'id'> = {
      userId,
      title,
      message,
      type,
      link: link || '',
      read: false,
      createdAt: Timestamp.now(),
    };
    const docRef = await db.collection('notifications').add(notification);
    console.log(`[Action: createNotification] Successfully created notification ${docRef.id} for user ${userId}.`);
    return { success: true, message: 'Notification created.', notificationId: docRef.id };
  } catch (error: any) {
    console.error('[Action: createNotification] Error:', error);
    return { success: false, message: `Failed to create notification: ${error.message}` };
  }
}

// Action to get notifications for the current user
export async function getNotificationsAction(
  userId: string
): Promise<{ success: boolean; notifications?: NotificationData[]; message?: string }> {
  if (!userId) {
    return { success: false, message: 'User ID is required.' };
  }
  try {
    const notificationsRef = db.collection('notifications');
    const snapshot = await notificationsRef.where('userId', '==', userId).orderBy('createdAt', 'desc').limit(50).get();

    if (snapshot.empty) {
      return { success: true, notifications: [] };
    }

    // Convert Timestamp to ISO string for serialization before sending to client
    const notifications = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
      };
    });
    
    // Return as `any` to bypass TypeScript error at the server/client boundary
    return { success: true, notifications: notifications as any };
    
  } catch (error: any) {
    console.error('[Action: getNotificationsAction] Error:', error);
    if (error.code === 5 || (error.message && (error.message.toLowerCase().includes("index") || error.message.toLowerCase().includes("missing a composite index")))) {
        return { success: false, message: "A Firestore index is required to load notifications. Please check the server terminal for a link to create it." };
    }
    return { success: false, message: `Failed to fetch notifications: ${error.message}` };
  }
}

// Action to mark all notifications as read for a user
export async function markAllNotificationsAsReadAction(
  userId: string
): Promise<{ success: boolean; message: string }> {
  if (!userId) {
    return { success: false, message: 'User ID is required.' };
  }
  try {
    const notificationsRef = db.collection('notifications');
    const q = notificationsRef.where('userId', '==', userId).where('read', '==', false);
    const snapshot = await q.get();

    if (snapshot.empty) {
      return { success: true, message: 'No unread notifications to mark.' };
    }

    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, { read: true });
    });
    await batch.commit();

    return { success: true, message: `${snapshot.size} notification(s) marked as read.` };
  } catch (error: any) {
    console.error('[Action: markAllNotificationsAsReadAction] Error:', error);
    return { success: false, message: `Failed to mark notifications as read: ${error.message}` };
  }
}

// Action to mark a single notification as read
export async function markNotificationAsReadAction(
  userId: string,
  notificationId: string
): Promise<{ success: boolean; message: string }> {
  if (!userId || !notificationId) {
    return { success: false, message: 'User ID and Notification ID are required.' };
  }
  try {
    const notificationRef = db.collection('notifications').doc(notificationId);
    const notificationDoc = await notificationRef.get();

    if (!notificationDoc.exists) {
      return { success: false, message: 'Notification not found.' };
    }
    
    const notificationData = notificationDoc.data();

    // Security check: ensure the notification belongs to the user making the request
    if (notificationData?.userId !== userId) {
        return { success: false, message: 'You are not authorized to update this notification.' };
    }

    // Only update if it's currently unread to avoid unnecessary writes
    if (notificationData?.read === false) {
        await notificationRef.update({ read: true });
    }

    return { success: true, message: 'Notification marked as read.' };
  } catch (error: any) {
    console.error('[Action: markNotificationAsReadAction] Error:', error);
    return { success: false, message: `Failed to mark notification as read: ${error.message}` };
  }
}
