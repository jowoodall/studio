
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Car, Loader2, CalendarDays, User, Flag, Clock } from "lucide-react";
import { useAuth } from '@/context/AuthContext';
import { getMyNextRydAction } from '@/actions/dashboardActions';
import type { DashboardRydData } from '@/types';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Button } from '../ui/button';
import Link from 'next/link';

export function MyNextRyd() {
  const { user } = useAuth();
  const [nextRyd, setNextRyd] = useState<DashboardRydData | null | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    const fetchNextRyd = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const idToken = await user.getIdToken();
        const result = await getMyNextRydAction({ idToken });
        if (result.success) {
          setNextRyd(result.ryd);
        } else {
          setError(result.message || "Failed to fetch your next ryd.");
          setNextRyd(null);
        }
      } catch (e: any) {
        setError(`An unexpected error occurred: ${e.message}`);
        setNextRyd(null);
      } finally {
        setIsLoading(false);
      }
    };
    fetchNextRyd();
  }, [user]);

  if (isLoading) {
    return (
      <Card className="shadow-lg text-center py-8">
        <CardHeader>
          <Car className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
          <CardTitle>Your Next Ryd</CardTitle>
          <CardDescription>Finding your most urgent upcoming ryd...</CardDescription>
        </CardHeader>
        <CardContent>
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="shadow-lg text-center py-8 bg-destructive/10">
        <CardHeader>
          <Car className="mx-auto h-12 w-12 text-destructive mb-2" />
          <CardTitle className="text-destructive-foreground">Could Not Load Ryd</CardTitle>
          <CardDescription className="text-destructive-foreground/80">{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!nextRyd) {
    return (
       <Card className="shadow-lg text-center py-8">
        <CardHeader>
          <Car className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
          <CardTitle>No Upcoming Rydz</CardTitle>
          <CardDescription>You have no scheduled rydz. Time to plan one!</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  
  const rydTime = nextRyd.eventTimestamp?.toDate();

  return (
    <Card className="shadow-lg">
        <CardHeader>
            <div className="flex justify-between items-start">
                <div>
                    <CardTitle>{nextRyd.eventName}</CardTitle>
                    <CardDescription>Your next upcoming ryd.</CardDescription>
                </div>
                <Badge variant={nextRyd.isDriver ? "default" : "secondary"}>
                    {nextRyd.isDriver ? 'You are Driving' : `Passenger: ${nextRyd.rydFor.name}`}
                </Badge>
            </div>
        </CardHeader>
        <CardContent className="space-y-3">
            <div className="flex items-center text-sm"><Flag className="mr-2 h-4 w-4 text-muted-foreground" /> To: <span className="ml-1 font-medium">{nextRyd.destination}</span></div>
            <div className="flex items-center text-sm"><CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" /> Date: <span className="ml-1 font-medium">{rydTime ? format(rydTime, "PPP") : 'N/A'}</span></div>
            <div className="flex items-center text-sm"><Clock className="mr-2 h-4 w-4 text-muted-foreground" /> Time: <span className="ml-1 font-medium">{rydTime ? format(rydTime, "p") : 'N/A'}</span></div>
            <div className="flex items-center text-sm"><User className="mr-2 h-4 w-4 text-muted-foreground" /> Driver: <span className="ml-1 font-medium">{nextRyd.driverName || 'TBD'}</span></div>
        </CardContent>
        <CardContent>
             <Button asChild className="w-full">
                <Link href={`/rydz/tracking/${nextRyd.id}`}>
                    View Details
                </Link>
            </Button>
        </CardContent>
    </Card>
  );
}
