
import { PageHeader } from "@/components/shared/page-header";
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

  return (
    <>
      <PageHeader
        title="Welcome to MyRydz!"
        description="Manage your rydz, groups, and events all in one place."
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
