
"use client";

import React, { useState } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, PlusCircle, Users, ArrowLeft } from "lucide-react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useAuth } from '@/context/AuthContext';
import { useRouter } from "next/navigation";
import Link from 'next/link';
import { createFamilyAction } from '@/actions/familyActions';

const createFamilyFormSchema = z.object({
  familyName: z.string().min(3, "Family name must be at least 3 characters.").max(50, "Family name cannot exceed 50 characters."),
});

type CreateFamilyFormValues = z.infer<typeof createFamilyFormSchema>;

export default function CreateFamilyPage() {
  const { toast } = useToast();
  const { user: authUser, refreshUserProfile } = useAuth(); // Get refreshUserProfile from context
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CreateFamilyFormValues>({
    resolver: zodResolver(createFamilyFormSchema),
    defaultValues: {
      familyName: "",
    },
  });

  async function onSubmit(data: CreateFamilyFormValues) {
    if (!authUser) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to create a family.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createFamilyAction({
        creatorId: authUser.uid,
        familyName: data.familyName,
      });

      if (result.success && result.familyId) {
        toast({
          title: "Family Created!",
          description: result.message,
        });
        await refreshUserProfile(); // Refresh the profile data in the context
        router.push(`/family/${result.familyId}/manage`);
      } else {
        toast({
          title: "Creation Failed",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: `An unexpected error occurred: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Create New Family"
        description="Set up a new family unit to manage members and subscriptions."
        actions={
          <Button variant="outline" asChild>
            <Link href="/family">
                <ArrowLeft className="mr-2 h-4 w-4" /> Cancel
            </Link>
          </Button>
        }
      />
      <Card className="w-full max-w-xl mx-auto shadow-xl">
        <CardHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-2">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-center font-headline text-xl">Family Details</CardTitle>
          <CardDescription className="text-center">
            Give your family unit a name. You will be the first admin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="familyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Family Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., The Smith Family, Soccer Parents" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={isSubmitting || !authUser}>
                {isSubmitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating Family...</>
                ) : (
                  <><PlusCircle className="mr-2 h-4 w-4" /> Create Family</>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </>
  );
}
