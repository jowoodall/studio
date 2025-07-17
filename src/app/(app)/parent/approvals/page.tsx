
import React from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { ParentApprovalsClient } from '@/components/parent/ParentApprovalsClient';
import { getParentApprovalsPageData } from '@/actions/parentActions';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { cookies } from 'next/headers';
import admin from '@/lib/firebaseAdmin';
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { UserRole } from '@/types';


async function getUserId() {
  const cookieStore = cookies();
  const token = cookieStore.get('session'); // Use the 'session' cookie
  if (!token?.value) return null;
  try {
    const decodedToken = await admin.auth().verifyIdToken(token.value);
    return decodedToken.uid;
  } catch (error) {
    console.error("Error verifying token in server component:", error);
    return null;
  }
}

async function getUserRole(userId: string) {
    if (!userId) return null;
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    if (!userDoc.exists) return null;
    return userDoc.data()?.role as UserRole | null;
}


export default async function ParentApprovalsPage() {
  const userId = await getUserId();
  
  if (!userId) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Authentication Required</h2>
            <p className="text-muted-foreground px-4">You must be logged in to view this page.</p>
            <Button asChild className="mt-4"><Link href="/login">Log In</Link></Button>
        </div>
    );
  }
  
  const userRole = await getUserRole(userId);
  if (userRole !== UserRole.PARENT) {
      return (
        <>
            <PageHeader
                title="Access Denied"
                description="This area is restricted to parents."
            />
            <Card className="text-center py-12 shadow-md">
                <CardHeader>
                    <ShieldCheck className="mx-auto h-12 w-12 text-destructive mb-4" />
                    <CardTitle className="font-headline text-2xl">Parents Only</CardTitle>
                </CardHeader>
                <CardContent>
                    <CardDescription>
                        The parental controls and driver approvals page is only available for users registered as a Parent or Guardian.
                    </CardDescription>
                </CardContent>
            </Card>
        </>
      )
  }

  const result = await getParentApprovalsPageData(userId);

  if (!result.success || !result.data) {
    return (
      <>
        <PageHeader
            title="Parental Controls"
            description="Review pending requests, manage your driver lists, and add students."
        />
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-300px)] text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Error Loading Page Data</h2>
            <p className="text-muted-foreground px-4 whitespace-pre-line">{result.message || "An unknown error occurred."}</p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Parental Controls"
        description="Review pending requests, manage your driver lists, and add students."
      />
      <ParentApprovalsClient initialData={result.data} />
    </>
  );
}

    
