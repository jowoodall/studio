
"use client";

import React, { useState } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { User, Mail, Phone, Edit3, Shield, LogOut, Settings, CarIcon, Users, UserCog } from "lucide-react";
import Link from "next/link";
import { UserRole } from '@/types';
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Mock user data - replace with actual data fetching
const mockUser = {
  fullName: "Alex Johnson",
  email: "alex.johnson@example.com",
  phone: "555-123-4567",
  role: UserRole.STUDENT, // Default role
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
  const [canDrive, setCanDrive] = useState(false);
  const [driverDetails, setDriverDetails] = useState({
    ageRange: "",
    drivingExperience: "",
    primaryVehicle: "",
    passengerCapacity: "",
  });

  // Role selection and parent/student management state
  const [selectedRole, setSelectedRole] = useState<UserRole>(mockUser.role);
  
  const [studentIdentifierInput, setStudentIdentifierInput] = useState("");
  const [managedStudents, setManagedStudents] = useState<string[]>([]);

  const [parentIdentifierInput, setParentIdentifierInput] = useState("");
  const [associatedParents, setAssociatedParents] = useState<string[]>([]);


  const handleAddStudent = () => {
    if (studentIdentifierInput.trim() !== "") {
      setManagedStudents(prev => [...prev, studentIdentifierInput.trim()]);
      setStudentIdentifierInput("");
    }
  };

  const handleAddParent = () => {
    if (parentIdentifierInput.trim() !== "") {
      setAssociatedParents(prev => [...prev, parentIdentifierInput.trim()]);
      setParentIdentifierInput("");
    }
  };
  
  const currentDisplayRole = selectedRole || mockUser.role;


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
              <CardDescription className="capitalize">{currentDisplayRole === UserRole.PARENT ? "Parent or Guardian" : currentDisplayRole}</CardDescription>
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
                { (selectedRole === UserRole.PARENT || mockUser.role === UserRole.PARENT) &&
                    <Button variant="outline" className="w-full justify-start" asChild>
                        <Link href="/parent/approvals"><Shield className="mr-2 h-4 w-4" /> Driver Approvals</Link>
                    </Button>
                }
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

              <Separator className="my-6" />

              <div>
                <Label htmlFor="roleSelect" className="text-base font-medium">My Primary Role</Label>
                <Select
                  value={selectedRole}
                  onValueChange={(value) => setSelectedRole(value as UserRole)}
                >
                  <SelectTrigger id="roleSelect" className="mt-1">
                    <SelectValue placeholder="Select your primary role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UserRole.STUDENT}>Student</SelectItem>
                    <SelectItem value={UserRole.PARENT}>Parent or Guardian</SelectItem>
                    <SelectItem value={UserRole.ADMIN}>Admin</SelectItem>
                    {/* <SelectItem value={UserRole.DRIVER}>Driver</SelectItem> */} {/* Could add Driver if needed here */}
                  </SelectContent>
                </Select>
              </div>

              {selectedRole === UserRole.PARENT && (
                <div className="space-y-6 pl-4 border-l-2 border-accent/40 ml-2 pt-4 pb-4 animate-accordion-down">
                  <div className="flex items-center gap-2 text-accent mb-2">
                      <Users className="h-5 w-5" />
                      <h4 className="font-semibold">Manage My Students</h4>
                  </div>
                  <p className="text-xs text-muted-foreground">Link students you are responsible for to manage their carpool approvals.</p>
                  <div className="flex flex-col gap-2">
                      <Label htmlFor="studentIdentifier" className="sr-only">Student Identifier</Label>
                      <Input
                      id="studentIdentifier"
                      placeholder="Enter Student's User ID or Email"
                      value={studentIdentifierInput}
                      onChange={(e) => setStudentIdentifierInput(e.target.value)}
                      className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                          In a live system, you would search for and select an existing student user.
                      </p>
                      <Button onClick={handleAddStudent} variant="outline" className="mt-1 self-start">Add Student</Button>
                  </div>
                  {managedStudents.length > 0 && (
                      <div>
                      <h5 className="font-medium text-sm text-muted-foreground mt-4 mb-2">Associated Students (User Identifiers):</h5>
                      <ul className="list-disc list-inside space-y-1 bg-muted/30 p-3 rounded-md">
                          {managedStudents.map((student, index) => (
                          <li key={index} className="text-sm">{student}</li>
                          ))}
                      </ul>
                      </div>
                  )}
                </div>
              )}

              {selectedRole === UserRole.STUDENT && (
                <div className="space-y-6 pl-4 border-l-2 border-blue-500/40 ml-2 pt-4 pb-4 animate-accordion-down">
                  <div className="flex items-center gap-2 text-blue-600 mb-2">
                      <Users className="h-5 w-5" />
                      <h4 className="font-semibold">Manage My Parents/Guardians</h4>
                  </div>
                  <p className="text-xs text-muted-foreground">Link parents or guardians who can manage your ryd approvals.</p> {/* Changed ride to ryd */}
                  <div className="flex flex-col gap-2">
                      <Label htmlFor="parentIdentifier" className="sr-only">Parent/Guardian Identifier</Label>
                      <Input
                      id="parentIdentifier"
                      placeholder="Enter Parent/Guardian's User ID or Email"
                      value={parentIdentifierInput}
                      onChange={(e) => setParentIdentifierInput(e.target.value)}
                      className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                          In a live system, you would search for and select an existing parent/guardian user.
                      </p>
                      <Button onClick={handleAddParent} variant="outline" className="mt-1 self-start">Add Parent/Guardian</Button>
                  </div>
                  {associatedParents.length > 0 && (
                      <div>
                      <h5 className="font-medium text-sm text-muted-foreground mt-4 mb-2">Associated Parents/Guardians (User Identifiers):</h5>
                      <ul className="list-disc list-inside space-y-1 bg-muted/30 p-3 rounded-md">
                          {associatedParents.map((parent, index) => (
                          <li key={index} className="text-sm">{parent}</li>
                          ))}
                      </ul>
                      </div>
                  )}
                </div>
              )}

              {selectedRole === UserRole.ADMIN && (
                <div className="space-y-6 pl-4 border-l-2 border-red-500/40 ml-2 pt-4 pb-4 animate-accordion-down">
                  <div className="flex items-center gap-2 text-red-600 mb-2">
                      <UserCog className="h-5 w-5" />
                      <h4 className="font-semibold">Administrator Controls Area</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Administrative functions and system management tools would be accessible here.
                  </p>
                  {/* Placeholder for admin specific controls */}
                </div>
              )}


              <Separator className="my-6" />
              
              <div>
                <div className="flex items-center space-x-2 mb-4">
                  <Checkbox
                    id="canDrive"
                    checked={canDrive}
                    onCheckedChange={(checked) => setCanDrive(Boolean(checked))}
                  />
                  <Label htmlFor="canDrive" className="text-base font-medium cursor-pointer">
                    I can drive
                  </Label>
                </div>

                {canDrive && (
                  <div className="space-y-6 pl-4 border-l-2 border-primary/20 ml-2 pt-2 pb-4 animate-accordion-down">
                    <div className="flex items-center gap-2 text-primary mb-2">
                        <CarIcon className="h-5 w-5" />
                        <h4 className="font-semibold">Driver Information</h4>
                    </div>
                    <div>
                      <Label htmlFor="ageRange">Age Range</Label>
                      <Select
                        value={driverDetails.ageRange}
                        onValueChange={(value) => setDriverDetails(prev => ({ ...prev, ageRange: value }))}
                      >
                        <SelectTrigger id="ageRange" className="mt-1">
                          <SelectValue placeholder="Select your age range" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="16-18">16-18</SelectItem>
                          <SelectItem value="19-23">19-23</SelectItem>
                          <SelectItem value="24+">24+</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="drivingExperience">Driving Experience</Label>
                      <Select
                        value={driverDetails.drivingExperience}
                        onValueChange={(value) => setDriverDetails(prev => ({ ...prev, drivingExperience: value }))}
                      >
                        <SelectTrigger id="drivingExperience" className="mt-1">
                          <SelectValue placeholder="Select your driving experience" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0-6m">0-6 months</SelectItem>
                          <SelectItem value="6m-1y">6 months - 1 year</SelectItem>
                          <SelectItem value="1-3y">1-3 years</SelectItem>
                          <SelectItem value="3-5y">3-5 years</SelectItem>
                          <SelectItem value="5y+">5+ years</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="primaryVehicle">Primary Vehicle</Label>
                      <Input
                        id="primaryVehicle"
                        value={driverDetails.primaryVehicle}
                        onChange={(e) => setDriverDetails(prev => ({ ...prev, primaryVehicle: e.target.value }))}
                        placeholder="e.g., Toyota Camry 2020, Blue"
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="passengerCapacity">Passenger Capacity (excluding driver)</Label>
                      <Input
                        id="passengerCapacity"
                        type="number"
                        value={driverDetails.passengerCapacity}
                        onChange={(e) => setDriverDetails(prev => ({ ...prev, passengerCapacity: e.target.value }))}
                        placeholder="e.g., 4"
                        min="1"
                        className="mt-1"
                      />
                    </div>
                  </div>
                )}
              </div>

            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

