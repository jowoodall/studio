import { PageHeader } from "@/components/shared/page-header";
import { InteractiveMap } from "@/components/map/interactive-map";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertTriangle, Car, Clock, Flag, UserCircle } from "lucide-react";
import type { Metadata } from 'next';

// Function to generate metadata dynamically based on rideId
export async function generateMetadata({ params }: { params: { rideId: string } }): Promise<Metadata> {
  // In a real app, fetch ride details using params.rideId
  return {
    title: `Track Ride ${params.rideId}`,
    description: `Live tracking for ride ${params.rideId}.`,
  };
}

// Mock ride data
const mockRideDetails = {
  driver: { name: "Jane Doe", avatar: "https://placehold.co/100x100.png?text=JD", dataAiHint: "woman driver" },
  vehicle: "Blue Sedan - XYZ 123",
  origin: "123 Oak Street, Anytown",
  destination: "Northwood High School",
  eta: "15 minutes",
  status: "En route", // Other statuses: "Picking up", "Delayed", "Arrived"
};


export default function LiveRideTrackingPage({ params }: { params: { rideId: string } }) {
  // In a real app, you would fetch ride details using params.rideId
  // and update map + details via websockets or polling.

  if (!params.rideId) {
    return (
         <div className="flex flex-col items-center justify-center h-full">
            <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Ride Not Found</h2>
            <p className="text-muted-foreground">The specified ride ID is invalid or the ride does not exist.</p>
        </div>
    );
  }


  return (
    <>
      <PageHeader
        title={`Live Tracking: Ride #${params.rideId}`}
        description={`Follow the progress of your ride in real-time.`}
      />
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <InteractiveMap className="h-[400px] lg:h-full" />
        </div>
        <div className="lg:col-span-1">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Ride Details</CardTitle>
              <CardDescription>Status: <span className="font-semibold text-primary">{mockRideDetails.status}</span></CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Driver</h4>
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={mockRideDetails.driver.avatar} alt={mockRideDetails.driver.name} data-ai-hint={mockRideDetails.driver.dataAiHint} />
                    <AvatarFallback>{mockRideDetails.driver.name.split(" ").map(n => n[0]).join("")}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">{mockRideDetails.driver.name}</p>
                    <p className="text-xs text-muted-foreground">{mockRideDetails.vehicle}</p>
                  </div>
                </div>
              </div>
               <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1 flex items-center"><Clock className="h-4 w-4 mr-1.5" /> Estimated Time of Arrival</h4>
                <p className="font-semibold">{mockRideDetails.eta}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1 flex items-center"><Car className="h-4 w-4 mr-1.5" /> From</h4>
                <p>{mockRideDetails.origin}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1 flex items-center"><Flag className="h-4 w-4 mr-1.5" /> To</h4>
                <p>{mockRideDetails.destination}</p>
              </div>
               <div className="text-xs text-muted-foreground pt-4 border-t">
                Map and ETA are estimates and may vary based on real-time conditions.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
