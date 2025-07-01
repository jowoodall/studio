
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Car, Users, CalendarDays, Clock, Info, ArrowRight, UserCheck, PlusCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getMyNextRydAction } from '@/actions/dashboardActions';
import { type DashboardRydData, ActiveRydStatus, PassengerManifestStatus } from '@/types';
import Link from 'next/link';
import { format } from 'date-fns';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';

const StatusBadge = ({ status }: { status: ActiveRydStatus }) => {
  const statusText = status.replace(/_/g, ' ');

  const getStatusClasses = () => {
    switch (status) {
      case ActiveRydStatus.COMPLETED:
        return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300';
      case ActiveRydStatus.IN_PROGRESS_PICKUP:
      case ActiveRydStatus.IN_PROGRESS_ROUTE:
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300 animate-pulse';
      case ActiveRydStatus.CANCELLED_BY_DRIVER:
      case ActiveRydStatus.CANCELLED_BY_SYSTEM:
        return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
      case ActiveRydStatus.RYD_PLANNED:
         return 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300';
      case ActiveRydStatus.PLANNING:
      case ActiveRydStatus.AWAITING_PASSENGERS:
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';
    }
  };

  return <Badge className={cn('border-transparent capitalize', getStatusClasses())}>{statusText}</Badge>;
};

const PassengerStatusBadge = ({ status }: { status?: PassengerManifestStatus }) => {
    if (!status) return null;
    const statusText = status.replace(/_/g, ' ');

    let statusClasses = 'bg-gray-100 text-gray-800';
    if (status === PassengerManifestStatus.CONFIRMED_BY_DRIVER || status === PassengerManifestStatus.AWAITING_PICKUP || status === PassengerManifestStatus.ON_BOARD) {
        statusClasses = 'bg-green-100 text-green-800';
    } else if (status === PassengerManifestStatus.PENDING_DRIVER_APPROVAL) {
        statusClasses = 'bg-yellow-100 text-yellow-800 animate-pulse';
    } else if (status === PassengerManifestStatus.REJECTED_BY_DRIVER || status === PassengerManifestStatus.CANCELLED_BY_PASSENGER) {
        statusClasses = 'bg-red-100 text-red-800';
    }

    return <Badge variant="outline" className={cn('capitalize border-none', statusClasses)}>{statusText}</Badge>;
};


export function MyNextRyd() {
  const { user, loading: authLoading } = useAuth();
  const [nextRyd, setNextRyd] = useState<DashboardRydData | null | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  const fetchNextRyd = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      setNextRyd(null);
      return;
    }
    setIsLoading(true);
    try {
      const ryd = await getMyNextRydAction(user.uid);
      setNextRyd(ryd);
    } catch (error) {
      console.error("Error fetching next ryd:", error);
      setNextRyd(null); // Or set an error state
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) {
      fetchNextRyd();
    }
  }, [authLoading, fetchNextRyd]);

  if (isLoading || authLoading) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-4 w-3/4" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
        <CardFooter>
          <Skeleton className="h-10 w-1/3" />
        </CardFooter>
      </Card>
    );
  }

  if (!nextRyd) {
    return (
      <Card className="shadow-lg text-center py-8">
        <CardHeader>
          <Car className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
          <CardTitle>No Upcoming Rydz</CardTitle>
          <CardDescription>You're all clear! Ready for your next trip?</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-4 justify-center">
           <Button asChild className="w-full sm:w-auto">
             <Link href="/rydz/request">
               <PlusCircle className="mr-2 h-4 w-4" /> Request a Ryd
             </Link>
           </Button>
           <Button variant="outline" asChild className="w-full sm:w-auto">
             <Link href="/events">
               <Car className="mr-2 h-4 w-4" /> Offer to Drive for an Event
             </Link>
           </Button>
        </CardContent>
      </Card>
    );
  }

  const rydDate = nextRyd.eventTimestamp?.toDate();

  const title = nextRyd.rydFor.relation === 'self' 
    ? 'Your Next Ryd'
    : `Next Ryd for ${nextRyd.rydFor.name}`;

  return (
    <Card className="shadow-xl border-primary/20">
      <CardHeader>
        <div className="flex justify-between items-start">
            <div>
                <CardTitle>{title}</CardTitle>
                <CardDescription>
                    To: <span className="font-semibold text-primary">{nextRyd.eventName}</span>
                </CardDescription>
            </div>
            <StatusBadge status={nextRyd.rydStatus} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {nextRyd.isDriver ? (
            <div className="flex items-center gap-4 p-3 bg-muted rounded-md">
                <UserCheck className="h-8 w-8 text-primary" />
                <div>
                    <p className="font-semibold">You are the driver</p>
                    <p className="text-sm text-muted-foreground">
                        {nextRyd.passengerCount?.confirmed ?? 0} confirmed, {nextRyd.passengerCount?.pending ?? 0} pending
                    </p>
                </div>
            </div>
        ) : (
            <div className="flex items-center gap-4 p-3 bg-muted rounded-md">
                <Avatar className="h-12 w-12">
                     <AvatarImage src={'https://placehold.co/100x100.png'} alt={nextRyd.driverName || 'Driver'} />
                    <AvatarFallback>{nextRyd.driverName ? nextRyd.driverName.split(' ').map(n => n[0]).join('') : 'D'}</AvatarFallback>
                </Avatar>
                <div>
                    <p className="text-sm text-muted-foreground">Your driver is:</p>
                    <p className="font-semibold">{nextRyd.driverName || 'TBD'}</p>
                </div>
            </div>
        )}
        <div className="text-sm space-y-1.5 pt-2">
            <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground"/>
                <span className="font-medium">Event Time:</span>
                <span>{rydDate ? format(rydDate, 'PPP, p') : 'TBD'}</span>
            </div>
             <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground"/>
                <span className="font-medium">{nextRyd.isDriver ? 'Your Departure:' : 'Est. Pickup:'}</span>
                <span>{nextRyd.isDriver ? (nextRyd.proposedDepartureTimestamp ? format(nextRyd.proposedDepartureTimestamp.toDate(), 'p') : 'TBD') : (nextRyd.earliestPickupTimestamp ? `Around ${format(nextRyd.earliestPickupTimestamp.toDate(), 'p')}` : 'TBD')}</span>
            </div>
        </div>
         {nextRyd.passengerStatus && !nextRyd.isDriver &&
            <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Your Status:</span>
                <PassengerStatusBadge status={nextRyd.passengerStatus} />
            </div>
        }
      </CardContent>
      <CardFooter>
        <Button asChild className="w-full">
            <Link href={`/rydz/tracking/${nextRyd.id}`}>
                View Details & Manage <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
