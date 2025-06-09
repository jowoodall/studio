
'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Loader2 } from 'lucide-react';
// import { UserRole } from '@/types'; // Import if you plan to manage roles here

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  // role: UserRole | null; // Placeholder for role management
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  // const [role, setRole] = useState<UserRole | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        // Example: Fetch custom claims for role (requires backend setup)
        // try {
        //   const idTokenResult = await firebaseUser.getIdTokenResult(true); // Force refresh
        //   const userRole = idTokenResult.claims.role as UserRole || UserRole.STUDENT;
        //   setRole(userRole);
        // } catch (error) {
        //   console.error("Error fetching user role from token:", error);
        //   setRole(UserRole.STUDENT); // Default role on error
        // }
      } else {
        setUser(null);
        // setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Loading authentication...</p>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading /*, role */ }}>
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
