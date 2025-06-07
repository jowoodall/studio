
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Users, CalendarDays, Car } from "lucide-react";
import Link from "next/link";
import type { Metadata } from 'next';
import { InteractiveMap } from "@/components/map/interactive-map"; // Import the InteractiveMap

export const metadata: Metadata = {
  title: 'Dashboard',
};

// Mock upcoming events with geographic coordinates
const mockUpcomingEventsForMap = [
  { id: "eventMap1", title: "School Annual Day", lat: 34.052235, lng: -118.243683, description: "Northwood High Auditorium" }, // Example: Los Angeles
  { id: "eventMap2", title: "Community Soccer Match", lat: 34.058000, lng: -118.250000, description: "City Sports Complex" }, // Example: Near LA
  { id: "eventMap3", title: "Tech Conference", lat: 37.774929, lng: -122.419418, description: "Downtown Convention Center" }, // Example: San Francisco
];

export default function DashboardPage() {
  // This would be dynamic based on user role and data
  const stats = [
    { title: "Upcoming Rydz", value: "3", icon: Car, color: "text-blue-500", href: "/rydz/upcoming" },
    { title: "Active Groups", value: "5", icon: Users, color: "text-green-500", href: "/groups" },
    { title: "Pending Approvals", value: "2", icon: CalendarDays, color: "text-yellow-500", href: "/parent/approvals" }, // Example for parent
  ];

  const mapMarkers = mockUpcomingEventsForMap.map(event => ({
    id: event.id,
    position: { lat: event.lat, lng: event.lng },
    title: `${event.title} - ${event.description}`,
  }));

  return (
    <>
      <PageHeader
        title="Welcome to RydzConnect!"
        description="Manage your rydz, groups, and events all in one place."
        actions={
          <Button asChild>
            <Link href="/rydz/request">
              <PlusCircle className="mr-2 h-4 w-4" /> Request a New Ryd
            </Link>
          </Button>
        }
      />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
        {stats.map((stat) => (
          <Card key={stat.title} className="shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <Link href={stat.href} className="text-xs text-muted-foreground hover:text-primary">
                View Details
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Overview of your latest interactions.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              <li className="flex items-center gap-3">
                <div className="p-2 bg-accent/20 rounded-full"><Car className="h-4 w-4 text-accent" /></div>
                <p className="text-sm">Ryd to "School Event" confirmed for tomorrow.</p>
              </li>
              <li className="flex items-center gap-3">
                <div className="p-2 bg-green-500/20 rounded-full"><Users className="h-4 w-4 text-green-500" /></div>
                <p className="text-sm">New member joined "Morning Commute Crew".</p>
              </li>
               <li className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/20 rounded-full"><CalendarDays className="h-4 w-4 text-yellow-500" /></div>
                <p className="text-sm">"Weekend Soccer Practice" event updated.</p>
              </li>
            </ul>
          </CardContent>
        </Card>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Quick Links</CardTitle>
            <CardDescription>Access common actions quickly.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Button variant="outline" asChild><Link href="/find-carpool">Find a Carpool (AI)</Link></Button>
            <Button variant="outline" asChild><Link href="/groups/create">Create New Group</Link></Button>
            <Button variant="outline" asChild><Link href="/events/create">Create New Event</Link></Button>
            <Button variant="outline" asChild><Link href="/profile">View Profile</Link></Button>
          </CardContent>
        </Card>
      </div>
      
      <Card className="mt-8 shadow-lg">
        <CardHeader>
            <CardTitle>Community Map Overview</CardTitle>
            <CardDescription>Visualize rydz and events in your area. Markers indicate upcoming event locations.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Replace static image with InteractiveMap */}
          <div className="aspect-video bg-muted rounded-md flex items-center justify-center overflow-hidden">
            <InteractiveMap 
                className="w-full h-full" 
                defaultZoom={4} // You might want a different default zoom for the dashboard preview
                markers={mapMarkers} 
            />
          </div>
        </CardContent>
      </Card>
    </>
  );
}
