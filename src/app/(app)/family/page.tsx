
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Loader2, AlertTriangle, Users, PlusCircle, UserCog } from "lucide-react";
import Link from "next/link";
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import type { FamilyData } from '@/types';
import { Badge } from '@/components/ui/badge';

export default function MyFamilyPage() {
  const { user: authUser, userProfile, loading: authLoading, isLoadingProfile } = useAuth();
  const { toast } = useToast();

  const [families, setFamilies] = useState<FamilyData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFamilies = useCallback(async () => {
    if (!userProfile) {
      if (!authLoading && !isLoadingProfile) setIsLoading(false);
      return;
    }
    
    const familyIds = userProfile.familyIds || [];
    if (familyIds.length === 0) {
      setFamilies([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      // Fetch each family document individually by its ID
      // This is more robust against security rules that check for user ID in the document
      const familyPromises = familyIds.map(async (id) => {
        const familyDocRef = doc(db, "families", id);
        const docSnap = await getDoc(familyDocRef);
        if (docSnap.exists()) {
          return { id: docSnap.id, ...docSnap.data() } as FamilyData;
        }
        console.warn(`Family with ID ${id} listed in user profile but not found in collection.`);
        return null;
      });

      const fetchedFamilies = (await Promise.all(familyPromises)).filter(Boolean) as FamilyData[];
      setFamilies(fetchedFamilies);

    } catch (e: any) {
      console.error("Error fetching families:", e);
      let detailedError = "Failed to load your families. Please try again.";
      if (e.code === 'permission-denied') {
        detailedError = "You do not have permission to view these families. Please check Firestore security rules.";
      }
      setError(detailedError);
      toast({ title: "Error Loading Families", description: detailedError, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [userProfile, toast, authLoading, isLoadingProfile]);

  useEffect(() => {
    if (!authLoading && !isLoadingProfile) {
      fetchFamilies();
    }
  }, [authLoading, isLoadingProfile, fetchFamilies]);

  const isLoadingPage = authLoading || isLoadingProfile || isLoading;

  if (isLoadingPage) {
    return (
      <>
        <PageHeader title="My Family" description="Manage your family units and subscriptions." />
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title="My Family" description="Manage your family units and subscriptions." />
        <Card className="text-center py-10 bg-destructive/10 border-destructive">
          <CardHeader>
            <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" />
            <CardTitle className="text-destructive-foreground">Error Loading Families</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-destructive-foreground/90">{error}</CardDescription>
            <Button onClick={fetchFamilies} variant="secondary" className="mt-4">Try Again</Button>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="My Family"
        description="Manage your family units, members, and subscriptions."
        actions={
          <Button asChild>
            <Link href="/family/create" passHref>
                <PlusCircle className="mr-2 h-4 w-4" /> Create New Family
            </Link>
          </Button>
        }
      />

      {families.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {families.map(family => {
            const isAdmin = family.adminIds.includes(authUser?.uid || '');
            return (
              <Card key={family.id} className="flex flex-col shadow-lg">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle>{family.name}</CardTitle>
                    <Badge variant={isAdmin ? "default" : "secondary"}>
                      {isAdmin ? "Admin" : "Member"}
                    </Badge>
                  </div>
                  <CardDescription>
                    {family.memberIds.length} member(s)
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-grow">
                  <Badge variant="outline" className="capitalize">{family.subscriptionTier} Plan</Badge>
                  {family.subscriptionEndDate && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Renews on: {family.subscriptionEndDate.toDate().toLocaleDateString()}
                    </p>
                  )}
                </CardContent>
                <CardFooter>
                   <Button className="w-full" asChild>
                     <Link href={`/family/${family.id}/manage`} passHref>
                        <UserCog className="mr-2 h-4 w-4" /> Manage Family
                     </Link>
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="text-center py-12">
          <CardHeader>
            <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <CardTitle>No Family Units Found</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              You are not yet part of any family. Create one to get started.
            </CardDescription>
            <Button asChild className="mt-4">
              <Link href="/family/create" passHref>
                <PlusCircle className="mr-2 h-4 w-4" /> Create Family
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </>
  );
}
