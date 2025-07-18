import React from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { ParentApprovalsClient } from '@/components/parent/ParentApprovalsClient';
import { getParentApprovalsPageData } from '@/actions/parentActions';
import { cookies } from 'next/headers';
import admin from '@/lib/firebaseAdmin';
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { UserRole } from '@/types';


async function getUserId() {
  const cookieStore = cookies();
  const token = cookieStore.get('session'); 
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
        <div className="min-h-screen w-full overflow-x-hidden">
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] px-4 py-8">
                <Card className="text-center w-full max-w-md">
                    <CardHeader>
                        <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
                        <CardTitle className="mt-4 text-lg sm:text-xl">Authentication Required</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground leading-relaxed text-sm sm:text-base">
                            You must be logged in to view this page.
                        </p>
                        <Button asChild className="mt-6 min-h-[44px] w-full sm:w-auto">
                            <Link href="/login">Log In</Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
  }
  
  const userRole = await getUserRole(userId);
  if (userRole !== UserRole.PARENT) {
      return (
        <div className="min-h-screen w-full overflow-x-hidden">
            <div className="px-4 py-8">
                <PageHeader
                    title="Access Denied"
                    description="This area is restricted to parents."
                />
                <Card className="text-center py-8 shadow-md mx-auto max-w-md">
                    <CardHeader>
                        <ShieldCheck className="mx-auto h-12 w-12 text-destructive" />
                        <CardTitle className="mt-4 font-headline text-xl sm:text-2xl">Parents Only</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <CardDescription className="leading-relaxed text-sm sm:text-base">
                            The parental controls and driver approvals page is only available for users registered as a Parent or Guardian.
                        </CardDescription>
                    </CardContent>
                </Card>
            </div>
        </div>
      )
  }

  const result = await getParentApprovalsPageData(userId);

  if (!result.success || !result.data) {
    return (
      <div className="min-h-screen w-full overflow-x-hidden">
        <div className="px-4 py-8">
            <PageHeader
                title="Parental Controls"
                description="Review pending requests, manage your driver lists, and add students."
            />
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-300px)]">
                <Card className="text-center w-full max-w-md">
                     <CardHeader>
                        <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
                        <CardTitle className="mt-4 text-lg sm:text-xl">Error Loading Page Data</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground whitespace-pre-line leading-relaxed text-sm sm:text-base break-words">
                            {result.message || "An unknown error occurred."}
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden">
        <PageHeader
          title="Parental Controls"
          description="Review pending requests, manage your driver lists, and add students."
        />
        <ParentApprovalsClient initialData={result.data} />
    </div>
  );
}
