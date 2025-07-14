
"use client";

import React, { useState } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { purgeAllEventsAction, purgeAllRydzAction, purgeAllActiveRydzAction } from '@/actions/adminActions';
import { Loader2, AlertTriangle, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const dynamic = 'force-dynamic';

type PurgeableCollection = 'events' | 'rydz' | 'activeRydz';

export default function PurgeDataPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState<Record<PurgeableCollection, boolean>>({
    events: false,
    rydz: false,
    activeRydz: false,
  });

  const handlePurge = async (collection: PurgeableCollection) => {
    setIsLoading(prev => ({ ...prev, [collection]: true }));
    let action;
    switch (collection) {
      case 'events':
        action = purgeAllEventsAction;
        break;
      case 'rydz':
        action = purgeAllRydzAction;
        break;
      case 'activeRydz':
        action = purgeAllActiveRydzAction;
        break;
      default:
        toast({ title: "Error", description: "Unknown collection to purge.", variant: "destructive" });
        setIsLoading(prev => ({ ...prev, [collection]: false }));
        return;
    }

    try {
      const result = await action();
      if (result.success) {
        toast({ title: "Purge Successful", description: result.message });
      } else {
        toast({ title: "Purge Failed", description: result.message, variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Client-Side Error", description: `An error occurred: ${error.message}`, variant: "destructive" });
    } finally {
      setIsLoading(prev => ({ ...prev, [collection]: false }));
    }
  };
  
  const PurgeButton = ({ collection, label }: { collection: PurgeableCollection, label: string }) => (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" disabled={isLoading[collection]}>
          {isLoading[collection] ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
          Purge All {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete all documents from the "{collection}" collection.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => handlePurge(collection)} className="bg-destructive hover:bg-destructive/90">Continue</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return (
    <>
      <PageHeader
        title="Data Purge Utility"
        description="Use these tools to permanently delete all data from specific collections. This is irreversible."
      />
      <Card className="w-full max-w-lg mx-auto">
        <CardHeader>
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5"/>
            <CardTitle>Danger Zone</CardTitle>
          </div>
          <CardDescription>
            These actions will wipe entire collections from your database. Proceed with extreme caution.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center p-4 border border-destructive/20 rounded-md">
            <p className="font-medium">Events Collection</p>
            <PurgeButton collection="events" label="Events" />
          </div>
          <div className="flex justify-between items-center p-4 border border-destructive/20 rounded-md">
            <p className="font-medium">Ryd Requests Collection ('rydz')</p>
            <PurgeButton collection="rydz" label="Ryd Requests" />
          </div>
          <div className="flex justify-between items-center p-4 border border-destructive/20 rounded-md">
            <p className="font-medium">Active Rydz Collection ('activeRydz')</p>
            <PurgeButton collection="activeRydz" label="Active Rydz" />
          </div>
        </CardContent>
      </Card>
    </>
  );
}
