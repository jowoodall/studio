
"use client";

import React, { useState, useEffect, use, useCallback } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { InteractiveMap } from "@/components/map/interactive-map";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertTriangle, Car, Clock, Flag, UserCircle, MessageSquare, Loader2, MapPin as MapPinIcon, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { db } from '@/lib/firebase';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { type RydData, type UserProfileData, type ActiveRyd, type EventData } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface RydDetailsPageParams { rideId: string; }

interface DisplayActiveRydData extends ActiveRyd {
  driverProfile?: UserProfileData;
  passengerProfiles?: UserProfileData[];
  eventName?: string; // From associated event
}

export default function LiveRydTrackingPage({ params: paramsPromise }: { params: Promise<RydDetailsPageParams> }) {
  const params = use(paramsPromise);
  const { rideId } = params || {};
  const { toast } = useToast();

  const [rydDetails, setRydDetails] = useState<DisplayActiveRydData | null>(null);
  const [isLoadingRyd, setIsLoadingRyd] = useState(true);
  const [rydError, setRydError] = useState<string | null>(null);

  const fetchRydDetails = useCallback(async (currentRydId: string) => {
    if (!currentRydId) {
      setRydError("Ryd ID is missing.");
      setIsLoadingRyd(false);
      return;
    }
    setIsLoadingRyd(true);
    setRydError(null);
    try {
      const rydDocRef = doc(db, "activeRydz", currentRydId); // Fetch from activeRydz collection
      const rydDocSnap = await getDoc(rydDocRef);

      if (rydDocSnap.exists()) {
        let data = { id: rydDocSnap.id, ...rydDocSnap.data() } as DisplayActiveRydData;

        // Fetch Driver Profile
        if (data.driverId) {
          const driverDocRef = doc(db, "users", data.driverId);
          const driverDocSnap = await getDoc(driverDocRef);
          if (driverDocSnap.exists()) {
            data.driverProfile = driverDocSnap.data() as UserProfileData;
          } else {
            console.warn(`Driver profile not found for ID: ${data.driverId}`);
          }
        }

        // Fetch Passenger Profiles for names
        if (data.passengerManifest && data.passengerManifest.length > 0) {
          const passengerProfilePromises = data.passengerManifest.map(async (item) => {
            try {
              const userDocRef = doc(db, "users", item.userId);
              const userDocSnap = await getDoc(userDocRef);
              return userDocSnap.exists() ? userDocSnap.data() as UserProfileData : null;
            } catch (passengerError) {
              console.error(`Error fetching passenger profile for ID ${item.userId}:`, passengerError);
              return null;
            }
          });
          data.passengerProfiles = (await Promise.all(passengerProfilePromises)).filter(Boolean) as UserProfileData[];
        }

        // Fetch Event Name if associatedEventId exists
        if (data.associatedEventId) {
          const eventDocRef = doc(db, "events", data.associatedEventId);
          const eventDocSnap = await getDoc(eventDocRef);
          if (eventDocSnap.exists()) {
            data.eventName = (eventDocSnap.data() as EventData).name;
          }
        }
        
        setRydDetails(data);
      } else {
        setRydError(`Ryd with ID "${currentRydId}" not found.`);
        setRydDetails(null);
      }
    } catch (e) {
      console.error("Error fetching ryd details:", e);
      setRydError("Failed to load ryd details. Please try again.");
      toast({ title: "Error", description: "Could not load ryd information.", variant: "destructive" });
    } finally {
      setIsLoadingRyd(false);
    }
  }, [toast]);

  useEffect(() => {
    if (rideId) {
      fetchRydDetails(rideId);
    }
  }, [rideId, fetchRydDetails]);

  useEffect(() => {
    if (rydDetails) {
      document.title = `Track Ryd: ${rydDetails.eventName || rydDetails.finalDestinationAddress || rideId} | MyRydz`;
    } else if (rydError) {
      document.title = `Error Loading Ryd | MyRydz`;
    } else {
       document.title = `Track Ryd | MyRydz`;
    }
  }, [rydDetails, rydError, rideId]);


  if (isLoadingRyd) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading ryd details...</p>
      </div>
    );
  }

  if (rydError) {
    return (
       <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Error Loading Ryd</h2>
        <p className="text-muted-foreground mb-4 px-4">{rydError}</p>
        <Button asChild variant="outline">
          <Link href="/dashboard">Go to Dashboard</Link>
        </Button>
      </div>
    );
  }
  
  if (!rydDetails) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
            <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
            <p className="text-muted-foreground">Ryd details could not be loaded or found.</p>
            <Button asChild className="mt-4" variant="outline"><Link href="/dashboard">Go to Dashboard</Link></Button>
        </div>
    );
  }

  const mapMarkers = [];
  // Placeholder coordinates - geocoding would be needed for real addresses
  if (rydDetails.startLocationAddress) mapMarkers.push({id: 'origin', position: {lat: 35.0456, lng: -85.3097}, title: `From: ${rydDetails.startLocationAddress}` });
  if (rydDetails.finalDestinationAddress) mapMarkers.push({id: 'destination', position: {lat: 35.0550, lng: -85.2900}, title: `To: ${rydDetails.finalDestinationAddress}`});

  const departureTime = rydDetails.actualDepartureTime instanceof Timestamp ? rydDetails.actualDepartureTime.toDate() : null;
  
  const driverName = rydDetails.driverProfile?.fullName || "Driver details pending";
  const driverAvatar = rydDetails.driverProfile?.avatarUrl || `https://placehold.co/100x100.png?text=${driverName.split(" ").map(n=>n[0]).join("")}`;
  const driverDataAiHint = rydDetails.driverProfile?.dataAiHint || "driver photo";
  const vehicleMake = rydDetails.vehicleDetails?.make || "";
  const vehicleModel = rydDetails.vehicleDetails?.model || "";
  const vehiclePassengerCapacity = rydDetails.vehicleDetails?.passengerCapacity || "N/A";
  const vehicleInfo = `${vehicleMake} ${vehicleModel}`.trim() || "Vehicle not specified";


  return (
    <>
      <PageHeader
        title={`Tracking Ryd to: ${rydDetails.eventName || rydDetails.finalDestinationAddress || `ID ${rideId}`}`}
        description={`Follow the progress of this ryd in real-time.`}
      />
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <InteractiveMap
            className="h-[400px] lg:h-full"
            markers={mapMarkers}
            defaultCenterLat={mapMarkers[0]?.position.lat || 35.0456}
            defaultCenterLng={mapMarkers[0]?.position.lng || -85.3097}
            defaultZoom={12}
          />
        </div>
        <div className="lg:col-span-1">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Ryd Details</CardTitle>
              <CardDescription>Status: <span className="font-semibold text-primary capitalize">{rydDetails.status.replace(/_/g, ' ')}</span></CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {rydDetails.driverId && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Driver</h4>
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={driverAvatar} alt={driverName} data-ai-hint={driverDataAiHint} />
                      <AvatarFallback>{driverName.split(" ").map(n => n[0]).join("")}</AvatarFallback>
                    </Avatar>
                    <div>
                      <Link href={`/profile/view/${rydDetails.driverId}`} className="font-semibold hover:underline">{driverName}</Link>
                      <p className="text-xs text-muted-foreground">{vehicleInfo} (Capacity: {vehiclePassengerCapacity})</p>
                    </div>
                  </div>
                </div>
              )}
              {departureTime && (
                 <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1 flex items-center"><Clock className="h-4 w-4 mr-1.5" /> Proposed Departure Time</h4>
                  <p className="font-semibold">{format(departureTime, "PPP 'at' p")}</p>
                </div>
              )}
              {rydDetails.startLocationAddress && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1 flex items-center"><MapPinIcon className="h-4 w-4 mr-1.5" /> From (Approx. Origin)</h4>
                  <p>{rydDetails.startLocationAddress}</p>
                </div>
              )}
              {rydDetails.finalDestinationAddress && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1 flex items-center"><Flag className="h-4 w-4 mr-1.5" /> To (Final Destination)</h4>
                  <p>{rydDetails.finalDestinationAddress}</p>
                </div>
              )}
              {rydDetails.notes && (
                 <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Driver's Notes for this Ryd</h4>
                    <p className="text-sm bg-muted/50 p-2 rounded-md whitespace-pre-wrap">{rydDetails.notes}</p>
                </div>
              )}
              {rydDetails.passengerProfiles && rydDetails.passengerProfiles.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1 flex items-center"><Users className="h-4 w-4 mr-1.5" /> Passengers on this Ryd</h4>
                  <ul className="list-disc list-inside pl-1 text-sm space-y-0.5">
                    {rydDetails.passengerProfiles.map((passenger, index) => (
                      <li key={passenger.uid}>
                        <Link href={`/profile/view/${passenger.uid}`} className="hover:underline">
                            {passenger.fullName || "Unnamed Passenger"}
                        </Link>
                         ({rydDetails.passengerManifest.find(item => item.userId === passenger.uid)?.status.replace(/_/g, ' ') || 'Status unknown'})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {(!rydDetails.passengerProfiles || rydDetails.passengerProfiles.length === 0) && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1 flex items-center"><Users className="h-4 w-4 mr-1.5" /> Passengers</h4>
                    <p className="text-sm text-muted-foreground">No passengers currently assigned or confirmed for this ryd.</p>
                  </div>
              )}

              <Button variant="outline" className="w-full" asChild>
                <Link href={`/messages/new?activeRydId=${rideId}&context=rydParticipants`}>
                  <MessageSquare className="mr-2 h-4 w-4" /> Message Ryd Participants
                </Link>
              </Button>
               <div className="text-xs text-muted-foreground pt-4 border-t">
                Map and ETA are estimates. Live driver location is a future feature.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

    