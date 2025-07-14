
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
          if (profileData.familyIds && profileData.familyIds.length > 0) {
            const familiesQuery = query(collection(db, "families"), where("__name__", "in", profileData.familyIds));
            const familiesSnapshot = await getDocs(familiesQuery);
            const tierOrder = { [SubscriptionTier.FREE]: 0, [SubscriptionTier.PREMIUM]: 1, [SubscriptionTier.ORGANIZATION]: 2 };

            familiesSnapshot.forEach(familyDoc => {
              const familyData = familyDoc.data() as FamilyData;
              if (tierOrder[familyData.subscriptionTier] > tierOrder[highestTier]) {
                highestTier = familyData.subscriptionTier;
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
      setLoading(true);
      setUser(firebaseUser);
      await fetchUserProfile(firebaseUser);
      setLoading(false);
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
