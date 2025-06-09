
"use client";

import React, { useState } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Edit3, Trash2, Home, Briefcase, School, MapPin, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";

interface SavedLocation {
  id: string;
  name: string;
  address: string;
  icon?: React.ElementType; // For specific icons like Home, Briefcase, School
}

const locationFormSchema = z.object({
  name: z.string().min(2, { message: "Location name must be at least 2 characters." }),
  address: z.string().min(5, { message: "Address must be at least 5 characters." }),
});

type LocationFormValues = z.infer<typeof locationFormSchema>;

const initialMockLocations: SavedLocation[] = [
  { id: "loc1", name: "Home", address: "123 Main Street, Anytown, CA 90210", icon: Home },
  { id: "loc2", name: "Work", address: "456 Business Ave, Metropolis, NY 10001", icon: Briefcase },
  { id: "loc3", name: "Northwood High", address: "789 Education Rd, Anytown, CA 90210", icon: School },
];

export default function MyLocationsPage() {
  const { toast } = useToast();
  const [locations, setLocations] = useState<SavedLocation[]>(initialMockLocations);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<SavedLocation | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const form = useForm<LocationFormValues>({
    resolver: zodResolver(locationFormSchema),
    defaultValues: {
      name: "",
      address: "",
    },
  });

  const handleOpenDialog = (location?: SavedLocation) => {
    if (location) {
      setIsEditMode(true);
      setCurrentLocation(location);
      form.reset({ name: location.name, address: location.address });
    } else {
      setIsEditMode(false);
      setCurrentLocation(null);
      form.reset({ name: "", address: "" });
    }
    setIsDialogOpen(true);
  };

  const handleDeleteLocation = (locationId: string) => {
    setLocations(prev => prev.filter(loc => loc.id !== locationId));
    toast({
      title: "Location Removed",
      description: "The location has been successfully removed.",
      variant: "destructive"
    });
  };

  function onSubmit(data: LocationFormValues) {
    setIsSubmitting(true);
    // Simulate API call
    setTimeout(() => {
      if (isEditMode && currentLocation) {
        setLocations(prev => prev.map(loc => loc.id === currentLocation.id ? { ...loc, ...data } : loc));
        toast({ title: "Location Updated", description: `"${data.name}" has been updated.` });
      } else {
        const newLocation: SavedLocation = {
          id: `loc${Date.now()}`,
          name: data.name,
          address: data.address,
          icon: MapPin, // Default icon for new locations
        };
        setLocations(prev => [newLocation, ...prev]);
        toast({ title: "Location Added", description: `"${data.name}" has been added to your locations.` });
      }
      setIsSubmitting(false);
      setIsDialogOpen(false);
      form.reset({ name: "", address: "" });
    }, 1000);
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
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter the full address" {...field} />
                        </FormControl>
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
            const IconComponent = location.icon || MapPin;
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
                  <p className="text-sm text-muted-foreground">{location.address}</p>
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
