
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, MapPin, Car, Eye, AlertTriangle, Loader2, User, XCircle, Clock, Users, ArrowRight, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useAuth } from '@/context/AuthContext';
import { type DisplayRydData, RydDirection } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cancelRydRequestByUserAction } from '@/actions/activeRydActions';
import { getUpcomingRydzAction } from '@/actions/rydActions';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { updateStaleEventsAction, updateStaleRydzAction } from '@/actions/systemActions';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function UpcomingRydzPage() {
  const { user: authUser, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [drivingRydz, setDrivingRydz] = useState<DisplayRydData[]>([]);
  const [passengerRydz, setPassengerRydz] = useState<DisplayRydData[]>([]);
  const [pendingRequests, setPendingRequests] = useState<DisplayRydData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCancellingRyd, setIsCancellingRyd] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
        updateStaleEventsAction().catch(e => console.error("Upcoming Rydz background stale events check failed:", e.message));
        updateStaleRydzAction().catch(e => console.error("Upcoming Rydz background stale rydz check failed:", e.message));
    } catch (e: any) {
        console.error("Error initiating background jobs on Upcoming Rydz page:", e);
    }
  }, []);

  const fetchUpcomingRydz = useCallback(async () => {
    if (!authUser) {
      if (!authLoading) setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const idToken = await authUser.getIdToken();
      const result = await getUpcomingRydzAction({ idToken });
      
      if (result.success) {
        setDrivingRydz(result.drivingRydz || []);
        setPassengerRydz(result.passengerRydz || []);
        setPendingRequests(result.pendingRequests || []);
      } else {
        setError(result.message || "Failed to fetch upcoming rydz.");
        toast({ title: "Error", description: result.message || "Could not fetch rydz.", variant: "destructive" });
      }
    } catch (e: any) {
      console.error("Error calling getUpcomingRydzAction:", e);
      setError("An unexpected client-side error occurred.");
      toast({ title: "Error", description: "An unexpected client-side error occurred.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [authUser, authLoading, toast]);

  useEffect(() => {
    if (!authLoading) {
      fetchUpcomingRydz();
    }
  }, [authLoading, fetchUpcomingRydz]);

  const handleCancelRydRequest = async (rydRequestId: string) => {
    if (!authUser) return;
    setIsCancellingRyd(prev => ({ ...prev, [rydRequestId]: true }));
    try {
      const result = await cancelRydRequestByUserAction({
        rydRequestId,
        cancellingUserId: authUser.uid,
      });
      if (result.success) {
        toast({ title: "Request Cancelled", description: result.message });
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


  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading your rydz...</p>
      </div>
    );
  }

  const renderRydCard = (ryd: DisplayRydData, isPendingRequest: boolean = false) => {
    const rydDate = ryd.rydTimestamp ? new Date(ryd.rydTimestamp as any) : null;
    const driverName = ryd.driverProfile?.fullName || "Pending";
    const driverAvatar = ryd.driverProfile?.avatarUrl || 'https://placehold.co/100x100.png?text=' + driverName.split(" ").map(n=>n[0]).join("");
    const driverDataAiHint = ryd.driverProfile?.dataAiHint || "driver photo";

    const trackable = !!ryd.assignedActiveRydId;
    const isDriver = !!ryd.isDriver;
    const canCancelRequest = isPendingRequest && ryd.requestedBy === authUser?.uid;
    const isCancellingThisRyd = isCancellingRyd[ryd.id];
    
    const passengerCount = ryd.passengerProfiles?.length || 0;
    const vehiclePassengerCapacity = parseInt(ryd.vehicleDetails?.passengerCapacity || "0", 10);
    const seatsOpen = vehiclePassengerCapacity - passengerCount;

    const directionIsToEvent = ryd.direction === RydDirection.TO_EVENT;

    return (
      <Card key={ryd.id} className="flex flex-col shadow-lg hover:shadow-xl transition-shadow">
        <CardHeader className="p-3">
            <div className="flex items-center justify-start gap-3 flex-wrap">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Avatar className="h-8 w-8">
                        <AvatarImage src={driverAvatar} alt={driverName} data-ai-hint={driverDataAiHint}/>
                        <AvatarFallback>{driverName.split(" ").map(n=>n[0]).join("")}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm hover:underline truncate block">{ryd.eventName || ryd.destination}</p>
                        <p className="text-xs text-muted-foreground truncate">
                            Driver: {isDriver ? "You" : driverName}
                        </p>
                    </div>
                </div>
                <Badge variant="outline" className="w-fit capitalize flex-shrink-0 text-xs ml-auto">{String(ryd.status).replace(/_/g, ' ')}</Badge>
            </div>
        </CardHeader>
        <CardContent className="flex-grow pt-2 pb-3 px-3 space-y-2">
            <div className="flex items-center justify-center text-xs font-semibold p-1.5 bg-muted/50 rounded-md">
                {directionIsToEvent ? <ArrowRight className="mr-2 h-4 w-4 text-green-600"/> : <ArrowLeft className="mr-2 h-4 w-4 text-blue-600"/>}
                Ryd {directionIsToEvent ? "to" : "from"} event
            </div>
            <div className="space-y-1 border-t pt-2 text-xs text-muted-foreground">
                <div className="flex items-center">
                    <Clock className="mr-1.5 h-4 w-4 flex-shrink-0" />
                    <span>{rydDate ? format(rydDate, "PPP 'at' p") : 'Date TBD'}</span>
                </div>
                <div className="flex items-center">
                    <Users className="mr-1.5 h-4 w-4 flex-shrink-0" />
                    <span>{isPendingRequest ? `${passengerCount} passenger(s) requested` : (vehiclePassengerCapacity > 0 ? `${seatsOpen} open of ${vehiclePassengerCapacity}` : `${passengerCount} passenger(s)`)}</span>
                </div>
            </div>

            {ryd.passengerProfiles && ryd.passengerProfiles.length > 0 && (
                <div className="pt-2 border-t">
                    <div className="flex flex-wrap gap-1 mt-1">
                        {ryd.passengerProfiles.map(p => (
                            <Badge key={p.uid} variant="secondary" className="font-normal text-xs gap-1">
                                <User className="h-3 w-3"/>
                                {p.uid === authUser?.uid ? "You" : p.fullName}
                            </Badge>
                        ))}
                    </div>
                </div>
            )}
        </CardContent>
        <CardFooter className="border-t p-3 flex flex-col gap-2">
          {trackable && (
            <Button variant="default" size="sm" className="w-full" asChild>
                <Link href={`/rydz/tracking/${ryd.assignedActiveRydId}`}>
                  <Eye className="mr-2 h-4 w-4" />
                  {isDriver ? 'Manage My Ryd' : 'View Details / Track'}
                </Link>
            </Button>
          )}
          {canCancelRequest && (
            <Button
              variant="destructive"
              size="sm"
              className="w-full"
              onClick={() => handleCancelRydRequest(ryd.id)}
              disabled={isCancellingThisRyd}
            >
              {isCancellingThisRyd ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
              Cancel My Request
            </Button>
          )}
           {!trackable && !canCancelRequest && (
            <Button variant="outline" size="sm" className="w-full" disabled>
                <Clock className="mr-2 h-4 w-4" /> Awaiting Driver / Details
            </Button>
           )}
        </CardFooter>
      </Card>
    );
  }

  // JSX structure
  return (
    <>
      <PageHeader
        title="Upcoming Rydz"
        description="Here are your scheduled and requested rydz."
      />
      {error && (
        <Card className="text-center py-10 shadow-md bg-destructive/10 border-destructive">
          <CardHeader>
            <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" />
            <CardTitle className="font-headline text-2xl text-destructive-foreground">Error Loading Rydz</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="mb-6 text-destructive-foreground/90 whitespace-pre-line">
              {error}
            </CardDescription>
            <Button onClick={fetchUpcomingRydz} variant="secondary" type="button">Try Again</Button>
          </CardContent>
        </Card>
      )}
      
      {!error && (
        <>
            <section>
                <h2 className="font-headline text-2xl font-semibold text-primary mb-4">Rydz I'm Driving</h2>
                {drivingRydz.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
      )}
    </>
  );
}
