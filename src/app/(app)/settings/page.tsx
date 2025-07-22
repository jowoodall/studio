
"use client"; // Needs to be a client component to include the form

import React, { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { UpdatePasswordForm } from "@/components/auth/update-password-form";
import { Cog, Loader2, LinkIcon, ExternalLinkIcon, CreditCard } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserRole, SubscriptionTier } from "@/types";
import Link from "next/link";

const notificationSettingsSchema = z.object({
  rydUpdates: z.object({
    email: z.boolean().default(false),
    text: z.boolean().default(false),
  }).default({ email: true, text: false }),
  groupActivity: z.object({
    email: z.boolean().default(false),
    text: z.boolean().default(false),
  }).default({ email: true, text: false }),
  parentalApprovals: z.object({
    email: z.boolean().default(false),
    text: z.boolean().default(false),
  }).default({ email: true, text: false }),
  chatMessages: z.object({
    email: z.boolean().default(false),
    text: z.boolean().default(false),
  }).default({ email: true, text: false }),
});

type NotificationSettingsFormValues = z.infer<typeof notificationSettingsSchema>;

const notificationTypes = [
  { id: 'rydUpdates', label: 'Ryd Updates', description: 'Driver assignments, cancellations, and time changes.' },
  { id: 'groupActivity', label: 'Group Activity', description: 'New members join your groups, or new events are posted.' },
  { id: 'parentalApprovals', label: 'Parental Approvals', description: 'When a student you manage requires ryd approval.', roles: [UserRole.PARENT] },
  { id: 'chatMessages', label: 'Ryd Chat Messages', description: 'Notifications for new messages in an active ryd.' },
] as const;


const exampleLinkedApps = [
  { id: 'teamsnap', name: 'TeamSnap', description: 'Sync team schedules and events.', connected: false, dataAiHint: 'sports team logo' },
  { id: 'band', name: 'BAND', description: 'Connect with your group calendars.', connected: true, dataAiHint: 'community app logo' },
  { id: 'googlecalendar', name: 'Google Calendar', description: 'Integrate your personal calendar.', connected: false, dataAiHint: 'calendar logo' },
  { id: 'outlookcalendar', name: 'Outlook Calendar', description: 'Link your work or personal calendar.', connected: true, dataAiHint: 'office app logo' },
];


export default function SettingsPage() {
  const { user, userProfile, loading: authLoading, isLoadingProfile, subscriptionTier } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<NotificationSettingsFormValues>({
    resolver: zodResolver(notificationSettingsSchema),
    defaultValues: {
      rydUpdates: { email: true, text: false },
      groupActivity: { email: true, text: false },
      parentalApprovals: { email: true, text: false },
      chatMessages: { email: true, text: false },
    },
  });
  
  useEffect(() => {
    if (userProfile?.preferences?.notifications) {
      form.reset({
        rydUpdates: userProfile.preferences.notifications.rydUpdates ?? { email: true, text: false },
        groupActivity: userProfile.preferences.notifications.groupActivity ?? { email: true, text: false },
        parentalApprovals: userProfile.preferences.notifications.parentalApprovals ?? { email: true, text: false },
        chatMessages: userProfile.preferences.notifications.chatMessages ?? { email: true, text: false },
      });
    }
  }, [userProfile, form]);

  async function onSubmit(data: NotificationSettingsFormValues) {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        "preferences.notifications": data,
      });
      toast({ title: "Settings Saved", description: "Your notification preferences have been updated." });
    } catch (error: any) {
      toast({ title: "Update Failed", description: "Could not save your settings.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }

  const isPremium = subscriptionTier === SubscriptionTier.PREMIUM || subscriptionTier === SubscriptionTier.ORGANIZATION;

  return (
    <>
      <PageHeader
        title="Account Settings"
        description="Manage your password and notification preferences."
      />
      <div className="max-w-xl mx-auto space-y-8">
        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Subscription & Billing
                </CardTitle>
                <CardDescription>View and manage your current subscription plan and payment details.</CardDescription>
            </CardHeader>
            <CardContent>
                <Button asChild className="w-full">
                    <Link href="/settings/subscription">
                        Manage Subscription
                    </Link>
                </Button>
            </CardContent>
        </Card>

        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>Choose how you receive notifications from MyRydz.</CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Notification Type</TableHead>
                              <TableHead className="text-center">Email</TableHead>
                              <TableHead className="text-center">Text (SMS)</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {notificationTypes.map((item) => {
                              if (item.roles && (!userProfile || !item.roles.includes(userProfile.role))) {
                                return null;
                              }
                              return (
                                <TableRow key={item.id}>
                                  <TableCell>
                                    <p className="font-medium">{item.label}</p>
                                    <p className="text-xs text-muted-foreground">{item.description}</p>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <FormField
                                      control={form.control}
                                      name={`${item.id}.email`}
                                      render={({ field }) => (
                                        <FormItem className="flex justify-center">
                                          <FormControl>
                                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                          </FormControl>
                                        </FormItem>
                                      )}
                                    />
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <FormField
                                      control={form.control}
                                      name={`${item.id}.text`}
                                      render={({ field }) => (
                                        <FormItem className="flex justify-center">
                                          <FormControl>
                                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                          </FormControl>
                                        </FormItem>
                                      )}
                                    />
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                        <Button type="submit" className="w-full" disabled={isSubmitting || authLoading || isLoadingProfile}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save Preferences"}
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>

        <UpdatePasswordForm />
        
        {isPremium && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LinkIcon className="h-5 w-5" />
                Linked Apps
              </CardTitle>
              <CardDescription>
                Connect MyRydz with other apps you use to sync schedules and events.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {exampleLinkedApps.map((app) => (
                  <div key={app.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
                    <div>
                      <p className="font-medium">{app.name}</p>
                      <p className="text-xs text-muted-foreground">{app.description}</p>
                    </div>
                    <Button variant={app.connected ? "outline" : "default"} size="sm" disabled> 
                      {app.connected ? <><ExternalLinkIcon className="mr-2 h-3 w-3" />Manage</> : "Connect"}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

      </div>
    </>
  );
}
