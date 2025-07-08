
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Map View',
  description: 'View events, rydz, and live tracking on an interactive map.',
};

export default function MapPage() {
  return (
    <>
      <PageHeader
        title="Interactive Map View"
        description="This feature is temporarily unavailable."
      />
      <Card className="text-center py-12 shadow-md">
        <CardHeader>
          <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <CardTitle className="font-headline text-2xl">Feature Not Available</CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription>
            The interactive map is currently disabled and will be re-enabled in a future version.
          </CardDescription>
        </CardContent>
      </Card>
    </>
  );
}
