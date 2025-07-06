
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, MapPin, Car, Eye, AlertTriangle, Loader2, User, XCircle, Clock, Users } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, Timestamp, getDocs, doc, getDoc } from 'firebase/firestore';
import type { RydData, RydStatus, UserProfileData, ActiveRyd } from '@/types';
import { ActiveRydStatus as ARStatus, UserRole, PassengerManifestStatus } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cancelRydRequestByUserAction } from '@/actions/activeRydActions';
import { updateStaleRydzAction } from '@/actions/systemActions';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

interface DisplayRydData extends Partial<RydData> {
  id: string;
  isDriver?: boolean;
  driverProfile?: UserProfileData;
  passengerProfiles?: UserProfileData[];
  rydTimestamp: Timestamp;
  eventName?: string;
  destination: string;
  status: RydStatus | ARStatus;
  assignedActiveRydId?: string;
  requestedBy?: string;
}


const upcomingActiveRydStatuses: ARStatus[] = [
  ARStatus.PLANNING,
  ARStatus.AWAITING_PASSENGERS,
  ARStatus.RYD_PLANNED,
  ARStatus.IN_PROGRESS_PICKUP,
  ARStatus.IN_PROGRESS_ROUTE,
];

const pendingRequestStatuses: RydStatus[] = [
  'requested',
  'searching_driver',
];


