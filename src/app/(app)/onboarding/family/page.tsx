
'use client';

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowRight, CheckCircle2 } from "lucide-react";
import { createFamilyAction } from '@/actions/familyActions'; // Assuming this action exists

const createFamilyFormSchema = z.object({
  familyName: z.string().min(3, "Family name must be at least 3 characters.").max(50, "Family name cannot exceed 50 characters."),
});

type CreateFamilyFormValues = z.infer<typeof createFamilyFormSchema>;

export default function OnboardingFamilyPage() {
  const { user, refreshUserProfile } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CreateFamilyFormValues>({
    resolver: zodResolver(createFamilyFormSchema),
    defaultValues: { familyName: "" },
  });

  async function onFamilyCreate(data: CreateFamilyFormValues) {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await createFamilyAction({
        creatorId: user.uid,
        familyName: data.familyName,
      });

      if (result.success) {
        toast({ title: "Family Created!", description: result.message });
        await finishOnboarding();
      } else {
        toast({ title: "Creation Failed", description: result.message, variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: `An unexpected error occurred: ${error.message}`, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }
  
  const finishOnboarding = async () => {
    if (!user) return;
    setIsSubmitting(true);
    try {
        const userDocRef = doc(db, "users", user.uid);
        await updateDoc(userDocRef, { onboardingComplete: true });
        await refreshUserProfile();
        toast({
            title: "Setup Complete!",
            description: "You're all set to start using MyRydz.",
            icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
        });
        router.push('/dashboard');
    } catch (error: any) {
        toast({ title: "Error", description: "Could not finalize onboarding.", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <div className="grid md:grid-cols-2 gap-8 items-start">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle>Create a Family</CardTitle>
          <CardDescription>Set up a new family unit. You will be the first admin.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onFamilyCreate)} className="space-y-6">
              <FormField
                control={form.control}
                name="familyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Family Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., The Smith Family" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Create Family & Finish"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle>Join a Family</CardTitle>
          <CardDescription>If a family member has already invited you, you don't need to do anything. You can also skip this for now and join later.</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
                You can manage family invitations from the 'My Family' page after setup.
            </p>
          <Button onClick={finishOnboarding} variant="outline" className="w-full" disabled={isSubmitting}>
             {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <>Skip & Finish Setup <ArrowRight className="ml-2 h-4 w-4" /></>}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
