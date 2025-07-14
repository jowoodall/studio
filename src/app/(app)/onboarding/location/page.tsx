
'use client';

import React, { useState } from 'react';
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
import { Loader2, ArrowRight, Home, Briefcase, School, MapPin, PlusCircle, Trash2, Star } from "lucide-react";
import type { SavedLocation } from '@/types';
import { cn } from '@/lib/utils';

const locationFormSchema = z.object({
  name: z.string().min(2, { message: "Location name must be at least 2 characters." }),
  address: z.string().min(5, { message: "Address must be at least 5 characters." }),
  icon: z.enum(['Home', 'Briefcase', 'School', 'MapPin']).default('MapPin'),
});

type LocationFormValues = z.infer<typeof locationFormSchema>;

const iconMap: { [key: string]: React.ElementType } = {
  Home,
  Briefcase,
  School,
  MapPin,
};

export default function OnboardingLocationPage() {
  const { user, refreshUserProfile } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);

  const form = useForm<LocationFormValues>({
    resolver: zodResolver(locationFormSchema),
    defaultValues: {
      name: "",
      address: "",
      icon: "MapPin",
    },
  });

  function handleAddLocation(data: LocationFormValues) {
    const newLocation: SavedLocation = {
      id: `loc_${Date.now()}`,
      ...data,
    };
    setSavedLocations(prev => [...prev, newLocation]);
    toast({
      title: "Location Added",
      description: `"${data.name}" has been added to your list.`,
    });
    form.reset();
  }

  function handleDeleteLocation(id: string) {
    setSavedLocations(prev => prev.filter(loc => loc.id !== id));
  }

  async function handleFinishStep() {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    if (savedLocations.length === 0) {
        toast({ title: "One Location Required", description: "Please add at least one location to continue.", variant: "destructive" });
        return;
    }

    setIsSubmitting(true);
    try {
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        savedLocations: savedLocations,
        defaultLocationId: savedLocations[0].id // First one is default
      });
      
      await refreshUserProfile(); // Ensure this await completes before moving on
      
      toast({
        title: "Locations Saved!",
        description: "Your locations have been saved to your profile.",
      });
      
      router.push('/onboarding/family');
    } catch (error: any) {
      toast({
        title: "Error Saving Locations",
        description: error.message || "Could not save your locations.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
        <Card className="shadow-xl">
            <CardHeader>
                <CardTitle className="text-2xl">Add Your Locations</CardTitle>
                <CardDescription>Add your frequently used addresses like home, school, or work. The first one will be your default.</CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleAddLocation)} className="space-y-4">
                        <div className="grid md:grid-cols-2 gap-4">
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
                        </div>
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
                        <Button type="submit" variant="secondary" className="w-full md:w-auto">
                            <PlusCircle className="mr-2 h-4 w-4" /> Add This Location
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>

        {savedLocations.length > 0 && (
            <Card className="shadow-xl">
                <CardHeader>
                    <CardTitle>Your Saved Locations</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {savedLocations.map((location, index) => {
                         const IconComponent = iconMap[location.icon] || MapPin;
                         const isDefault = index === 0;
                        return (
                             <div key={location.id} className={cn("flex items-center justify-between p-3 border rounded-lg", isDefault && "border-primary")}>
                                <div className="flex items-center gap-3">
                                    <IconComponent className="h-5 w-5 text-muted-foreground" />
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-medium">{location.name}</p>
                                            {isDefault && <span className="text-xs font-semibold text-primary flex items-center gap-1"><Star className="h-3 w-3"/> Default</span>}
                                        </div>
                                        <p className="text-sm text-muted-foreground">{location.address}</p>
                                    </div>
                                </div>
                                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteLocation(location.id)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        )
                    })}
                </CardContent>
            </Card>
        )}

        <div className="flex justify-end">
            <Button onClick={handleFinishStep} disabled={isSubmitting || savedLocations.length === 0} size="lg">
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <>Next <ArrowRight className="ml-2 h-4 w-4" /></>}
            </Button>
        </div>
    </div>
  );
}
