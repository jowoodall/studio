
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


export default async function ParentApprovalsPage() {
  let userId = null;
  let userRole: UserRole | null = null;
  
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('session');
    
    if (token?.value) {
      const decodedToken = await admin.auth().verifyIdToken(token.value);
      userId = decodedToken.uid;
      
      if (userId) {
        const userDoc = await admin.firestore().collection('users').doc(userId).get();
        if (userDoc.exists) {
          userRole = userDoc.data()?.role as UserRole | null;
        }
      }
    }
  } catch (error) {
    console.error("Error verifying session token in server component:", error);
    // This can happen if the cookie is invalid or expired. We'll treat it as not logged in.
    userId = null;
    userRole = null;
  }
  
  if (!userId) {
    return (
        <div className="min-h-screen w-full overflow-x-hidden">
            <div className="px-4 py-8">
                <Card className="text-center w-full max-w-md mx-auto">
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

  return (
    <div className="min-h-screen w-full overflow-x-hidden">
      <div className="px-4 py-8">
        <PageHeader
          title="Parental Controls"
          description="Review pending requests, manage your driver lists, and add students."
        />
        {result.success && result.data ? (
           <ParentApprovalsClient initialData={result.data} />
        ) : (
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
        )}
      </div>
    </div>
  );
}
