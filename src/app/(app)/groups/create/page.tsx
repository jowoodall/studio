
"use client";

import React, { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, PlusCircle, Users, Image as ImageIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, doc, writeBatch } from "firebase/firestore";
import { useRouter } from "next/navigation";
import type { GroupData } from "@/types";

const createGroupFormSchema = z.object({
  groupName: z.string().min(3, "Group name must be at least 3 characters.").max(50, "Group name cannot exceed 50 characters."),
  description: z.string().min(10, "Description must be at least 10 characters.").max(200, "Description cannot exceed 200 characters."),
  imageUrl: z.string().url({ message: "Please enter a valid URL for the group image." }).or(z.literal("")).optional(),
  dataAiHint: z.string().max(50, "AI hint cannot exceed 50 characters.").optional(),
});

type CreateGroupFormValues = z.infer<typeof createGroupFormSchema>;

export default function CreateGroupPage() {
  const { toast } = useToast();
  const { user: authUser, userProfile } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CreateGroupFormValues>({
    resolver: zodResolver(createGroupFormSchema),
    defaultValues: {
      groupName: "",
      description: "",
      imageUrl: "",
      dataAiHint: "",
    },
  });

  async function onSubmit(data: CreateGroupFormValues) {
    if (!authUser || !userProfile) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to create a group.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);
      const groupsCollectionRef = collection(db, "groups");
      
      // Data for the new group document
      const newGroupData = {
        name: data.groupName,
        description: data.description,
        imageUrl: data.imageUrl || "",
        dataAiHint: data.dataAiHint || "",
        createdBy: authUser.uid,
        createdAt: serverTimestamp(),
        memberIds: [authUser.uid],
        adminIds: [authUser.uid],
      };

      // Add new group document to a batch
      const newGroupRef = doc(groupsCollectionRef); // Create a ref with a new auto-generated ID
      batch.set(newGroupRef, newGroupData);

      // Update user's profile to include this new group ID
      const userDocRef = doc(db, "users", authUser.uid);
      const updatedJoinedGroupIds = [...(userProfile.joinedGroupIds || []), newGroupRef.id];
      batch.update(userDocRef, { joinedGroupIds: updatedJoinedGroupIds });
      
      await batch.commit();

      toast({
        title: "Group Created!",
        description: `The group "${data.groupName}" has been successfully created.`,
      });
      router.push(`/groups/${newGroupRef.id}`); // Redirect to the new group's page
    } catch (error) {
      console.error("Error creating group:", error);
      toast({
        title: "Failed to Create Group",
        description: "An error occurred while creating the group. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Create New Group"
        description="Fill in the details below to start a new carpool group."
      />
      <Card className="w-full max-w-xl mx-auto shadow-xl">
        <CardHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-2">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-center font-headline text-xl">Group Information</CardTitle>
          <CardDescription className="text-center">
            Set up your new group to start coordinating rydz.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="groupName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Group Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Morning Commute Crew, Soccer Team Parents" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="A brief description of the group, its purpose, or common destinations."
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="imageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center">
                        <ImageIcon className="mr-2 h-4 w-4 text-muted-foreground inline-block" />
                        Group Picture/Icon URL (Optional)
                    </FormLabel>
                    <FormControl>
                      <Input type="url" placeholder="https://example.com/group-image.png" {...field} />
                    </FormControl>
                    <FormDescription>Paste a URL to an image for your group.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="dataAiHint"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Group Image AI Hint (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., team logo, school mascot" {...field} />
                    </FormControl>
                    <FormDescription>Keywords describing the image (max 2 words), e.g., "soccer team".</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={isSubmitting || !authUser}>
                {isSubmitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating Group...</>
                ) : (
                  <><PlusCircle className="mr-2 h-4 w-4" /> Create Group</>
                )}
              </Button>
              {!authUser && (
                <p className="text-sm text-destructive text-center">You must be logged in to create a group.</p>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>
    </>
  );
}
