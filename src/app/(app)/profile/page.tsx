
"use client";

import React from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { User, Mail, Phone, Edit3, Shield, LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { UserRole } from '@/types'; // Assuming UserRole enum is defined here

// Mock user data - replace with actual data fetching
const mockUser = {
  fullName: "Alex Johnson",
  email: "alex.johnson@example.com",
  phone: "555-123-4567",
  role: UserRole.STUDENT, // Or UserRole.PARENT, UserRole.DRIVER
  avatarUrl: "https://placehold.co/128x128.png?text=AJ",
  dataAiHint: "professional portrait",
  bio: "Loves carpooling and making new friends on the go. Enjoys coding and soccer.",
  preferences: {
    notifications: "Email & Push",
    preferredPickupRadius: "5 miles",
  },
  address: {
    street: "123 Main Street",
    city: "Anytown",
    state: "CA",
    zip: "90210"
  }
};

export default function ProfilePage() {
  // In a real app, fetch user data here or pass as props

  return (
    <>
      <PageHeader
        title="My Profile"
        description="View and manage your account details."
        actions={
          <Button variant="outline" asChild>
            <Link href="/profile/edit">
              <Edit3 className="mr-2 h-4 w-4" /> Edit Profile
            </Link>
          </Button>
        }
      />

      <div className="grid gap-8 md:grid-cols-3">
        <div className="md:col-span-1">
          <Card className="shadow-lg text-center">
            <CardHeader>
              <Avatar className="h-32 w-32 mx-auto mb-4 border-4 border-primary">
                <AvatarImage src={mockUser.avatarUrl} alt={mockUser.fullName} data-ai-hint={mockUser.dataAiHint} />
                <AvatarFallback>{mockUser.fullName.split(" ").map(n=>n[0]).join("")}</AvatarFallback>
              </Avatar>
              <CardTitle className="font-headline text-2xl">{mockUser.fullName}</CardTitle>
              <CardDescription className="capitalize">{mockUser.role}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground px-4">{mockUser.bio}</p>
              <Separator className="my-4" />
              <div className="space-y-3 text-left">
                <div className="flex items-center text-sm">
                  <Mail className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{mockUser.email}</span>
                </div>
                <div className="flex items-center text-sm">
                  <Phone className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{mockUser.phone}</span>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="mt-6 shadow-lg">
             <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
             </CardHeader>
             <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start" asChild>
                    <Link href="/settings"><Settings className="mr-2 h-4 w-4" /> Account Settings</Link>
                </Button>
                <Button variant="outline" className="w-full justify-start" asChild>
                    <Link href="/parent/approvals"><Shield className="mr-2 h-4 w-4" /> Driver Approvals</Link>
                </Button>
                <Button variant="destructive" className="w-full justify-start" asChild>
                     <Link href="/logout">
                        <LogOut className="mr-2 h-4 w-4" /> Log Out
                     </Link>
                </Button>
             </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>Details about your account and preferences.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input id="fullName" value={mockUser.fullName} readOnly className="mt-1 bg-muted/50" />
                </div>
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input id="email" type="email" value={mockUser.email} readOnly className="mt-1 bg-muted/50" />
                </div>
              </div>
               <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input id="phone" type="tel" value={mockUser.phone} readOnly className="mt-1 bg-muted/50" />
                </div>
              <div>
                <Label htmlFor="address">Address</Label>
                <Input id="addressStreet" value={mockUser.address.street} readOnly className="mt-1 bg-muted/50" />
                <div className="grid grid-cols-3 gap-2 mt-2">
                    <Input id="addressCity" placeholder="City" value={mockUser.address.city} readOnly className="bg-muted/50" />
                    <Input id="addressState" placeholder="State" value={mockUser.address.state} readOnly className="bg-muted/50" />
                    <Input id="addressZip" placeholder="Zip" value={mockUser.address.zip} readOnly className="bg-muted/50" />
                </div>
              </div>
              <Separator />
              <h3 className="text-md font-semibold text-muted-foreground">Preferences</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="notifications">Notification Preferences</Label>
                  <Input id="notifications" value={mockUser.preferences.notifications} readOnly className="mt-1 bg-muted/50" />
                </div>
                <div>
                  <Label htmlFor="pickupRadius">Preferred Pickup Radius</Label>
                  <Input id="pickupRadius" value={mockUser.preferences.preferredPickupRadius} readOnly className="mt-1 bg-muted/50" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
