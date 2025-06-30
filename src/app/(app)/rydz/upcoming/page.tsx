
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, MapPin, Car, Eye, AlertTriangle, Loader2, User, XCircle } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, Timestamp, getDocs, doc, getDoc } from 'firebase/firestore';
import type { RydData, RydStatus, UserProfileData, ActiveRyd } from '@/types';
import { ActiveRydStatus as ARStatus } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cancelRydRequestByUserAction } from '@/actions/activeRydActions';
import { updateStaleRydzAction } from '@/actions/systemActions';

interface DisplayRydData extends Partial<RydData> {
  id: string;
  isDriver?: boolean;
  driverProfile?: UserProfileData;
  // Make fields from RydData optional to accommodate ActiveRyd shape
  rydTimestamp: Timestamp;
  eventName?: string;
  destination: string;
  status: RydStatus | ARStatus;
  assignedActiveRydId?: string;
  requestedBy?: string;
}


const upcomingRequestStatuses: RydStatus[] = [
  'requested',
  'searching_driver',
  'driver_assigned',
  'confirmed_by_driver',
  'en_route_pickup',
  'en_route_destination',
];

const upcomingActiveRydStatuses: ARStatus[] = [
  ARStatus.PLANNING,
  ARStatus.AWAITING_PASSENGERS,
  ARStatus.RYD_PLANNED,
  ARStatus.IN_PROGRESS_PICKUP,
  ARStatus.IN_PROGRESS_ROUTE,
];

export default function UpcomingRydzPage() {
  const { user: authUser, userProfile: authUserProfile, loading: authLoading, isLoadingProfile } = useAuth();
  const { toast } = useToast();

  const [upcomingRydz, setUpcomingRydz] = useState<DisplayRydData[]>([]);
  const [isLoadingRydz, setIsLoadingRydz] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCancellingRyd, setIsCancellingRyd] = useState<Record<string, boolean>>({});

  const fetchUpcomingRydz = useCallback(async () => {
    if (!authUser || !authUserProfile) {
      if (!authLoading && !isLoadingProfile) {
        setIsLoadingRydz(false);
        setUpcomingRydz([]);
      }
      return;
    }

    setIsLoadingRydz(true);
    setError(null);
    try {
      // --- Queries ---
      // 1. Rydz requested by the user
      const requestsByUserQuery = query(
        collection(db, "rydz"),
        where("requestedBy", "==", authUser.uid),
        where("status", "in", upcomingRequestStatuses)
      );
      // 2. Rydz requested for the user (as passenger)
      const requestsForUserQuery = query(
        collection(db, "rydz"),
        where("passengerIds", "array-contains", authUser.uid),
        where("status", "in", upcomingRequestStatuses)
      );
      // 3. Active Rydz where the user is the driver
      const activeRydzAsDriverQuery = query(
        collection(db, "activeRydz"),
        where("driverId", "==", authUser.uid),
        where("status", "in", upcomingActiveRydStatuses)
      );

      const [
        requestsByUserSnap,
        requestsForUserSnap,
        activeRydzAsDriverSnap
      ] = await Promise.all([
        getDocs(requestsByUserQuery),
        getDocs(requestsForUserQuery),
        getDocs(activeRydzAsDriverQuery)
      ]);

      // --- Process Ryd Requests ---
      const rydzMap = new Map<string, RydData>();
      requestsByUserSnap.forEach((doc) => {
        rydzMap.set(doc.id, { id: doc.id, ...doc.data() } as RydData);
      });
      requestsForUserSnap.forEach((doc) => {
        rydzMap.set(doc.id, { id: doc.id, ...doc.data() } as RydData);
      });

      const fetchedRydzPromises = Array.from(rydzMap.values()).map(async (ryd): Promise<DisplayRydData | null> => {
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
        return { ...ryd, driverProfile, isDriver: false };
      });
      
      const resolvedRydRequests = (await Promise.all(fetchedRydzPromises)).filter(Boolean) as DisplayRydData[];

      // --- Process Active Rydz (as Driver) ---
      const activeRydzAsDriver = activeRydzAsDriverSnap.docs.map(docSnap => {
        const activeRyd = { id: docSnap.id, ...docSnap.data() } as ActiveRyd;
        // Map ActiveRyd to DisplayRydData shape
        return {
            id: activeRyd.id,
            rydTimestamp: activeRyd.plannedArrivalTime || activeRyd.proposedDepartureTime || activeRyd.createdAt,
            destination: activeRyd.finalDestinationAddress || 'Destination TBD',
            eventName: activeRyd.eventName || activeRyd.finalDestinationAddress || 'Unnamed Ryd',
            status: activeRyd.status,
            driverProfile: authUserProfile,
            assignedActiveRydId: activeRyd.id,
            isDriver: true,
            requestedBy: activeRyd.driverId,
        } as DisplayRydData;
      });

      // --- Combine and Sort ---
      const combinedRydz = [...resolvedRydRequests, ...activeRydzAsDriver];
      combinedRydz.sort((a, b) => {
        const dateA = a.rydTimestamp ? (a.rydTimestamp as Timestamp).toDate() : new Date(0);
        const dateB = b.rydTimestamp ? (b.rydTimestamp as Timestamp).toDate() : new Date(0);
        return dateA.getTime() - dateB.getTime();
      });

      setUpcomingRydz(combinedRydz);

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
  }, [authUser, authUserProfile, toast, authLoading, isLoadingProfile]);

  useEffect(() => {
    if (!authLoading && !isLoadingProfile) {
      // Run the cleanup job. We don't need to await it.
      // The subsequent fetch will get the latest data.
      updateStaleRydzAction().catch(error => {
        console.error("Background stale rydz check failed:", error);
      });
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
            const rydDate = (ryd.rydTimestamp as Timestamp)?.toDate() || new Date();
            const driverName = ryd.driverProfile?.fullName || "Pending";
            const trackable = !!ryd.assignedActiveRydId;
            const isDriver = !!ryd.isDriver;
            
            const canCancelRequest = !isDriver && (ryd.status === 'requested' || ryd.status === 'searching_driver') && ryd.requestedBy === authUser?.uid;
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
                    <CalendarDays className="mr-1.5 h-4 w-4" /> {rydDate ? format(rydDate, "PPP 'at' p") : "Date TBD"}
                  </div>
                  <div className="flex items-center"><MapPin className="mr-1.5 h-4 w-4" /> To: {ryd.destination}</div>
                  <div className="flex items-center">
                    <User className="mr-1.5 h-4 w-4" />
                    Driver: {isDriver ? (
                      <span className="ml-1 font-medium text-primary">You</span>
                    ) : ryd.driverProfile ? (
                      <Link href={`/profile/view/${ryd.driverProfile.uid}`} className="ml-1 text-primary hover:underline">{driverName}</Link>
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
                      <Eye className="mr-2 h-4 w-4" />
                      {isDriver ? 'Manage My Ryd' : 'View Details / Track'}
                    </Link>
                  ) : (
                    <span>
                       <Eye className="mr-2 h-4 w-4" /> Awaiting Driver / Details
                    </span>
                  )}
                </Button>
                {canCancelRequest && (
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
