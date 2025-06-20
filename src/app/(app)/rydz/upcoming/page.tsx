
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, MapPin, Car, Eye, AlertTriangle, Loader2, User, XCircle } from "lucide-react"; // Added XCircle
import Link from "next/link";
import Image from "next/image";
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, Timestamp, getDocs, doc, getDoc } from 'firebase/firestore';
import type { RydData, RydStatus, UserProfileData } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cancelRydRequestByUserAction } from '@/actions/activeRydActions'; // Import the new action

interface DisplayRydData extends RydData {
  driverProfile?: UserProfileData;
}

const upcomingStatuses: RydStatus[] = [
  'requested',
  'searching_driver',
  'driver_assigned',
  'confirmed_by_driver',
  'en_route_pickup',
  'en_route_destination',
];

export default function UpcomingRydzPage() {
  const { user: authUser, loading: authLoading, isLoadingProfile } = useAuth();
  const { toast } = useToast();

  const [upcomingRydz, setUpcomingRydz] = useState<DisplayRydData[]>([]);
  const [isLoadingRydz, setIsLoadingRydz] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCancellingRyd, setIsCancellingRyd] = useState<Record<string, boolean>>({}); // For loading state

  const fetchUpcomingRydz = useCallback(async () => {
    if (!authUser) {
      if (!authLoading && !isLoadingProfile) { 
        setIsLoadingRydz(false);
        setUpcomingRydz([]);
      }
      return;
    }

    setIsLoadingRydz(true);
    setError(null);
    try {
      const rydzQuery = query(
        collection(db, "rydz"),
        where("requestedBy", "==", authUser.uid),
        where("status", "in", upcomingStatuses),
        orderBy("rydTimestamp", "asc")
      );
      const querySnapshot = await getDocs(rydzQuery);
      const fetchedRydzPromises: Promise<DisplayRydData | null>[] = [];

      querySnapshot.forEach((docSnap) => {
        const ryd = { id: docSnap.id, ...docSnap.data() } as RydData;
        
        const promise = async (): Promise<DisplayRydData | null> => {
          let driverProfile: UserProfileData | undefined = undefined;
          if (ryd.driverId) {
            try {
              const driverDocRef = doc(db, "users", ryd.driverId);
              const driverDocSnap = await getDoc(driverDocRef);
              if (driverDocSnap.exists()) {
                driverProfile = driverDocSnap.data() as UserProfileData;
              }
            } catch (e) {
              console.warn(`Failed to fetch driver profile for ${ryd.driverId}`, e);
            }
          }
          return { ...ryd, driverProfile };
        };
        fetchedRydzPromises.push(promise());
      });
      
      const resolvedRydz = (await Promise.all(fetchedRydzPromises)).filter(Boolean) as DisplayRydData[];
      setUpcomingRydz(resolvedRydz);

    } catch (e: any) {
      console.error("Error fetching upcoming rydz:", e);
      let detailedError = "Failed to load upcoming rydz.";
       if (e.message && (e.message.toLowerCase().includes("index") || e.message.toLowerCase().includes("missing a composite index"))) {
        detailedError = "A Firestore index is required to load upcoming rydz. Please check the browser's developer console for a link to create it.";
      } else if (e.code === 'permission-denied') {
        detailedError = "Permission denied when fetching upcoming rydz. Please check Firestore security rules.";
      }
      setError(detailedError);
      toast({ title: "Error", description: detailedError, variant: "destructive", duration: 10000 });
    } finally {
      setIsLoadingRydz(false);
    }
  }, [authUser, toast, authLoading, isLoadingProfile]);

  useEffect(() => {
    if (!authLoading && !isLoadingProfile) { 
        fetchUpcomingRydz();
    }
  }, [authLoading, isLoadingProfile, fetchUpcomingRydz]);

  const handleCancelRydRequest = async (rydRequestId: string) => {
    if (!authUser) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    setIsCancellingRyd(prev => ({ ...prev, [rydRequestId]: true }));
    try {
      const result = await cancelRydRequestByUserAction({
        rydRequestId,
        cancellingUserId: authUser.uid,
      });
      if (result.success) {
        toast({ title: "Ryd Request Cancelled", description: result.message });
        fetchUpcomingRydz(); // Re-fetch the list
      } else {
        toast({ title: "Cancellation Failed", description: result.message, variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: `An unexpected error occurred: ${error.message}`, variant: "destructive" });
    } finally {
      setIsCancellingRyd(prev => ({ ...prev, [rydRequestId]: false }));
    }
  };

  const isLoadingInitial = authLoading || isLoadingProfile;


  if (isLoadingInitial) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading your rydz...</p>
      </div>
    );
  }
  
  if (!authUser && !isLoadingInitial) {
     return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
        <p className="text-muted-foreground px-4">Please log in to view your upcoming rydz.</p>
        <Button asChild className="mt-4"><Link href="/login">Log In</Link></Button>
      </div>
    );
  }

  if (isLoadingRydz && !isLoadingInitial) { 
     return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Fetching your rydz...</p>
      </div>
    );
  }
  
  if (error && !isLoadingRydz) {
     return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Error Loading Rydz</h2>
        <p className="text-muted-foreground px-4 whitespace-pre-line">{error}</p>
        <Button onClick={fetchUpcomingRydz} className="mt-4">Try Again</Button>
      </div>
    );
  }


  return (
    <>
      <PageHeader
        title="Upcoming Rydz"
        description="Here are your scheduled and requested rydz."
      />

      {upcomingRydz.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {upcomingRydz.map((ryd) => {
            const rydDate = ryd.rydTimestamp instanceof Timestamp ? ryd.rydTimestamp.toDate() : new Date();
            const driverName = ryd.driverProfile?.fullName || "Pending";
            const trackable = !!ryd.assignedActiveRydId;
            const canCancel = (ryd.status === 'requested' || ryd.status === 'searching_driver') && ryd.requestedBy === authUser?.uid;
            const isCancellingThisRyd = isCancellingRyd[ryd.id];

            return (
            <Card key={ryd.id} className="flex flex-col shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="relative h-40">
                <Image
                  src={"https://placehold.co/400x200.png?text=Ryd"}
                  alt={ryd.eventName || ryd.destination}
                  fill
                  className="rounded-t-lg object-cover"
                  data-ai-hint={"map car journey"}
                />
                 <div className="absolute top-2 right-2 bg-primary/80 text-primary-foreground text-xs px-2 py-1 rounded-full backdrop-blur-sm capitalize">
                    {ryd.status.replace(/_/g, ' ')}
                 </div>
              </CardHeader>
              <CardContent className="flex-grow pt-4">
                <CardTitle className="font-headline text-lg mb-1">{ryd.eventName || ryd.destination}</CardTitle>
                <div className="text-sm text-muted-foreground space-y-1 mb-2">
                  <div className="flex items-center">
                    <CalendarDays className="mr-1.5 h-4 w-4" /> {format(rydDate, "PPP 'at' p")}
                  </div>
                  <div className="flex items-center"><MapPin className="mr-1.5 h-4 w-4" /> To: {ryd.destination}</div>
                  <div className="flex items-center">
                    <User className="mr-1.5 h-4 w-4" />
                    Driver: {ryd.driverId && ryd.driverProfile ? (
                      <Link href={`/profile/view/${ryd.driverId}`} className="ml-1 text-primary hover:underline">{driverName}</Link>
                    ) : (
                      <span className="ml-1">{driverName}</span>
                    )}
                  </div>
                </div>
              </CardContent>
              <CardFooter className="border-t pt-4 flex flex-col gap-2">
                <Button variant="default" className="w-full" asChild={trackable} disabled={!trackable}>
                  {trackable ? (
                    <Link href={`/rydz/tracking/${ryd.assignedActiveRydId}`}>
                      <Eye className="mr-2 h-4 w-4" /> View Details / Track
                    </Link>
                  ) : (
                    <span>
                       <Eye className="mr-2 h-4 w-4" /> Awaiting Driver / Details
                    </span>
                  )}
                </Button>
                {canCancel && (
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => handleCancelRydRequest(ryd.id)}
                    disabled={isCancellingThisRyd}
                  >
                    {isCancellingThisRyd ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
                    Cancel My Request
                  </Button>
                )}
              </CardFooter>
            </Card>
          )})}
        </div>
      ) : (
        <Card className="text-center py-12 shadow-md">
          <CardHeader>
            <Car className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <CardTitle className="font-headline text-2xl">No Upcoming Rydz</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="mb-6">
              You have no rydz scheduled or actively requested. Request one to get started!
            </CardDescription>
            <Button asChild>
              <Link href="/rydz/request">
                Request a Ryd
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </>
  );
}
