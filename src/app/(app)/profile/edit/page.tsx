
"use client";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
// Label import is already implicitly handled by FormLabel from "@/components/ui/form"
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { ArrowLeft, Edit3, Loader2, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserRole, type UserProfileData } from "@/types"; // Import UserProfileData
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";


const profileEditFormSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters."),
  avatarUrl: z.string().url("Please enter a valid URL for the avatar.").or(z.literal("")).optional(),
  dataAiHint: z.string().optional(),
  bio: z.string().max(500, "Bio cannot exceed 500 characters.").optional(),
  phone: z.string().optional(), 
  
  addrStreet: z.string().optional(),
  addrCity: z.string().optional(),
  addrState: z.string().optional(),
  addrZip: z.string().optional(),

  canDrive: z.boolean().optional(),
  driverAgeRange: z.string().optional(),
  driverExperience: z.string().optional(),
  driverVehicle: z.string().optional(),
  driverCapacity: z.string().optional(),
});

type ProfileEditFormValues = z.infer<typeof profileEditFormSchema>;

export default function EditProfilePage() {
  const { user: authUser, userProfile: authUserProfile, loading: authLoading, isLoadingProfile: isLoadingContextProfile } = useAuth(); // Use userProfile from context
  const [localUserProfile, setLocalUserProfile] = useState<UserProfileData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<ProfileEditFormValues>({
    resolver: zodResolver(profileEditFormSchema),
    defaultValues: {
      fullName: "",
      avatarUrl: "",
      dataAiHint: "",
      bio: "",
      phone: "",
      addrStreet: "",
      addrCity: "",
      addrState: "",
      addrZip: "",
      canDrive: false,
      driverAgeRange: "",
      driverExperience: "",
      driverVehicle: "",
      driverCapacity: "",
    },
  });

  useEffect(() => {
    if (!isLoadingContextProfile && authUserProfile) {
        setLocalUserProfile(authUserProfile);
        form.reset({
            fullName: authUserProfile.fullName || "",
            avatarUrl: authUserProfile.avatarUrl || "",
            dataAiHint: authUserProfile.dataAiHint || "",
            bio: authUserProfile.bio || "",
            phone: authUserProfile.phone || "",
            addrStreet: authUserProfile.address?.street || "",
            addrCity: authUserProfile.address?.city || "",
            addrState: authUserProfile.address?.state || "",
            addrZip: authUserProfile.address?.zip || "",
            canDrive: authUserProfile.canDrive || false,
            driverAgeRange: authUserProfile.driverDetails?.ageRange || "",
            driverExperience: authUserProfile.driverDetails?.drivingExperience || "",
            driverVehicle: authUserProfile.driverDetails?.primaryVehicle || "",
            driverCapacity: authUserProfile.driverDetails?.passengerCapacity || "",
        });
    } else if (!authLoading && !isLoadingContextProfile && !authUserProfile && authUser) {
        // User authenticated but profile doesn't exist in context (might be new or error)
        // Attempt to fetch directly once more, or redirect if truly missing
        async function fetchDirectProfile() {
            const userDocRef = doc(db, "users", authUser!.uid);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
                const data = userDocSnap.data() as UserProfileData;
                setLocalUserProfile(data);
                form.reset({ /* ... populate form as above ... */ });
            } else {
                toast({ title: "Error", description: "User profile not found.", variant: "destructive" });
                router.push("/profile");
            }
        }
        fetchDirectProfile();
    } else if (!authLoading && !authUser) {
        router.push("/login");
    }
  }, [authUser, authUserProfile, authLoading, isLoadingContextProfile, router, form, toast]);


  async function onSubmit(data: ProfileEditFormValues) {
    if (!authUser || !localUserProfile) {
      toast({ title: "Error", description: "User not authenticated or profile not loaded.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const userDocRef = doc(db, "users", authUser.uid);
      const updatedData: Partial<Omit<UserProfileData, 'role' | 'email' | 'uid' | 'createdAt'>> = {
        fullName: data.fullName,
        avatarUrl: data.avatarUrl,
        dataAiHint: data.dataAiHint,
        bio: data.bio,
        phone: data.phone,
        // Preferences are now managed on the settings page
        address: {
          street: data.addrStreet,
          city: data.addrCity,
          state: data.addrState,
          zip: data.addrZip,
        },
        canDrive: data.canDrive,
        driverDetails: data.canDrive ? {
          ageRange: data.driverAgeRange,
          drivingExperience: data.driverExperience,
          primaryVehicle: data.driverVehicle,
          passengerCapacity: data.driverCapacity,
        } : {}, 
      };

      await updateDoc(userDocRef, updatedData);
      toast({ title: "Profile Updated", description: "Your profile has been successfully updated." });
      router.push("/profile");
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({ title: "Update Failed", description: "Could not update your profile. Please try again.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (authLoading || isLoadingContextProfile || (!localUserProfile && authUser)) { // Show loader if context profile is loading OR local is still null but authUser exists
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Loading profile editor...</p>
      </div>
    );
  }

  if (!localUserProfile) { // Handles case where user is not logged in OR profile truly doesn't exist after loading
    return (
        <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
            <p className="text-muted-foreground">Could not load profile data. Please ensure you are logged in.</p>
        </div>
    );
  }


  return (
    <>
      <PageHeader
        title="Edit Profile"
        description="Update your personal information and preferences."
        actions={
          <Button variant="outline" asChild>
            <Link href="/profile">
              <ArrowLeft className="mr-2 h-4 w-4" /> Cancel
            </Link>
          </Button>
        }
      />
      <Card className="w-full max-w-2xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Your Information</CardTitle>
          <CardDescription>Make changes to your profile below. Email and Role are not editable.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormItem>
                  <FormLabel htmlFor="email-display">Email Address</FormLabel>
                  <Input id="email-display" value={localUserProfile.email} readOnly className="bg-muted/50" />
                  <FormDescription className="text-xs">Email cannot be changed.</FormDescription>
                </FormItem>
                <FormItem>
                  <FormLabel htmlFor="role-display">Your Role</FormLabel>
                  <Input id="role-display" value={localUserProfile.role.charAt(0).toUpperCase() + localUserProfile.role.slice(1)} readOnly className="bg-muted/50 capitalize" />
                  <FormDescription className="text-xs">Role is set at signup and cannot be changed.</FormDescription>
                </FormItem>
              </div>

              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="avatarUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Avatar URL</FormLabel>
                    <FormControl><Input type="url" placeholder="https://example.com/avatar.png" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="dataAiHint"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Avatar AI Hint (Optional)</FormLabel>
                    <FormControl><Input placeholder="e.g., man smiling" {...field} /></FormControl>
                    <FormDescription className="text-xs">Helps AI understand the image if a placeholder is used or for accessibility.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="bio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bio (Optional)</FormLabel>
                    <FormControl><Textarea placeholder="Tell us a little about yourself..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number (Optional)</FormLabel>
                    <FormControl><Input type="tel" placeholder="e.g., (555) 123-4567" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <h3 className="text-lg font-semibold pt-4 border-t">Address</h3>
              <FormField control={form.control} name="addrStreet" render={({ field }) => (<FormItem><FormLabel>Street</FormLabel><FormControl><Input placeholder="123 Main St" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={form.control} name="addrCity" render={({ field }) => (<FormItem><FormLabel>City</FormLabel><FormControl><Input placeholder="Anytown" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="addrState" render={({ field }) => (<FormItem><FormLabel>State</FormLabel><FormControl><Input placeholder="CA" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="addrZip" render={({ field }) => (<FormItem><FormLabel>Zip Code</FormLabel><FormControl><Input placeholder="90210" {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>

              <div className="pt-4 border-t">
                <FormField
                    control={form.control}
                    name="canDrive"
                    render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md p-3 border bg-muted/20">
                        <FormControl>
                        <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                        />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                        <FormLabel className="text-base cursor-pointer">
                            I can drive
                        </FormLabel>
                        <FormDescription className="text-xs">
                            Check this if you are able and willing to be a driver for rydz.
                        </FormDescription>
                        </div>
                    </FormItem>
                    )}
                />
              </div>

              {form.watch("canDrive") && (
                <div className="space-y-6 pl-4 border-l-2 border-primary/30 ml-2 pt-2 pb-4 animate-accordion-down">
                  <h3 className="text-md font-semibold text-primary">Driver Details</h3>
                  <FormField control={form.control} name="driverAgeRange" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Age Range</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select age range" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="16-18">16-18</SelectItem>
                          <SelectItem value="19-23">19-23</SelectItem>
                          <SelectItem value="24+">24+</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="driverExperience" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Driving Experience</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select driving experience" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="0-6m">0-6 months</SelectItem>
                          <SelectItem value="6m-1y">6 months - 1 year</SelectItem>
                          <SelectItem value="1-3y">1-3 years</SelectItem>
                          <SelectItem value="3-5y">3-5 years</SelectItem>
                          <SelectItem value="5y+">5+ years</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="driverVehicle" render={({ field }) => (
                    <FormItem><FormLabel>Primary Vehicle</FormLabel><FormControl><Input placeholder="e.g., Toyota Camry 2020, Blue" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="driverCapacity" render={({ field }) => (
                    <FormItem><FormLabel>Passenger Capacity (excluding driver)</FormLabel><FormControl><Input type="number" placeholder="e.g., 4" min="1" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
              )}


              <Button type="submit" className="w-full !mt-8" disabled={isSubmitting || authLoading || isLoadingContextProfile}>
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
    </>
  );
}
