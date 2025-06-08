
// src/app/(app)/groups/[groupId]/page.tsx
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CalendarDays, Car, Edit, Users, MapPin, AlertTriangle, Info } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from 'next';
import { Separator } from "@/components/ui/separator";

// Mock group data - in a real app, you'd fetch this
const mockGroupsData: { [key: string]: { id: string; name: string; description: string; imageUrl: string; dataAiHint?: string; membersCount: number; } } = {
  "1": { id: "1", name: "Morning School Run", description: "Daily carpool to Northwood High. Early birds get the aux!", imageUrl: "https://placehold.co/600x300.png?text=School+Carpool", dataAiHint: "school bus students", membersCount: 5 },
  "2": { id: "2", name: "Soccer Practice Crew", description: "Carpool for weekend soccer practice. Don't forget your cleats!", imageUrl: "https://placehold.co/600x300.png?text=Soccer+Team", dataAiHint: "soccer team kids", membersCount: 3 },
  "3": { id: "3", name: "Work Commute (Downtown)", description: "Shared rydz to downtown offices. Saving gas and sanity.", imageUrl: "https://placehold.co/600x300.png?text=City+Commute", dataAiHint: "city traffic commute", membersCount: 2 },
};

// Mock upcoming events for groups
const mockGroupEvents: { [groupId: string]: { id: string; name: string; date: string; time: string; location: string }[] } = {
  "1": [
    { id: "event1", name: "School Assembly", date: "2024-12-10", time: "08:00 AM", location: "Northwood High Auditorium" },
    { id: "event2", name: "PTA Meeting", date: "2024-12-15", time: "06:00 PM", location: "Northwood High Library" },
  ],
  "2": [
    { id: "event3", name: "Championship Game", date: "2024-12-05", time: "02:00 PM", location: "City Sports Complex - Field A" },
  ],
  "3": [], // No specific events for work commute group
};

// Mock members, subset of whom are drivers
interface GroupMember { id: string; name: string; avatarUrl: string; dataAiHint: string; canDrive: boolean; role: 'admin' | 'member'; }
const mockGroupMembers: { [groupId: string]: GroupMember[] } = {
  "1": [
    { id: "user1", name: "Alice Wonderland", avatarUrl: "https://placehold.co/100x100.png?text=AW", dataAiHint: "woman smiling", canDrive: true, role: "admin" },
    { id: "user2", name: "Bob The Builder", avatarUrl: "https://placehold.co/100x100.png?text=BB", dataAiHint: "man construction", canDrive: true, role: "member" },
    { id: "user3", name: "Charlie Brown", avatarUrl: "https://placehold.co/100x100.png?text=CB", dataAiHint: "boy cartoon", canDrive: false, role: "member" },
  ],
  "2": [
    { id: "user4", name: "Diana Prince", avatarUrl: "https://placehold.co/100x100.png?text=DP", dataAiHint: "woman hero", canDrive: true, role: "admin" },
    { id: "user5", name: "Edward Scissorhands", avatarUrl: "https://placehold.co/100x100.png?text=ES", dataAiHint: "man pale", canDrive: false, role: "member" },
  ],
  "3": [
     { id: "user1", name: "Alice Wonderland", avatarUrl: "https://placehold.co/100x100.png?text=AW", dataAiHint: "woman smiling", canDrive: true, role: "admin" },
  ]
};

export async function generateMetadata({ params }: { params: { groupId: string } }): Promise<Metadata> {
  const group = mockGroupsData[params.groupId];
  const groupName = group?.name || `Group ${params.groupId}`;
  return {
    title: `View Group: ${groupName}`,
  };
}

export default function GroupViewPage({ params }: { params: { groupId: string } }) {
  const { groupId } = params;
  const group = mockGroupsData[groupId];
  const events = mockGroupEvents[groupId] || [];
  const members = mockGroupMembers[groupId] || [];
  const drivers = members.filter(member => member.canDrive);

  if (!group) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-10">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Group Not Found</h2>
        <p className="text-muted-foreground">The group with ID "{groupId}" could not be found.</p>
        <Button asChild className="mt-4">
          <Link href="/groups">Back to Groups</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={group.name}
        description={group.description}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href={`/groups/${groupId}/edit`}>
                <Edit className="mr-2 h-4 w-4" /> Edit Group
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/groups/${groupId}/manage`}>
                <Users className="mr-2 h-4 w-4" /> Manage Members
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left Column / Main Info */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-xl overflow-hidden">
            <div className="relative aspect-[16/7] bg-muted">
              <Image src={group.imageUrl} alt={group.name} fill className="object-cover" data-ai-hint={group.dataAiHint} />
            </div>
            <CardHeader>
              <CardTitle className="font-headline text-2xl">{group.name}</CardTitle>
              <CardDescription>{group.membersCount} members</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{group.description}</p>
            </CardContent>
          </Card>

          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center"><CalendarDays className="mr-2 h-5 w-5 text-primary" /> Upcoming Events</CardTitle>
              <CardDescription>Events relevant to this group.</CardDescription>
            </CardHeader>
            <CardContent>
              {events.length > 0 ? (
                <ul className="space-y-4">
                  {events.map(event => (
                    <li key={event.id} className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                      <h4 className="font-semibold">{event.name}</h4>
                      <div className="text-sm text-muted-foreground mt-1">
                        <span className="flex items-center"><CalendarDays className="mr-1.5 h-4 w-4" /> {event.date} at {event.time}</span>
                        <span className="flex items-center mt-0.5"><MapPin className="mr-1.5 h-4 w-4" /> {event.location}</span>
                      </div>
                      <Button variant="link" size="sm" className="px-0 h-auto mt-1" asChild>
                        <Link href={`/events/${event.id}/rydz`}>View Event Rydz</Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <Info className="mx-auto h-8 w-8 mb-2" />
                  <p>No upcoming events specifically listed for this group.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column / Drivers */}
        <div className="lg:col-span-1">
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center"><Car className="mr-2 h-5 w-5 text-primary" /> Group Drivers</CardTitle>
              <CardDescription>Members who can drive.</CardDescription>
            </CardHeader>
            <CardContent>
              {drivers.length > 0 ? (
                <ul className="space-y-3">
                  {drivers.map(driver => (
                    <li key={driver.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-md">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={driver.avatarUrl} alt={driver.name} data-ai-hint={driver.dataAiHint} />
                        <AvatarFallback>{driver.name.split(" ").map(n => n[0]).join("")}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{driver.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{driver.role}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                 <div className="text-center py-6 text-muted-foreground">
                  <Car className="mx-auto h-8 w-8 mb-2 opacity-50" />
                  <p>No designated drivers in this group yet.</p>
                </div>
              )}
            </CardContent>
            <CardFooter className="border-t pt-4">
                <Button variant="outline" className="w-full" asChild>
                    <Link href={`/groups/${groupId}/manage`}>Manage All Members</Link>
                </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </>
  );
}
