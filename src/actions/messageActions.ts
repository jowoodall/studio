
'use server';

import admin from '@/lib/firebaseAdmin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { type ActiveRyd, type UserProfileData, type ConversationListItem, type RydMessage, ActiveRydStatus } from '@/types';

const db = admin.firestore();

// Helper to get user profiles in a batch
async function getMultipleUserProfiles(userIds: string[]): Promise<Map<string, UserProfileData>> {
    if (userIds.length === 0) return new Map();
    const userRefs = userIds.map(id => db.collection('users').doc(id));
    const userDocs = await db.getAll(...userRefs);
    const profiles = new Map<string, UserProfileData>();
    userDocs.forEach(doc => {
        if (doc.exists) {
            profiles.set(doc.id, doc.data() as UserProfileData);
        }
    });
    return profiles;
}

export async function getConversationsAction(
    userId: string,
    statusType: 'active' | 'archived' = 'active'
): Promise<{ success: boolean; conversations?: ConversationListItem[]; message?: string }> {
    if (!userId) {
        return { success: false, message: "User ID is required." };
    }

    try {
        const conversationsMap = new Map<string, ActiveRyd>();

        const activeStatuses: ActiveRydStatus[] = [
            ActiveRydStatus.PLANNING,
            ActiveRydStatus.AWAITING_PASSENGERS,
            ActiveRydStatus.RYD_PLANNED,
            ActiveRydStatus.IN_PROGRESS_PICKUP,
            ActiveRydStatus.IN_PROGRESS_ROUTE,
        ];

        const archivedStatuses: ActiveRydStatus[] = [
            ActiveRydStatus.COMPLETED,
            ActiveRydStatus.CANCELLED_BY_DRIVER,
            ActiveRydStatus.CANCELLED_BY_SYSTEM,
        ];

        const statusesToQuery = statusType === 'active' ? activeStatuses : archivedStatuses;
        
        if (statusesToQuery.length === 0) {
            return { success: true, conversations: [] };
        }

        // 1. Get rydz where the user is the driver
        const drivingQuery = db.collection('activeRydz')
            .where('driverId', '==', userId)
            .where('status', 'in', statusesToQuery);
        const drivingSnap = await drivingQuery.get();
        drivingSnap.forEach(doc => conversationsMap.set(doc.id, { id: doc.id, ...doc.data() } as ActiveRyd));

        // 2. Get rydz where the user is a passenger
        const passengerQuery = db.collection('activeRydz')
            .where('passengerUids', 'array-contains', userId)
            .where('status', 'in', statusesToQuery);
        const passengerSnap = await passengerQuery.get();
        passengerSnap.forEach(doc => conversationsMap.set(doc.id, { id: doc.id, ...doc.data() } as ActiveRyd));
        
        const allRydz = Array.from(conversationsMap.values());
        
        // Collect all user IDs needed for profiles
        const userIdsToFetch = new Set<string>();
        allRydz.forEach(ryd => {
            userIdsToFetch.add(ryd.driverId);
            ryd.passengerManifest.forEach(p => userIdsToFetch.add(p.userId));
        });
        
        const profiles = await getMultipleUserProfiles(Array.from(userIdsToFetch));

        const conversationListItems: ConversationListItem[] = allRydz.map(ryd => {
            const lastMessage = ryd.messages && ryd.messages.length > 0 ? ryd.messages[ryd.messages.length - 1] : undefined;
            let otherParticipants: ConversationListItem['otherParticipants'] = [];

            if (ryd.driverId === userId) { // User is the driver
                ryd.passengerManifest.forEach(p => {
                    const profile = profiles.get(p.userId);
                    if (profile) {
                        otherParticipants.push({
                            name: profile.fullName,
                            avatarUrl: profile.avatarUrl,
                            dataAiHint: profile.dataAiHint,
                        });
                    }
                });
            } else { // User is a passenger
                const driverProfile = profiles.get(ryd.driverId);
                if (driverProfile) {
                    otherParticipants.push({
                        name: driverProfile.fullName,
                        avatarUrl: driverProfile.avatarUrl,
                        dataAiHint: driverProfile.dataAiHint,
                    });
                }
            }

            return {
                rydId: ryd.id,
                rydName: ryd.eventName || ryd.finalDestinationAddress || `Ryd ${ryd.id.substring(0, 6)}`,
                lastMessage: lastMessage ? {
                    text: lastMessage.text,
                    timestamp: lastMessage.timestamp.toDate().toISOString(), // Convert to string
                    senderName: lastMessage.senderName,
                } : undefined,
                otherParticipants,
            };
        });
        
        // Sort by last message timestamp, descending
        conversationListItems.sort((a, b) => {
            const timeA = a.lastMessage?.timestamp ? new Date(a.lastMessage.timestamp).getTime() : 0;
            const timeB = b.lastMessage?.timestamp ? new Date(b.lastMessage.timestamp).getTime() : 0;
            return timeB - timeA;
        });

        return { success: true, conversations: conversationListItems };
        
    } catch (error: any) {
        console.error("Error in getConversationsAction:", error);
        let errorMessage = `An unexpected server error occurred: ${error.message}`;
        if (error.code === 5 || (error.message && (error.message.toLowerCase().includes("index") || error.message.toLowerCase().includes("missing a composite index")))) {
            errorMessage = "A Firestore index is required to load conversations. Please check the browser's console for a link to create it.";
        }
        return { success: false, message: errorMessage };
    }
}
