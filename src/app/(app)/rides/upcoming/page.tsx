
// This file is deprecated and its functionality has been moved to /src/app/(app)/rydz/upcoming/page.tsx
// It can be safely deleted.

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, MapPin, Users, Car, Eye, AlertTriangle } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function DeprecatedUpcomingRidesPage() {
  return (
    <>
      <PageHeader
        title="Upcoming Rides (Deprecated)"
        description="This page is no longer in use. Please navigate to 'Upcoming Rydz'."
      />
        <Card className="text-center py-12 shadow-md">
          <CardHeader>
            <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" />
            <CardTitle className="font-headline text-2xl">Page Deprecated</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="mb-6">
              This page has been replaced. Please use the "Upcoming Rydz" link from the sidebar.
            </CardDescription>
            <Button asChild>
              <Link href="/rydz/upcoming">
                Go to Upcoming Rydz
              </Link>
            </Button>
          </CardContent>
        </Card>
    </>
  );
}

