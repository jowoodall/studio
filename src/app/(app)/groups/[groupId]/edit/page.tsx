
"use client";

import React, { useEffect, useState, use } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
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
// Label import was confirmed to be present in previous steps, ensuring it's available.

// Mock group data - in a real app, you'd fetch this
// Added description and imageUrl to mock data
const mockGroupsData: { [key: string]: { name: string; description: string; imageUrl: string; dataAiHint?: string; } } = {
  "1": { name: "Morning School Run", description: "Daily carpool to Northwood High. Early birds get the aux!", imageUrl: "https://placehold.co/400x300.png?text=School+Run", dataAiHint: "school bus morning" },
  "2": { name: "Soccer Practice Crew", description: "Carpool for weekend soccer practice. Don't forget your cleats!", imageUrl: "https://placehold.co/400x300.png?text=Soccer+Practice", dataAiHint: "soccer team kids" },
  "3": { name: "Work Commute (Downtown)", description: "Shared rydz to downtown offices. Saving gas and sanity.", imageUrl: "https://placehold.co/400x300.png?text=Work+Commute", dataAiHint: "city skyline traffic" },
};

const groupEditFormSchema = z.object({
  groupName: z.string().min(3, "Group name must be at least 3 characters.").max(50, "Group name cannot exceed 50 characters."),
  description: z.string().max(200, "Description cannot exceed 200 characters.").optional(),
  imageUrl: z.string().url({ message: "Please enter a valid URL." }).or(z.literal("")).optional(), // Allow empty string or valid URL
});

type GroupEditFormValues = z.infer<typeof groupEditFormSchema>;

// Define the expected shape of the resolved params
interface ResolvedPageParams {
  groupId: string;
}

export default function EditGroupPage({ params: paramsPromise }: { params: Promise<ResolvedPageParams> }) {
  const params = use(paramsPromise); 
  const { groupId } = params || {}; 


  const { toast } = useToast();
  // Initialize groupDetails after groupId is resolved, or use null/undefined initially
  const [groupDetails, setGroupDetails] = useState(() => groupId ? mockGroupsData[groupId] : null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imagePreview, setImagePreview] = useState(groupDetails?.imageUrl || "");

  const form = useForm<GroupEditFormValues>({
    resolver: zodResolver(groupEditFormSchema),
    defaultValues: {
      groupName: groupDetails?.name || "",
      description: groupDetails?.description || "",
      imageUrl: groupDetails?.imageUrl || "",
    },
  });

  useEffect(() => {
    // This effect runs when groupId changes (after promise resolves)
    // or if form instance itself changes (less likely here)
    if (groupId) {
        const currentGroup = mockGroupsData[groupId];
        if (currentGroup) {
          setGroupDetails(currentGroup);
          form.reset({
              groupName: currentGroup.name,
              description: currentGroup.description,
              imageUrl: currentGroup.imageUrl,
          });
          setImagePreview(currentGroup.imageUrl);
        } else {
          // Group ID resolved, but no data found for it
          setGroupDetails(null); 
          form.reset({ groupName: "", description: "", imageUrl: "" });
          setImagePreview("");
        }
    }
  }, [groupId, form]);

  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'imageUrl') {
        // Ensure value.imageUrl is not undefined before setting
        setImagePreview(value.imageUrl || "");
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);


  if (!groupId) {
    // groupId is not yet resolved from the promise (React.use() is suspending)
    return (
        <div className="flex flex-col items-center justify-center h-full text-center py-10">
            <Loader2 className="w-16 h-16 text-muted-foreground animate-spin mb-4" />
            <p className="text-muted-foreground">Loading group details...</p>
        </div>
    );
  }
  
  // After groupId is resolved, check if groupDetails exist for that ID
  // This check relies on groupDetails state being updated by the useEffect above
  if (!groupDetails && groupId) { 
    // This means groupId is valid, but mockGroupsData[groupId] was undefined,
    // and setGroupDetails(null) has likely run.
    return (
    <div className="flex flex-col items-center justify-center h-full text-center py-10">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Group Not Found</h2>
        <p className="text-muted-foreground">The group with ID "{groupId}" could not be found.</p>
        <Button asChild className="mt-4">
        <Link href="/groups">Back to Groups</Link>
        </Button>
    </div>
    );
  }


  function onSubmit(data: GroupEditFormValues) {
    if (!groupId) { // Should not happen if loading state is correct
        toast({ title: "Error", description: "Group ID is missing.", variant: "destructive"});
        return;
    }
    setIsSubmitting(true);
    console.log("Updated Group Data:", { groupId, ...data });
    // Simulate API call
    setTimeout(() => {
      // Update mock data 
      mockGroupsData[groupId] = { ...mockGroupsData[groupId], ...data, dataAiHint: mockGroupsData[groupId]?.dataAiHint };
      setGroupDetails(mockGroupsData[groupId]); 

      toast({
        title: "Group Updated!",
        description: `The group "${data.groupName}" has been successfully updated.`,
      });
      setIsSubmitting(false);
    }, 1500);
  }
  
  return (
    <>
      <PageHeader
        title={`Edit Group: ${groupDetails?.name || `Group ${groupId}`}`}
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

              {imagePreview && (
                <div className="relative w-full aspect-video max-w-sm mx-auto rounded-md overflow-hidden border bg-muted">
                  <Image
                    src={imagePreview}
                    alt="Group image preview"
                    fill
                    className="object-cover"
                    data-ai-hint={groupDetails?.dataAiHint || "group image"}
                    onError={() => {
                      // console.warn("Failed to load image preview for URL:", imagePreview);
                      // setImagePreview(""); // Example: clear preview on error
                    }}
                  />
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isSubmitting}>
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
          <Link href="/groups">Back to Groups</Link>
        </Button>
      </div>
    </>
  );
}
