
"use client"; // Needs to be a client component to include the form

import React, { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { UpdatePasswordForm } from "@/components/auth/update-password-form";
import { Cog, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

const notificationSettingsSchema = z.object({
  prefNotifications: z.string(),
});

type NotificationSettingsFormValues = z.infer<typeof notificationSettingsSchema>;

export default function SettingsPage() {
  const { user, userProfile, loading: authLoading, isLoadingProfile } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<NotificationSettingsFormValues>({
    resolver: zodResolver(notificationSettingsSchema),
    defaultValues: {
      prefNotifications: "email",
    }
  });
  
  useEffect(() => {
    if (userProfile?.preferences?.notifications) {
      form.setValue("prefNotifications", userProfile.preferences.notifications);
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
        "preferences.notifications": data.prefNotifications,
      });
      toast({ title: "Settings Saved", description: "Your notification preference has been updated." });
    } catch (error: any) {
      toast({ title: "Update Failed", description: "Could not save your settings.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }


  return (
    <>
      <PageHeader
        title="Account Settings"
        description="Manage your password and notification preferences."
      />
      <div className="max-w-xl mx-auto space-y-8">
        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>Choose how you receive notifications from MyRydz.</CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                         <FormField
                            control={form.control}
                            name="prefNotifications"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Notification Type</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                    <SelectValue placeholder="Select notification preference" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="email">Email</SelectItem>
                                    <SelectItem value="push">Push Notifications (coming soon)</SelectItem>
                                    <SelectItem value="none">None</SelectItem>
                                </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <Button type="submit" className="w-full" disabled={isSubmitting || authLoading || isLoadingProfile}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save Preferences"}
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>

        <UpdatePasswordForm />
        
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Other Settings</CardTitle>
            <CardDescription>
              Additional account management options will be available here in the future.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mt-4 p-6 border-2 border-dashed border-muted rounded-md text-center text-muted-foreground">
              <p>Privacy Settings Placeholder</p>
              <p className="text-sm">Control what information is visible to others.</p>
            </div>
          </CardContent>
        </Card>

      </div>
    </>
  );
}
