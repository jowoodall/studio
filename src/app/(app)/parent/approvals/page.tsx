
"use client";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CheckCircle, XCircle, ShieldCheck, UserCircle, MessageSquare } from "lucide-react";
import Link from "next/link";

// Import the server action
import { handleDriverApproval } from "@/actions/carpool";


const mockDrivers = [
  { id: "driver1", name: "John Smith", avatar: "https://placehold.co/100x100.png?text=JS", rating: 4.8, ridesCompleted: 120, status: "pending" as "pending" | "approved" | "rejected", dataAiHint: "man portrait" },
  { id: "driver2", name: "Maria Garcia", avatar: "https://placehold.co/100x100.png?text=MG", rating: 4.5, ridesCompleted: 85, status: "approved" as "pending" | "approved" | "rejected", dataAiHint: "woman portrait" },
  { id: "driver3", name: "David Lee", avatar: "https://placehold.co/100x100.png?text=DL", rating: 4.9, ridesCompleted: 200, status: "rejected" as "pending" | "approved" | "rejected", dataAiHint: "man smiling" },
  { id: "driver4", name: "Sarah Miller", avatar: "https://placehold.co/100x100.png?text=SM", rating: 4.7, ridesCompleted: 95, status: "pending" as "pending" | "approved" | "rejected", dataAiHint: "woman professional" },
];


export default function ParentApprovalsPage() {
  // In a real app, you'd fetch drivers and their approval status for the logged-in parent's children
  // This data fetching would ideally happen in a parent Server Component and be passed down,
  // or use a client-side fetching hook (e.g., SWR, React Query) if this component handles its own data.
  // For this example, mockDrivers is used directly.

  // The inline handleApproval function that was causing the error has been REMOVED from here.
  // It's now imported from "@/actions/carpool".

  return (
    <>
      <PageHeader
        title="Driver Approvals"
        description="Review and approve drivers for your child's rides."
      />

      {mockDrivers.length > 0 ? (
        <div className="space-y-6">
          {mockDrivers.map((driver) => (
            <Card key={driver.id} className="shadow-lg">
              <CardHeader className="flex flex-row items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={driver.avatar} alt={driver.name} data-ai-hint={driver.dataAiHint} />
                  <AvatarFallback>{driver.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <CardTitle className="font-headline text-xl">{driver.name}</CardTitle>
                  <CardDescription>
                    Rating: {driver.rating}/5 ({driver.ridesCompleted} rides)
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" asChild>
                        <Link href={`/drivers/${driver.id}/profile`}> <UserCircle className="mr-2 h-4 w-4" /> View Profile</Link>
                    </Button>
                     <Button variant="outline" size="sm" asChild>
                        <Link href={`/messages/new?to=${driver.id}`}> <MessageSquare className="mr-2 h-4 w-4" /> Message</Link>
                    </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  This driver has requested to be part of carpools involving your child. Please review their profile and approve or reject.
                </p>
                {driver.status === "pending" && (
                  <div className="flex gap-4">
                    <Button
                      onClick={async () => {
                        alert(`Approving ${driver.name}. (Dev note: This calls a server action)`);
                        await handleDriverApproval(driver.id, "approved");
                        // Add logic here to update UI optimistically or re-fetch data
                      }}
                      className="bg-green-500 hover:bg-green-600 text-white"
                    >
                      <CheckCircle className="mr-2 h-4 w-4" /> Approve
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={async () => {
                        alert(`Rejecting ${driver.name}. (Dev note: This calls a server action)`);
                        await handleDriverApproval(driver.id, "rejected");
                        // Add logic here to update UI optimistically or re-fetch data
                      }}
                    >
                      <XCircle className="mr-2 h-4 w-4" /> Reject
                    </Button>
                  </div>
                )}
                {driver.status === "approved" && (
                  <div className="flex items-center text-green-600 font-medium">
                    <CheckCircle className="mr-2 h-5 w-5" /> Approved
                  </div>
                )}
                 {driver.status === "rejected" && (
                  <div className="flex items-center text-red-600 font-medium">
                    <XCircle className="mr-2 h-5 w-5" /> Rejected
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="text-center py-12 shadow-md">
          <CardHeader>
            <ShieldCheck className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <CardTitle className="font-headline text-2xl">No Pending Approvals</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              There are no new driver approval requests at this time.
            </CardDescription>
          </CardContent>
        </Card>
      )}
    </>
  );
}
