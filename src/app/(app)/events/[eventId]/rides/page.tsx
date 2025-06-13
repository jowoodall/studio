
// This file is deprecated and functionality has been merged into /src/app/(app)/events/[eventId]/rydz/page.tsx
// It can be safely deleted.
// For safety, its content is removed to prevent accidental usage.

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

export default function DeprecatedEventRidesPage({ params }: { params: { eventId: string } }) {
  return (
    <>
      <PageHeader
        title={`Rides for Event ${params.eventId} (Deprecated)`}
        description="This page is no longer in use. Please navigate to the main event rydz page."
      />
        <Card className="text-center py-12 shadow-md">
          <CardHeader>
            <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" />
            <CardTitle className="font-headline text-2xl">Page Deprecated</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="mb-6">
              The functionality of this page has been moved to the main event rydz page.
            </CardDescription>
            <Button asChild>
              <Link href={`/events/${params.eventId}/rydz`}>
                Go to Event Rydz
              </Link>
            </Button>
          </CardContent>
        </Card>
    </>
  );
}
