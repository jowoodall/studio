
// This file is deprecated and its functionality has been moved to /src/app/(app)/rydz/tracking/[rideId]/page.tsx
// It can be safely deleted.
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function DeprecatedLiveRideTrackingPage({ params }: { params: { rideId: string } }) {

  return (
    <>
      <PageHeader
        title="Page Moved"
        description="This page is no longer in use."
      />
       <Card className="text-center py-12 shadow-md">
          <CardHeader>
            <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" />
            <CardTitle className="font-headline text-2xl">Page Deprecated</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="mb-6">
              This page has been replaced. Please use the "Upcoming Rydz" link from the sidebar to find and track your ryd.
            </CardDescription>
            <Button asChild>
              <Link href={`/rydz/tracking/${params.rideId}`}>
                Go to New Tracking Page
              </Link>
            </Button>
          </CardContent>
        </Card>
    </>
  );
}
