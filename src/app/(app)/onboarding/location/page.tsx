
'use client';

import React, { useState } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowRight, Home, Briefcase, School, MapPin } from "lucide-react";

const locationFormSchema = z.object({
  name: z.string().min(2, { message: "Location name must be at least 2 characters." }),
  address: z.string().min(5, { message: "Address must be at least 5 characters." }),
  icon: z.enum(['Home', 'Briefcase', 'School', 'MapPin']).default('MapPin'),
});

type LocationFormValues = z.infer<typeof locationFormSchema>;

export default function OnboardingLocationPage() {
  const { user, refreshUserProfile } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<LocationFormValues>({
    resolver: zodResolver(locationFormSchema),
    defaultValues: {
      name: "Home",
      address: "",
      icon: "Home",
    },
  });

  async function onSubmit(data: LocationFormValues) {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const newLocation = {
        id: `loc_${Date.now()}`,
        name: data.name,
        address: data.address,
        icon: data.icon,
      };

      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        savedLocations: [newLocation],
        defaultLocationId: newLocation.id
      });
      
      await refreshUserProfile();
      
      toast({
        title: "Location Saved!",
        description: "Your default location has been set.",
      });
      
      router.push('/onboarding/family');
    } catch (error: any) {
      toast({
        title: "Error Saving Location",
        description: error.message || "Could not save your location.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl">Set Your Default Location</CardTitle>
        <CardDescription>This will be your primary pickup/drop-off spot. You can add more later.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Home, Work" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Address</FormLabel>
                  <FormControl>
                    <Input placeholder="123 Main St, Anytown, CA 90210" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="icon"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Icon</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an icon" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Home"><span className="flex items-center"><Home className="mr-2 h-4 w-4"/> Home</span></SelectItem>
                      <SelectItem value="Briefcase"><span className="flex items-center"><Briefcase className="mr-2 h-4 w-4"/> Work</span></SelectItem>
                      <SelectItem value="School"><span className="flex items-center"><School className="mr-2 h-4 w-4"/> School</span></SelectItem>
                      <SelectItem value="MapPin"><span className="flex items-center"><MapPin className="mr-2 h-4 w-4"/> Other</span></SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <>Next <ArrowRight className="ml-2 h-4 w-4" /></>}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
