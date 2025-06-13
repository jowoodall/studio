
"use client";

import React, { useState, useEffect, use, useCallback } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { InteractiveMap } from "@/components/map/interactive-map";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertTriangle, Car, Clock, Flag, UserCircle, MessageSquare, Loader2, MapPin as MapPinIcon, Users } from "lucide-react"; // Added Users
import type { Metadata } from 'next'; 
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { db } from '@/lib/firebase';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { type RydData, type UserProfileData } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

// Metadata generation needs to be outside the client component or handled differently for client-rendered pages
// For now, this will be handled by a default or if this page becomes server-rendered in part.
// export async function generateMetadata({ params }: { params: { rideId: string } }): Promise<Metadata> {
//   return {
//     title: `Track Ryd ${params.rideId}`,
//     description: `Live tracking for ryd ${params.rideId}.`,
//   };
// }

interface RydDetailsPageParams { rideId: string; }

// Extended RydData to potentially hold fetched driver/passenger info later
interface DisplayRydData extends RydData {
  driverProfile?: UserProfileData;
  passengerProfiles?: UserProfileData[];
  passengerFullNames?: string[]; 
}

export default function LiveRydTrackingPage({ params: paramsPromise }: { params: Promise<RydDetailsPageParams> }) {
  const params = use(paramsPromise);
  const { rideId } = params || {};
  const { toast } = useToast();

  const [rydDetails, setRydDetails] = useState<DisplayRydData | null>(null);
  const [isLoadingRyd, setIsLoadingRyd] = useState(true);
  const [rydError, setRydError] = useState<string | null>(null);
  // Placeholder for driver details until we fetch them
  const [driverDetails, setDriverDetails] = useState<{name: string, avatar: string, dataAiHint: string, vehicle: string} | null>(null);


  const fetchRydDetails = useCallback(async (currentRydId: string) => {
    if (!currentRydId) {
      setRydError("Ryd ID is missing.");
      setIsLoadingRyd(false);
      return;
    }
    setIsLoadingRyd(true);
    setRydError(null);
    try {
      const rydDocRef = doc(db, "rydz", currentRydId);
      const rydDocSnap = await getDoc(rydDocRef);

      if (rydDocSnap.exists()) {
        let data = { id: rydDocSnap.id, ...rydDocSnap.data() } as DisplayRydData; 

        // Fetch passenger names
        if (data.passengerIds && data.passengerIds.length > 0) {
          const passengerNamePromises = data.passengerIds.map(async (passengerId) => {
            try {
              const userDocRef = doc(db, "users", passengerId);
              const userDocSnap = await getDoc(userDocRef);
              if (userDocSnap.exists()) {
                const userData = userDocSnap.data() as UserProfileData;
                return userData.fullName || "Unknown Rider";
              } else {
                console.warn(`Passenger profile not found for ID: ${passengerId} on ryd tracking page.`);
                return "Unknown Rider";
              }
            } catch (passengerError) {
              console.error(`Error fetching passenger profile for ID ${passengerId} on ryd tracking page:`, passengerError);
              return "Error Rider";
            }
          });
          data.passengerFullNames = await Promise.all(passengerNamePromises);
        } else {
          data.passengerFullNames = [];
        }
        
        setRydDetails(data);

        // Placeholder for fetching driver name based on data.driverId
        if (data.driverId) {
          const driverDocRef = doc(db, "users", data.driverId);
          const driverDocSnap = await getDoc(driverDocRef);
          if (driverDocSnap.exists()) {
            const driverData = driverDocSnap.data() as UserProfileData;
            setDriverDetails({
              name: driverData.fullName || "Unknown Driver",
              avatar: driverData.avatarUrl || `https://placehold.co/100x100.png?text=${(driverData.fullName || "Driver").split(" ").map(n=>n[0]).join("")}`,
              dataAiHint: driverData.dataAiHint || "driver photo",
              vehicle: driverData.driverDetails?.primaryVehicle || "Vehicle not specified"
            });
          } else {
             setDriverDetails({name: "Driver details not found", avatar: "https://placehold.co/100x100.png?text=?", dataAiHint: "person unknown", vehicle: "N/A"});
          }
        } else {
            setDriverDetails({name: "Pending Assignment", avatar: "https://placehold.co/100x100.png?text=?", dataAiHint: "question mark", vehicle: "N/A"});
        }

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

  // Mock route path - replace with actual data if available
  const mockRoutePath = [
    { lat: 35.0450, lng: -85.3100 }, 
    { lat: 35.0550, lng: -85.2900 },
  ];
  
  const mapMarkers = [];
  if (rydDetails.pickupLocation) mapMarkers.push({id: 'origin', position: {lat: 35.0450, lng: -85.3100}, title: `Pickup: ${rydDetails.pickupLocation}` }); // Placeholder lat/lng
  if (rydDetails.destination) mapMarkers.push({id: 'destination', position: {lat: 35.0550, lng: -85.2900}, title: `Destination: ${rydDetails.destination}`}); // Placeholder lat/lng

  const pickupTimestamp = rydDetails.earliestPickupTimestamp instanceof Timestamp ? rydDetails.earliestPickupTimestamp.toDate() : null;
  const eventTimestamp = rydDetails.rydTimestamp instanceof Timestamp ? rydDetails.rydTimestamp.toDate() : null;


  return (
    <>
      <PageHeader
        title={`Live Tracking: Ryd #${rideId}`}
        description={`Follow the progress of your ryd in real-time.`}
      />
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <InteractiveMap
            className="h-[400px] lg:h-full"
            markers={mapMarkers}
            // routeCoordinates={mockRoutePath} // Temporarily disable route for simplicity
            defaultCenterLat={mapMarkers[0]?.position.lat || 35.0456}
            defaultCenterLng={mapMarkers[0]?.position.lng || -85.3097}
            defaultZoom={12}
          />
        </div>
        <div className="lg:col-span-1">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Ryd Details for: {rydDetails.eventName || rydDetails.destination}</CardTitle>
              <CardDescription>Status: <span className="font-semibold text-primary capitalize">{rydDetails.status.replace(/_/g, ' ')}</span></CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {driverDetails && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Driver</h4>
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={driverDetails.avatar} alt={driverDetails.name} data-ai-hint={driverDetails.dataAiHint} />
                      <AvatarFallback>{driverDetails.name.split(" ").map(n => n[0]).join("")}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{driverDetails.name}</p>
                      <p className="text-xs text-muted-foreground">{driverDetails.vehicle}</p>
                    </div>
                  </div>
                </div>
              )}
              {pickupTimestamp && (
                 <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1 flex items-center"><Clock className="h-4 w-4 mr-1.5" /> Earliest Pickup Time</h4>
                  <p className="font-semibold">{format(pickupTimestamp, "PPP 'at' p")}</p>
                </div>
              )}
               {eventTimestamp && (
                 <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1 flex items-center"><Clock className="h-4 w-4 mr-1.5" /> Event Start Time</h4>
                  <p className="font-semibold">{format(eventTimestamp, "PPP 'at' p")}</p>
                </div>
              )}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1 flex items-center"><MapPinIcon className="h-4 w-4 mr-1.5" /> From (Pickup)</h4>
                <p>{rydDetails.pickupLocation}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1 flex items-center"><Flag className="h-4 w-4 mr-1.5" /> To (Destination)</h4>
                <p>{rydDetails.destination}</p>
              </div>
              {rydDetails.notes && (
                 <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Notes from Requester</h4>
                    <p className="text-sm bg-muted/50 p-2 rounded-md whitespace-pre-wrap">{rydDetails.notes}</p>
                </div>
              )}
               {rydDetails.passengerFullNames && rydDetails.passengerFullNames.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1 flex items-center"><Users className="h-4 w-4 mr-1.5" /> Ryders</h4>
                  <ul className="list-disc list-inside pl-1 text-sm">
                    {rydDetails.passengerFullNames.map((name, index) => (
                      <li key={index}>{name}</li>
                    ))}
                  </ul>
                </div>
              )}


              <Button variant="outline" className="w-full" asChild>
                <Link href={`/messages/new?rydId=${rideId}&context=rydParticipants`}>
                  <MessageSquare className="mr-2 h-4 w-4" /> Message Ryd Participants
                </Link>
              </Button>
               <div className="text-xs text-muted-foreground pt-4 border-t">
                Map and ETA are estimates and may vary based on real-time conditions. Live driver location is not yet implemented.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

    
