
'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { type UserProfileData, type FamilyData, UserRole, SubscriptionTier } from '@/types';

interface AuthContextType {
  user: FirebaseUser | null;
  userProfile: UserProfileData | null;
  subscriptionTier: SubscriptionTier;
  loading: boolean;
  isLoadingProfile: boolean;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfileData | null>(null);
  const [subscriptionTier, setSubscriptionTier] = useState<SubscriptionTier>(SubscriptionTier.FREE);
  const [loading, setLoading] = useState(true);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  const fetchUserProfile = useCallback(async (firebaseUser: FirebaseUser | null) => {
    if (firebaseUser) {
      setIsLoadingProfile(true);
      try {
        const userDocRef = doc(db, "users", firebaseUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) { 
          const profileData = userDocSnap.data() as UserProfileData;
          setUserProfile(profileData);

          // Determine subscription tier
          let highestTier = SubscriptionTier.FREE;
          const familyIds = profileData.familyIds || [];
          
          if (familyIds.length > 0) {
            const familyPromises = familyIds.map(id => getDoc(doc(db, "families", id)));
            const familyDocs = await Promise.all(familyPromises);
            
            const tierOrder = { [SubscriptionTier.FREE]: 0, [SubscriptionTier.PREMIUM]: 1, [SubscriptionTier.ORGANIZATION]: 2 };
            
            familyDocs.forEach(familyDoc => {
              if (familyDoc.exists()) {
                const familyData = familyDoc.data() as FamilyData;
                if (tierOrder[familyData.subscriptionTier] > tierOrder[highestTier]) {
                  highestTier = familyData.subscriptionTier;
                }
              }
            });
          }
          setSubscriptionTier(highestTier);

        } else {
          setUserProfile(null);
          setSubscriptionTier(SubscriptionTier.FREE);
          console.warn("User exists in Auth but no profile in Firestore for UID:", firebaseUser.uid);
        }
      } catch (error) {
        console.error("Error fetching user profile or families from Firestore:", error);
        setUserProfile(null);
        setSubscriptionTier(SubscriptionTier.FREE);
      } finally {
        setIsLoadingProfile(false);
      }
    } else {
      setUserProfile(null);
      setSubscriptionTier(SubscriptionTier.FREE);
      setIsLoadingProfile(false);
    }
  }, []);

  const refreshUserProfile = useCallback(async () => {
    if (user) {
      await fetchUserProfile(user);
    }
  }, [user, fetchUserProfile]);


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser); // Set the user immediately
      if (firebaseUser) {
        const token = await firebaseUser.getIdToken();
        // Use SameSite=None; Secure for cross-site/iframe contexts like Firebase Studio previews.
        document.cookie = `session=${token};path=/;max-age=3600;SameSite=None;Secure`;
        await fetchUserProfile(firebaseUser); // Wait for profile to load
      } else {
        document.cookie = 'session=;path=/;max-age=0;SameSite=None;Secure';
        setUserProfile(null);
        setSubscriptionTier(SubscriptionTier.FREE);
        setIsLoadingProfile(false);
      }
      setLoading(false); // Only set loading to false after everything is done
    });
    return () => unsubscribe();
  }, [fetchUserProfile]);

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, isLoadingProfile, refreshUserProfile, subscriptionTier }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