export default function UpcomingRydzPage() {
  const { user: authUser, userProfile: authUserProfile, loading: authLoading, isLoadingProfile } = useAuth();
  const { toast } = useToast();

  const [drivingRydz, setDrivingRydz] = useState<DisplayRydData[]>([]);
  const [passengerRydz, setPassengerRydz] = useState<DisplayRydData[]>([]);
  const [pendingRequests, setPendingRequests] = useState<DisplayRydData[]>([]);
  const [isLoadingRydz, setIsLoadingRydz] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCancellingRyd, setIsCancellingRyd] = useState<Record<string, boolean>>({});

  const fetchUpcomingRydz = useCallback(async () => {
    if (!authUser || !authUserProfile) {
      if (!authLoading && !isLoadingProfile) {
        setIsLoadingRydz(false);
      }
      return;
    }

    setIsLoadingRydz(true);
    setError(null);
    try {
      const passengerIdsForQuery = [authUser.uid];
      if (authUserProfile.role === UserRole.PARENT && authUserProfile.managedStudentIds) {
          passengerIdsForQuery.push(...authUserProfile.managedStudentIds);
      }
      
      // Query 1: Active Rydz where the user is the DRIVER
      const drivingQuery = query(
        collection(db, "activeRydz"),
        where("driverId", "==", authUser.uid),
        where("status", "in", upcomingActiveRydStatuses)
      );

      // Query 2: Active Rydz where the user OR THEIR STUDENTS are a PASSENGER
      const passengerQuery = query(
        collection(db, "activeRydz"),
        where("passengerUids", "array-contains-any", passengerIdsForQuery),
        where("status", "in", upcomingActiveRydStatuses)
      );
      
      // Query 3: Pending Ryd Requests made by or for the user or their students
      const pendingRequestsQuery = query(
        collection(db, "rydz"),
        where("passengerIds", "array-contains-any", passengerIdsForQuery),
        where("status", "in", pendingRequestStatuses)
      );

      const [drivingSnap, passengerSnap, pendingRequestsSnap] = await Promise.all([
        getDocs(drivingQuery),
        getDocs(passengerQuery),
        getDocs(pendingRequestsQuery),
      ]);

      // --- Process Driving Rydz ---
      const drivingRydzPromises = drivingSnap.docs.map(async (docSnap): Promise<DisplayRydData> => {
        const activeRyd = { id: docSnap.id, ...docSnap.data() } as ActiveRyd;
        
        let passengerProfiles: UserProfileData[] = [];
        if (activeRyd.passengerManifest && activeRyd.passengerManifest.length > 0) {
            const profilePromises = activeRyd.passengerManifest
                .filter(p => p.status !== PassengerManifestStatus.CANCELLED_BY_PASSENGER && p.status !== PassengerManifestStatus.REJECTED_BY_DRIVER)
                .map(item => getDoc(doc(db, "users", item.userId)));
            const profileSnaps = await Promise.all(profilePromises);
            passengerProfiles = profileSnaps
                .filter(snap => snap.exists())
                .map(snap => snap.data() as UserProfileData);
        }

        return {
            id: activeRyd.id,
            rydTimestamp: activeRyd.plannedArrivalTime || activeRyd.proposedDepartureTime || activeRyd.createdAt,
            destination: activeRyd.finalDestinationAddress || 'Destination TBD',
            eventName: activeRyd.eventName || activeRyd.finalDestinationAddress || 'Unnamed Ryd',
            status: activeRyd.status,
            driverProfile: authUserProfile,
            passengerProfiles,
            assignedActiveRydId: activeRyd.id,
            isDriver: true,
            requestedBy: activeRyd.driverId,
        };
      });
      
      // --- Process Passenger Rydz ---
      const passengerRydzPromises = passengerSnap.docs.map(async (docSnap): Promise<DisplayRydData | null> => {
        const activeRyd = { id: docSnap.id, ...docSnap.data() } as ActiveRyd;
        
        if (activeRyd.driverId === authUser.uid) return null;

        let driverProfile: UserProfileData | undefined = undefined;
        if (activeRyd.driverId) {
          try {
            const driverDocRef = doc(db, "users", activeRyd.driverId);
            const driverDocSnap = await getDoc(driverDocRef);
            if (driverDocSnap.exists()) driverProfile = driverDocSnap.data() as UserProfileData;
          } catch (e) { console.warn(`Failed to fetch driver profile for ${activeRyd.driverId}`, e); }
        }

        let passengerProfiles: UserProfileData[] = [];
        if (activeRyd.passengerManifest && activeRyd.passengerManifest.length > 0) {
            const profilePromises = activeRyd.passengerManifest
                .filter(p => p.status !== PassengerManifestStatus.CANCELLED_BY_PASSENGER && p.status !== PassengerManifestStatus.REJECTED_BY_DRIVER)
                .map(item => getDoc(doc(db, "users", item.userId)));
            const profileSnaps = await Promise.all(profilePromises);
            passengerProfiles = profileSnaps
                .filter(snap => snap.exists())
                .map(snap => snap.data() as UserProfileData);
        }
        
        return {
            id: activeRyd.id,
            rydTimestamp: activeRyd.plannedArrivalTime || activeRyd.proposedDepartureTime || activeRyd.createdAt,
            destination: activeRyd.finalDestinationAddress || 'Destination TBD',
            eventName: activeRyd.eventName || activeRyd.finalDestinationAddress || 'Unnamed Ryd',
            status: activeRyd.status,
            driverProfile: driverProfile,
            passengerProfiles,
            assignedActiveRydId: activeRyd.id,
            isDriver: false,
        };
      });

      // --- Process Pending Requests ---
      const pendingRequestsData = pendingRequestsSnap.docs.map(docSnap => {
        const rydData = docSnap.data() as RydData;
        return { ...rydData, isDriver: false, id: docSnap.id };
      });
      
      const [resolvedDrivingRydz, resolvedPassengerRydz] = await Promise.all([
          Promise.all(drivingRydzPromises),
          Promise.all(passengerRydzPromises)
      ]);
      
      const finalPassengerRydz = resolvedPassengerRydz.filter(Boolean) as DisplayRydData[];

      // --- Sort and Set State ---
      resolvedDrivingRydz.sort((a, b) => a.rydTimestamp.toMillis() - b.rydTimestamp.toMillis());
      finalPassengerRydz.sort((a, b) => a.rydTimestamp.toMillis() - b.rydTimestamp.toMillis());
      pendingRequestsData.sort((a, b) => a.rydTimestamp.toMillis() - b.rydTimestamp.toMillis());
      
      setDrivingRydz(resolvedDrivingRydz);
      setPassengerRydz(finalPassengerRydz);
      setPendingRequests(pendingRequestsData);

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
        fetchUpcomingRydz();
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

  const renderRydCard = (ryd: DisplayRydData, isPendingRequest: boolean = false) => {
    const rydDate = (ryd.rydTimestamp as Timestamp)?.toDate() || new Date();
    const driverName = ryd.driverProfile?.fullName || "Pending";
    const trackable = !!ryd.assignedActiveRydId;
    const isDriver = !!ryd.isDriver;
    const canCancelRequest = isPendingRequest && ryd.requestedBy === authUser?.uid;
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
              {String(ryd.status).replace(/_/g, ' ')}
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
          {ryd.passengerProfiles && ryd.passengerProfiles.length > 0 && (
            <div className="mt-3 pt-3 border-t">
              <h4 className="text-xs font-semibold text-muted-foreground flex items-center mb-2">
                <Users className="mr-2 h-4 w-4" />
                Passengers ({ryd.passengerProfiles.length})
              </h4>
              <div className="flex flex-wrap gap-1">
                {ryd.passengerProfiles.map(p => (
                  <Badge key={p.uid} variant="secondary" className="font-normal">
                    {p.fullName}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="border-t pt-4 flex flex-col gap-2">
          {trackable && (
            <Button variant="default" className="w-full" asChild>
                <Link href={`/rydz/tracking/${ryd.assignedActiveRydId}`}>
                  <Eye className="mr-2 h-4 w-4" />
                  {isDriver ? 'Manage My Ryd' : 'View Details / Track'}
                </Link>
            </Button>
          )}
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
           {!trackable && !canCancelRequest && (
            <Button variant="default" className="w-full" disabled>
                <Eye className="mr-2 h-4 w-4" /> Awaiting Driver / Details
            </Button>
           )}
        </CardFooter>
      </Card>
    );
  }

  return (
    <>
      <PageHeader
        title="Upcoming Rydz"
        description="Here are your scheduled and requested rydz."
      />
      
      <section>
        <h2 className="font-headline text-2xl font-semibold text-primary mb-4">Rydz I'm Driving</h2>
        {drivingRydz.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {drivingRydz.map(ryd => renderRydCard(ryd, false))}
          </div>
        ) : (
          <Card className="text-center py-12 shadow-md">
            <CardHeader><Car className="mx-auto h-12 w-12 text-muted-foreground mb-4" /></CardHeader>
            <CardContent>
              <CardTitle className="font-headline text-xl">No Driving Commitments</CardTitle>
              <CardDescription className="mt-2">You are not scheduled to drive for any upcoming rydz.</CardDescription>
            </CardContent>
          </Card>
        )}
      </section>

      <Separator className="my-8" />
      
      <section>
        <h2 className="font-headline text-2xl font-semibold text-primary mb-4">My Upcoming Rydz (as Passenger)</h2>
        {passengerRydz.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {passengerRydz.map(ryd => renderRydCard(ryd, false))}
          </div>
        ) : (
          <Card className="text-center py-12 shadow-md">
            <CardHeader><Car className="mx-auto h-12 w-12 text-muted-foreground mb-4" /></CardHeader>
            <CardContent>
              <CardTitle className="font-headline text-xl">No Upcoming Rydz</CardTitle>
              <CardDescription className="mt-2 mb-6">You are not a passenger in any upcoming rydz.</CardDescription>
              <Button asChild>
                <Link href="/rydz/request">Request a Ryd</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </section>

      <Separator className="my-8" />

      <section>
        <h2 className="font-headline text-2xl font-semibold text-primary mb-4">My Pending Requests</h2>
        {pendingRequests.length > 0 ? (
           <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {pendingRequests.map(ryd => renderRydCard(ryd, true))}
          </div>
        ) : (
           <Card className="text-center py-12 shadow-md">
            <CardHeader><Clock className="mx-auto h-12 w-12 text-muted-foreground mb-4" /></CardHeader>
            <CardContent>
              <CardTitle className="font-headline text-xl">No Pending Requests</CardTitle>
              <CardDescription className="mt-2">You have no ryd requests that are currently awaiting a driver.</CardDescription>
            </CardContent>
          </Card>
        )}
      </section>
    </>
  );
}
