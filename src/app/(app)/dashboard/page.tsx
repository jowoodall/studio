
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Users, CalendarDays, Car } from "lucide-react";
import Link from "next/link";
import type { Metadata } from 'next';
import { MyNextRyd } from "@/components/dashboard/MyNextRyd";
import { updateStaleEventsAction, updateStaleRydzAction } from "@/actions/systemActions";
import { WhatsNewFeed } from "@/components/dashboard/WhatsNewFeed";

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Your personal hub for managing rydz, groups, and events.'
};

export default async function DashboardPage() {
  // Lazy cron jobs - don't await, let them run in the background
  try {
    updateStaleEventsAction().catch(e => console.error("Dashboard background stale events check failed:", e.message));
    updateStaleRydzAction().catch(e => console.error("Dashboard background stale rydz check failed:", e.message));
  } catch (e) {
    console.error("Error initiating background jobs on dashboard:", e);
  }

  const redirectUrl = "/dashboard";

  return (
    <>
      <PageHeader
        title="Welcome to MyRydz!"
        description="Manage your rydz, groups, and events all in one place."
        actions={
          <Button asChild>
            <Link href={`/rydz/request?redirectUrl=${encodeURIComponent(redirectUrl)}`}>
              <PlusCircle className="mr-2 h-4 w-4" /> Request a New Ryd
            </Link>
          </Button>
        }
      />
      
      <div className="mb-8">
        <MyNextRyd />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <WhatsNewFeed />
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Quick Links</CardTitle>
            <CardDescription>Access common actions quickly.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Button variant="outline" asChild><Link href="/groups/create">Create New Group</Link></Button>
            <Button variant="outline" asChild><Link href="/events/create">Create New Event</Link></Button>
            <Button variant="outline" asChild><Link href="/profile">View Profile</Link></Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
