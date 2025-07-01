
'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { type UserProfileData, UserRole } from '@/types'; // Import UserProfileData and UserRole

interface AuthContextType {
  user: FirebaseUser | null;
  userProfile: UserProfileData | null; // Added userProfile
  loading: boolean; // Overall auth loading (Firebase auth state)
  isLoadingProfile: boolean; // Specific loading for Firestore profile
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true); // For Firebase auth
  const [isLoadingProfile, setIsLoadingProfile] = useState(true); // For Firestore profile fetch

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true); // Start loading for auth check
      setIsLoadingProfile(true); // Start loading for profile fetch

      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          const userDocRef = doc(db, "users", firebaseUser.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            setUserProfile(userDocSnap.data() as UserProfileData);
          } else {
            setUserProfile(null); 
            console.warn("User exists in Auth but no profile in Firestore for UID:", firebaseUser.uid);
          }
        } catch (error) {
          console.error("Error fetching user profile from Firestore:", error);
          setUserProfile(null);
        }
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false); // Done with Firebase auth check
      setIsLoadingProfile(false); // Done with profile fetch attempt
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, isLoadingProfile }}>
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
