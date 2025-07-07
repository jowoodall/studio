
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, MapPin, Star, Car, User, AlertTriangle, Loader2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from '@/context/AuthContext';
import { type DisplayRydData } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { getRydHistoryAction } from '@/actions/rydActions';
import { format } from 'date-fns';
import { updateStaleEventsAction, updateStaleRydzAction } from '@/actions/systemActions';

export default function RydHistoryPage() {
  const { user: authUser, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [rydHistory, setRydHistory] = useState<DisplayRydData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
        updateStaleEventsAction().catch(e => console.error("Ryd History background stale events check failed:", e.message));
        updateStaleRydzAction().catch(e => console.error("Ryd History background stale rydz check failed:", e.message));
    } catch (e: any) {
        console.error("Error initiating background jobs on Ryd History page:", e);
    }
  }, []);

  const fetchRydHistory = useCallback(async () => {
    if (!authUser) {
      if (!authLoading) setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const idToken = await authUser.getIdToken();
      const result = await getRydHistoryAction({ idToken });
      
      if (result.success && result.history) {
        setRydHistory(result.history);
      } else {
        setError(result.message || "Failed to fetch ryd history.");
        toast({ title: "Error", description: result.message || "Could not fetch history.", variant: "destructive" });
      }
    } catch (e: any) {
      setError("An unexpected client-side error occurred.");
      toast({ title: "Error", description: "An unexpected client-side error occurred while fetching history.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [authUser, authLoading, toast]);

  useEffect(() => {
    if (!authLoading) {
      fetchRydHistory();
    }
  }, [authLoading, fetchRydHistory]);

  if (isLoading) {
    return (
      <>
        <PageHeader
          title="Ryd History"
          description="Review your past rydz and ratings."
        />
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-300px)]">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading your ryd history...</p>
        </div>
      </>
    );
  }

  if (error) {
    return (
       <>
        <PageHeader
          title="Ryd History"
          description="Review your past rydz and ratings."
        />
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-300px)] text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Error Loading History</h2>
            <p className="text-muted-foreground px-4">{error}</p>
            <Button onClick={fetchRydHistory} className="mt-4">Try Again</Button>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Ryd History"
        description="Review your past rydz and ratings."
      />

      {rydHistory.length > 0 ? (
        <div className="space-y-6">
          {rydHistory.map((ryd) => {
            const rydDate = ryd.rydTimestamp ? new Date(ryd.rydTimestamp) : null;
            const driverName = ryd.driverProfile?.fullName || "N/A";

            return (
              <Card key={ryd.id} className="shadow-lg">
                <CardHeader className="flex flex-row items-start gap-4">
                  <Image 
                    src={"https://placehold.co/400x200.png?text=Past+Ryd"} 
                    alt={ryd.eventName || "Past ryd"} 
                    width={150} 
                    height={84} 
                    className="rounded-md object-cover aspect-video"
                    data-ai-hint={"map car journey"}
                  />
                  <div className="flex-1">
                    <CardTitle className="font-headline text-lg mb-1">{ryd.eventName || ryd.destination}</CardTitle>
                    <div className="text-sm text-muted-foreground space-y-0.5">
                      <div className="flex items-center"><CalendarDays className="mr-1.5 h-4 w-4" /> {rydDate ? format(rydDate, "PPP 'at' p") : "Date unknown"}</div>
                      <div className="flex items-center"><MapPin className="mr-1.5 h-4 w-4" /> {ryd.destination}</div>
                      <div className="flex items-center">
                        <User className="mr-1.5 h-4 w-4" /> 
                        Driver: {ryd.driverProfile ? <Link href={`/profile/view/${ryd.driverProfile.uid}`} className="ml-1 text-primary hover:underline">{driverName}</Link> : <span className="ml-1">{driverName}</span>}
                      </div>
                    </div>
                  </div>
                  <div className={`text-sm font-semibold px-3 py-1 rounded-full capitalize
                    ${ryd.status === "completed" ? "bg-green-100 text-green-700" : 
                      (ryd.status.toString().includes("cancelled") || ryd.status.toString().includes("no_driver")) ? "bg-red-100 text-red-700" :
                      "bg-muted text-muted-foreground"}`}>
                    {ryd.status.toString().replace(/_/g, ' ')}
                  </div>
                </CardHeader>
                <CardFooter className="border-t pt-4 flex justify-between items-center">
                  <div className="text-sm text-muted-foreground">
                    {ryd.status === "completed" && ryd.driverProfile && (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/drivers/${ryd.driverProfile.uid}/rate?rideId=${ryd.id}`}>
                          <Star className="mr-2 h-4 w-4" /> Rate Driver
                        </Link>
                      </Button>
                    )}
                  </div>
                  {ryd.assignedActiveRydId && (
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/rydz/tracking/${ryd.assignedActiveRydId}`}>
                        View Ryd Details
                      </Link>
                    </Button>
                  )}
                </CardFooter>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card className="text-center py-12 shadow-md">
          <CardHeader>
            <Car className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <CardTitle className="font-headline text-2xl">No Ryd History</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="mb-6">
              You have no past rydz recorded.
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
