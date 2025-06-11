
"use client";

import React, { useEffect, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Edit, Loader2, Save, Image as ImageIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { GroupData } from "@/types";

const groupEditFormSchema = z.object({
  groupName: z.string().min(3, "Group name must be at least 3 characters.").max(50, "Group name cannot exceed 50 characters."),
  description: z.string().max(200, "Description cannot exceed 200 characters.").optional(),
  imageUrl: z.string().url({ message: "Please enter a valid URL." }).or(z.literal("")).optional(),
  dataAiHint: z.string().max(50, "AI hint cannot exceed 50 characters.").optional(),
});

type GroupEditFormValues = z.infer<typeof groupEditFormSchema>;

export default function EditGroupPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.groupId as string; // Get groupId from useParams

  const { toast } = useToast();
  const [groupDetails, setGroupDetails] = useState<GroupData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imagePreview, setImagePreview] = useState("");
  const [error, setError] = useState<string | null>(null);

  const form = useForm<GroupEditFormValues>({
    resolver: zodResolver(groupEditFormSchema),
    defaultValues: {
      groupName: "",
      description: "",
      imageUrl: "",
      dataAiHint: "",
    },
  });

  useEffect(() => {
    if (!groupId) {
      setError("Group ID is missing from URL.");
      setIsLoading(false);
      return;
    }

    const fetchGroupData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const groupDocRef = doc(db, "groups", groupId);
        const groupDocSnap = await getDoc(groupDocRef);

        if (groupDocSnap.exists()) {
          const data = groupDocSnap.data() as GroupData;
          setGroupDetails(data);
          form.reset({
            groupName: data.name,
            description: data.description,
            imageUrl: data.imageUrl || "",
            dataAiHint: data.dataAiHint || "",
          });
          setImagePreview(data.imageUrl || "");
        } else {
          setError(`Group with ID "${groupId}" not found.`);
          setGroupDetails(null);
        }
      } catch (e) {
        console.error("Error fetching group data:", e);
        setError("Failed to load group data. Please try again.");
        toast({
            title: "Error",
            description: "Could not load group information.",
            variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchGroupData();
  }, [groupId, form, toast]);

  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'imageUrl') {
        setImagePreview(value.imageUrl || "");
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  async function onSubmit(data: GroupEditFormValues) {
    if (!groupId) {
      toast({ title: "Error", description: "Group ID is missing.", variant: "destructive" });
      return;
    }
    if (!groupDetails) {
      toast({ title: "Error", description: "Group data not loaded.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const groupDocRef = doc(db, "groups", groupId);
      // Only update fields that are part of the form, retain other fields like createdBy, createdAt, memberIds, adminIds
      const updateData: Partial<GroupData> = {
        name: data.groupName,
        description: data.description || "", // Ensure description is not undefined
        imageUrl: data.imageUrl || "",
        dataAiHint: data.dataAiHint || "",
      };

      await updateDoc(groupDocRef, updateData);

      setGroupDetails(prev => prev ? { ...prev, ...updateData } : null);
      toast({
        title: "Group Updated!",
        description: `The group "${data.groupName}" has been successfully updated.`,
      });
      router.push(`/groups/${groupId}`); // Navigate back to group view page or groups list
    } catch (e) {
      console.error("Error updating group:", e);
      toast({
        title: "Update Failed",
        description: "Could not update group details. Please check your permissions and try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-10">
        <Loader2 className="w-16 h-16 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground">Loading group details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-10">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Error</h2>
        <p className="text-muted-foreground px-4">{error}</p>
        <Button asChild className="mt-4">
          <Link href="/groups">Back to Groups</Link>
        </Button>
      </div>
    );
  }
  
  if (!groupDetails && !isLoading) {
     // This case means loading is finished but groupDetails is still null (and no error string was set prior)
     // which implies the group was not found or another issue occurred.
    return (
    <div className="flex flex-col items-center justify-center h-full text-center py-10">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Group Not Found</h2>
        <p className="text-muted-foreground">The group with ID "{groupId}" could not be loaded or found.</p>
        <Button asChild className="mt-4">
          <Link href="/groups">Back to Groups</Link>
        </Button>
    </div>
    );
  }


  return (
    <>
      <PageHeader
        title={`Edit Group: ${groupDetails?.name || `Group`}`}
        description={`You are currently editing the details for ${groupDetails?.name || `Group ${groupId}`}.`}
      />
      <Card className="w-full max-w-xl mx-auto shadow-xl">
        <CardHeader>
           <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-2">
            <Edit className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-center font-headline text-xl">Edit Group Information</CardTitle>
          <CardDescription className="text-center">
            Modify the details of your carpool group below.
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
                      <Input placeholder="e.g., Morning Commute Crew" {...field} />
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
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="A brief description of the group, its purpose, or rules."
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
                      <span>
                        <ImageIcon className="mr-2 h-4 w-4 text-muted-foreground inline-block" />
                        {' Group Picture/Icon URL (Optional)'}
                      </span>
                    </FormLabel>
                    <FormControl>
                      <Input type="url" placeholder="https://example.com/image.png" {...field} />
                    </FormControl>
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


              {imagePreview && (
                <div className="relative w-full aspect-video max-w-sm mx-auto rounded-md overflow-hidden border bg-muted">
                  <Image
                    src={imagePreview}
                    alt="Group image preview"
                    fill
                    className="object-cover"
                    data-ai-hint={groupDetails?.dataAiHint || "group image"}
                  />
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isSubmitting || isLoading}>
                {isSubmitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                ) : (
                  <><Save className="mr-2 h-4 w-4" /> Save Changes</>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      <div className="text-center mt-6">
        <Button variant="link" asChild>
          <Link href={`/groups/${groupId}`}>Back to Group</Link>
        </Button>
      </div>
    </>
  );
}
