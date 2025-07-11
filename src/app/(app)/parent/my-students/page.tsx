
"use client";

import React from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

export default function DeprecatedMyStudentsPage() {
  return (
    <>
      <PageHeader
        title="Page Moved"
        description="This page has been replaced by the new 'My Family' section."
      />
        <Card className="text-center py-12 shadow-md">
          <CardHeader>
            <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" />
            <CardTitle className="font-headline text-2xl">This Page Has Moved</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="mb-6">
              To better support family and group subscriptions, we've moved this functionality to the new "My Family" page.
            </CardDescription>
            <Button asChild>
              <Link href="/family">
                Go to My Family
              </Link>
            </Button>
          </CardContent>
        </Card>
    </>
  );
}
