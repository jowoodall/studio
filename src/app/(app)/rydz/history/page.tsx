
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Star, Car, User, AlertTriangle, Loader2, Eye, CalendarDays } from "lucide-react";
import Link from "next/link";
import { useAuth } from '@/context/AuthContext';
import { type DisplayRydData } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { getRydHistoryAction } from '@/actions/rydActions';
import { format } from 'date-fns';
import { updateStaleEventsAction, updateStaleRydzAction } from '@/actions/systemActions';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const StatusBadge = ({ status }: { status: string }) => {
  const statusText = status.replace(/_/g, ' ');
  let statusClasses = "bg-muted text-muted-foreground";

  if (status.includes("completed")) {
    statusClasses = "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300";
  } else if (status.includes("cancelled") || status.includes("no_driver") || status.includes("rejected")) {
    statusClasses = "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
  } else if (status.includes("assigned") || status.includes("confirmed")) {
      statusClasses = 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';
  }

  return <Badge className={cn('border-transparent capitalize', statusClasses)}>{statusText}</Badge>;
};


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
        description="A complete log of your past and cancelled rydz."
      />

      <Card>
        <CardContent className="p-0">
            {rydHistory.length > 0 ? (
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Event / Destination</TableHead>
                    <TableHead>Your Role</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rydHistory.map((ryd) => {
                        const rydDate = ryd.rydTimestamp ? new Date(ryd.rydTimestamp) : null;
                        const driverName = ryd.driverProfile?.fullName || "N/A";
                        const isDriver = !!ryd.isDriver;
                        
                        return (
                            <TableRow key={ryd.id}>
                                <TableCell>
                                    <div className="font-medium">{rydDate ? format(rydDate, "MMM d, yyyy") : "N/A"}</div>
                                    <div className="text-xs text-muted-foreground">{rydDate ? format(rydDate, "p") : ""}</div>
                                </TableCell>
                                <TableCell className="font-medium">{ryd.eventName || ryd.destination}</TableCell>
                                <TableCell>
                                    <Badge variant={isDriver ? "default" : "secondary"}>
                                        {isDriver ? "Driver" : "Passenger"}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    {ryd.driverProfile ? (
                                        <Link href={`/profile/view/${ryd.driverProfile.uid}`} className="hover:underline flex items-center gap-2">
                                            <User className="h-4 w-4 text-muted-foreground" />
                                            {driverName}
                                        </Link>
                                    ) : (
                                        <span>{driverName}</span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <StatusBadge status={String(ryd.status)} />
                                </TableCell>
                                <TableCell className="text-right space-x-2">
                                    {ryd.status === "completed" && !isDriver && ryd.driverProfile && (
                                        <Button variant="outline" size="sm" asChild>
                                            <Link href={`/drivers/${ryd.driverProfile.uid}/rate?rideId=${ryd.id}`}>
                                                <Star className="mr-2 h-4 w-4" /> Rate
                                            </Link>
                                        </Button>
                                    )}
                                    {ryd.assignedActiveRydId && (
                                        <Button variant="ghost" size="sm" asChild>
                                            <Link href={`/rydz/tracking/${ryd.assignedActiveRydId}`}>
                                                <Eye className="mr-2 h-4 w-4" /> Details
                                            </Link>
                                        </Button>
                                    )}
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
                </Table>
            ) : (
                <div className="text-center py-12">
                    <Car className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="font-headline text-xl">No Ryd History</h3>
                    <p className="text-sm text-muted-foreground mt-2">
                        You have no past rydz recorded.
                    </p>
                    <Button asChild className="mt-4">
                        <Link href="/rydz/request">Request a Ryd</Link>
                    </Button>
                </div>
            )}
        </CardContent>
      </Card>
    </>
  );
}
