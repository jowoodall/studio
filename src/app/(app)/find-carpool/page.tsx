
// This page has been removed as requested.

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

export default function RemovedFindCarpoolPage() {
  return (
    <>
      <PageHeader
        title="Page Removed"
        description="This feature is currently not available."
      />
      <Card className="text-center py-12 shadow-md">
        <CardHeader>
          <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <CardTitle className="font-headline text-2xl">Feature Not Available</CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription>
            The 'Find Carpool with AI' feature has been removed.
          </CardDescription>
        </CardContent>
      </Card>
    </>
  );
}
