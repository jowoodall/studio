
"use client";

import React, { useState, useEffect } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Edit3, Trash2, Home, Briefcase, School, MapPin, Loader2, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import type { SavedLocation } from '@/types';
import Link from 'next/link';

const locationFormSchema = z.object({
  name: z.string().min(2, { message: "Location name must be at least 2 characters." }),
  street: z.string().min(3, { message: "Street address must be at least 3 characters." }),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  icon: z.enum(['Home', 'Briefcase', 'School', 'MapPin']).default('MapPin'),
});

type LocationFormValues = z.infer<typeof locationFormSchema>;

const iconMap: { [key: string]: React.ElementType } = {
  Home,
  Briefcase,
  School,
  MapPin,
};

const formatAddress = (address: SavedLocation['address']) => {
  if (!address) return "No address provided";
  const cityState = [address.city, address.state].filter(Boolean).join(', ');
  const fullLine = [cityState, address.zip].filter(Boolean).join(' ');
  return [address.street, fullLine].filter(Boolean).join(', ');
};

export default function MyLocationsPage() {
  const { toast } = useToast();
  const { user, userProfile, loading: authLoading, isLoadingProfile } = useAuth();

  const [locations, setLocations] = useState<SavedLocation[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<SavedLocation | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    if (userProfile?.savedLocations) {
      setLocations(userProfile.savedLocations);
    } else {
      setLocations([]);
    }
  }, [userProfile]);

  const form = useForm<LocationFormValues>({
    resolver: zodResolver(locationFormSchema),
    defaultValues: {
      name: "",
      street: "",
      city: "",
      state: "",
      zip: "",
      icon: "MapPin",
    },
  });

  const handleOpenDialog = (location?: SavedLocation) => {
    if (location) {
      setIsEditMode(true);
      setCurrentLocation(location);
      form.reset({ 
        name: location.name,
        street: location.address.street || "",
        city: location.address.city || "",
        state: location.address.state || "",
        zip: location.address.zip || "",
        icon: location.icon 
      });
    } else {
      setIsEditMode(false);
      setCurrentLocation(null);
      form.reset({ name: "", street: "", city: "", state: "", zip: "", icon: "MapPin" });
    }
    setIsDialogOpen(true);
  };

  const handleDatabaseUpdate = async (updatedLocations: SavedLocation[]) => {
    if (!user) {
      toast({ title: "Not Authenticated", description: "You must be logged in to manage locations.", variant: "destructive" });
      return false;
    }
    setIsSubmitting(true);
    try {
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, { savedLocations: updatedLocations });
      setLocations(updatedLocations); // Optimistic update on success
      return true;
    } catch (error: any) {
      console.error("Error updating locations:", error);
      toast({ title: "Update Failed", description: error.message || "Could not save changes to the database.", variant: "destructive" });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLocation = async (locationId: string) => {
    const updatedLocations = locations.filter(loc => loc.id !== locationId);
    const success = await handleDatabaseUpdate(updatedLocations);
    if (success) {
      toast({ title: "Location Removed", description: "The location has been successfully removed." });
    }
  };

  async function onSubmit(data: LocationFormValues) {
    let updatedLocations: SavedLocation[];
    let success = false;

    const newAddress = {
      street: data.street,
      city: data.city || "",
      state: data.state || "",
      zip: data.zip || "",
    };

    if (isEditMode && currentLocation) {
      updatedLocations = locations.map(loc =>
        loc.id === currentLocation.id ? { ...loc, name: data.name, icon: data.icon, address: newAddress } : loc
      );
      success = await handleDatabaseUpdate(updatedLocations);
      if (success) {
        toast({ title: "Location Updated", description: `"${data.name}" has been updated.` });
      }
    } else {
      const newLocation: SavedLocation = {
        id: `loc_${Date.now()}`,
        name: data.name,
        address: newAddress,
        icon: data.icon,
      };
      updatedLocations = [newLocation, ...locations];
      success = await handleDatabaseUpdate(updatedLocations);
      if (success) {
        toast({ title: "Location Added", description: `"${data.name}" has been added to your locations.` });
      }
    }

    if (success) {
      setIsDialogOpen(false);
      form.reset({ name: "", street: "", city: "", state: "", zip: "", icon: "MapPin" });
    }
  }
  
  const isLoading = authLoading || isLoadingProfile;
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
        <p className="text-muted-foreground px-4">You must be logged in to manage your locations.</p>
        <Button asChild className="mt-4"><Link href="/login">Log In</Link></Button>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="My Locations"
        description="Manage your frequently used addresses for quick access."
        actions={
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Location
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>{isEditMode ? "Edit Location" : "Add New Location"}</DialogTitle>
                <DialogDescription>
                  {isEditMode ? "Update the details for this location." : "Enter a name and address for your new location."}
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Home, Mom's House, Gym" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="street"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Street Address</FormLabel>
                        <FormControl>
                          <Input placeholder="123 Main St" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl><Input placeholder="Anytown" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>State</FormLabel>
                          <FormControl><Input placeholder="CA" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="zip"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Zip</FormLabel>
                          <FormControl><Input placeholder="90210" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
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
                  <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (isEditMode ? "Save Changes" : "Add Location")}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        }
      />

      {locations.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {locations.map((location) => {
            const IconComponent = iconMap[location.icon] || MapPin;
            return (
              <Card key={location.id} className="shadow-lg">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <IconComponent className="h-6 w-6 text-primary" />
                      <CardTitle className="font-headline text-lg">{location.name}</CardTitle>
                    </div>
                    <div className="flex items-center gap-1">
                       <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(location)} aria-label="Edit location">
                         <Edit3 className="h-4 w-4" />
                       </Button>
                       <Button variant="ghost" size="icon" onClick={() => handleDeleteLocation(location.id)} className="text-destructive hover:text-destructive hover:bg-destructive/10" aria-label="Delete location">
                         <Trash2 className="h-4 w-4" />
                       </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{formatAddress(location.address)}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="text-center py-12 shadow-md">
          <CardHeader>
            <MapPin className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <CardTitle className="font-headline text-2xl">No Saved Locations</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="mb-6">
              You haven't added any locations yet. Add one to get started!
            </CardDescription>
            <Button onClick={() => handleOpenDialog()}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Your First Location
            </Button>
          </CardContent>
        </Card>
      )}
    </>
  );
}
