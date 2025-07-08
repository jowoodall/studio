
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import Link from "next/link";
import type { Metadata } from 'next';
import { MyNextRyd } from "@/components/dashboard/MyNextRyd";
import { updateStaleEventsAction, updateStaleRydzAction } from "@/actions/systemActions";
import { WhatsNewFeed } from "@/components/dashboard/WhatsNewFeed";
import { UpcomingSchedule } from "@/components/dashboard/UpcomingSchedule";
import { Separator } from "@/components/ui/separator";

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

      <div className="mb-8">
        <WhatsNewFeed />
      </div>
      
      <Separator className="my-8" />
      
      <div className="mb-8">
        <UpcomingSchedule />
      </div>
    </>
  );
}
