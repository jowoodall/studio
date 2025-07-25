
"use client";

import React, { useState, useEffect } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { User, Mail, Phone, Edit3, Shield, LogOut, Settings, CarIcon, Users, UserCog, Loader2, AlertTriangle, MapPin } from "lucide-react";
import Link from "next/link";
import { UserRole, type UserProfileData } from '@/types'; 
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { associateParentWithStudentAction } from '@/actions/userActions';

interface AssociatedParentDisplayInfo {
  uid: string;
  fullName: string;
  email: string;
}

export default function ProfilePage() {
  const { user: authUser, userProfile: authUserProfile, loading: authLoading, isLoadingProfile: isLoadingContextProfile } = useAuth();
  const { toast } = useToast();
  const [localUserProfile, setLocalUserProfile] = useState<UserProfileData | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [parentIdentifierInput, setParentIdentifierInput] = useState("");
  const [displayedAssociatedParents, setDisplayedAssociatedParents] = useState<AssociatedParentDisplayInfo[]>([]);
  const [isAddingParent, setIsAddingParent] = useState(false); 

  useEffect(() => {
    async function processProfileData() {
      if (!isLoadingContextProfile && authUserProfile) {
        setLocalUserProfile(authUserProfile);
        setProfileError(null);

        if (authUserProfile.role === UserRole.STUDENT && authUserProfile.associatedParentIds && authUserProfile.associatedParentIds.length > 0) {
           const parentPromises = authUserProfile.associatedParentIds.map(async (parentId) => {
             try {
                const parentDocRef = doc(db, "users", parentId);
                const parentDocSnap = await getDoc(parentDocRef);
                if (parentDocSnap.exists()) {
                    const parentData = parentDocSnap.data() as UserProfileData;
                    return { uid: parentId, fullName: parentData.fullName, email: parentData.email };
                }
                return null;
             } catch (e) { console.error(e); return null; }
           });
           const resolvedParents = (await Promise.all(parentPromises)).filter(Boolean) as AssociatedParentDisplayInfo[];
           setDisplayedAssociatedParents(resolvedParents);
        } else {
          setDisplayedAssociatedParents([]);
        }

      } else if (!authLoading && !isLoadingContextProfile && !authUserProfile && authUser) {
        console.warn("ProfilePage: Auth user exists but no profile in context. UID:", authUser.uid);
        setProfileError("Profile data is not available. It might be a new account or an issue fetching data.");
        setLocalUserProfile(null); 
      } else if (!authLoading && !authUser) {
        setLocalUserProfile(null);
        setProfileError(null); 
      }
    }

    processProfileData();
  }, [authUser, authUserProfile, authLoading, isLoadingContextProfile]);


  const handleAddParent = async () => {
    if (!authUser || !localUserProfile || localUserProfile.role !== UserRole.STUDENT) {
      toast({ title: "Error", description: "Only students can add parents.", variant: "destructive" });
      return;
    }
    const parentEmailToAdd = parentIdentifierInput.trim().toLowerCase();
    if (parentEmailToAdd === "") {
      toast({ title: "Input Required", description: "Please enter parent's email.", variant: "destructive" });
      return;
    }
    setIsAddingParent(true);
    try {
       const result = await associateParentWithStudentAction({
        studentUid: authUser.uid,
        parentEmail: parentEmailToAdd,
      });

      if (result.success) {
        toast({ title: "Parent/Guardian Associated", description: result.message });
        setParentIdentifierInput("");
      } else {
        toast({ title: "Association Failed", description: result.message, variant: "destructive" });
      }
    } catch (error: any) {
        console.error("handleAddParent Error:", error);
        toast({ title: "Association Failed", description: error.message || "Could not associate parent.", variant: "destructive" });
    } finally {
        setIsAddingParent(false);
    }
  };
  

  if (authLoading || isLoadingContextProfile) { 
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading profile...</p>
      </div>
    );
  }

  if (profileError && !localUserProfile) {
    return (
       <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Error Loading Profile</h2>
        <p className="text-muted-foreground mb-4 px-4">{profileError}</p>
        <Button asChild>
          <Link href="/dashboard">Go to Dashboard</Link>
        </Button>
      </div>
    )
  }
  
  if (!authUser || !localUserProfile) { 
    return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
            <p className="text-muted-foreground">Please log in to view your profile.</p>
             <Button asChild className="mt-4"><Link href="/login">Log In</Link></Button>
        </div>
    );
  }


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
                <AvatarImage src={localUserProfile.avatarUrl || authUser.photoURL || `https://placehold.co/128x128.png?text=${localUserProfile.fullName.split(" ").map(n=>n[0]).join("")}`} alt={localUserProfile.fullName} data-ai-hint={localUserProfile.dataAiHint || "profile picture"} />
                <AvatarFallback>{localUserProfile.fullName.split(" ").map(n=>n[0]).join("")}</AvatarFallback>
              </Avatar>
              <CardTitle className="font-headline text-2xl">{localUserProfile.fullName}</CardTitle>
              <CardDescription className="capitalize">
                {localUserProfile.role === UserRole.PARENT ? "Parent or Guardian" : localUserProfile.role === UserRole.STUDENT ? "Student" : localUserProfile.role}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground px-4">{localUserProfile.bio || "No bio available."}</p>
              <Separator className="my-4" />
              <div className="space-y-3 text-left">
                <div className="flex items-center text-sm">
                  <Mail className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{localUserProfile.email}</span>
                </div>
                <div className="flex items-center text-sm">
                  <Phone className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{localUserProfile.phone || "Not provided"}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>Details about your account and preferences. Role is set at signup and cannot be changed.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input id="fullName" value={localUserProfile.fullName} readOnly className="mt-1 bg-muted/50" />
                </div>
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input id="email" type="email" value={localUserProfile.email} readOnly className="mt-1 bg-muted/50" />
                </div>
              </div>
               <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input id="phone" type="tel" value={localUserProfile.phone || ""} readOnly className="mt-1 bg-muted/50" />
                </div>
              
              <Separator className="my-6" />

              {localUserProfile.role === UserRole.STUDENT && (
                <div className="space-y-6 pl-4 border-l-2 border-blue-500/40 ml-2 pt-4 pb-4 animate-accordion-down">
                  <div className="flex items-center gap-2 text-blue-600 mb-2">
                      <Users className="h-5 w-5" />
                      <h4 className="font-semibold">My Parents/Guardians</h4>
                  </div>
                  <p className="text-xs text-muted-foreground">Link parents or guardians who can manage your ryd approvals by entering their Email.</p>
                  <div className="flex flex-col gap-2">
                      <Label htmlFor="parentIdentifier" className="sr-only">Parent/Guardian Email</Label>
                      <Input
                      id="parentIdentifier"
                      placeholder="Enter Parent/Guardian's Email"
                      value={parentIdentifierInput}
                      onChange={(e) => setParentIdentifierInput(e.target.value)}
                      className="mt-1"
                      />
                      <Button onClick={handleAddParent} variant="outline" className="mt-1 self-start" disabled={isAddingParent}>
                        {isAddingParent ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Add Parent/Guardian
                      </Button>
                  </div>
                  {displayedAssociatedParents.length > 0 ? (
                      <div>
                      <h5 className="font-medium text-sm text-muted-foreground mt-4 mb-2">My Associated Parents/Guardians:</h5>
                      <ul className="list-disc list-inside space-y-1 bg-muted/30 p-3 rounded-md">
                          {displayedAssociatedParents.map((parent) => (
                          <li key={parent.uid} className="text-sm">
                            <span className="font-medium">{parent.fullName}</span> ({parent.email})
                          </li>
                          ))}
                      </ul>
                      </div>
                  ) : (
                     <p className="text-xs text-muted-foreground mt-2">No parents/guardians are currently associated with your account.</p>
                  )}
                </div>
              )}

              {localUserProfile.role === UserRole.ADMIN && (
                <div className="space-y-6 pl-4 border-l-2 border-red-500/40 ml-2 pt-4 pb-4 animate-accordion-down">
                  <div className="flex items-center gap-2 text-red-600 mb-2">
                      <UserCog className="h-5 w-5" />
                      <h4 className="font-semibold">Administrator Controls Area</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Administrative functions and system management tools would be accessible here.
                  </p>
                </div>
              )}

              <Separator className="my-6" />
              
              <div>
                <div className="flex items-center space-x-2 mb-4">
                  <Checkbox
                    id="canDrive"
                    checked={localUserProfile.canDrive}
                    onCheckedChange={(checked) => {
                      // This is view-only on this page, edit is on /profile/edit
                    }}
                    disabled 
                  />
                  <Label htmlFor="canDrive" className="text-base font-medium">
                    I can drive
                  </Label>
                </div>

                {localUserProfile.canDrive && localUserProfile.driverDetails && (
                  <div className="space-y-6 pl-4 border-l-2 border-primary/20 ml-2 pt-2 pb-4 animate-accordion-down">
                    <div className="flex items-center gap-2 text-primary mb-2">
                        <CarIcon className="h-5 w-5" />
                        <h4 className="font-semibold">Driver Information (Read-only)</h4>
                    </div>
                    <div>
                      <Label htmlFor="ageRange">Age Range</Label>
                      <Input id="ageRange" value={localUserProfile.driverDetails.ageRange || "Not set"} readOnly className="mt-1 bg-muted/50" />
                    </div>
                    <div>
                      <Label htmlFor="drivingExperience">Driving Experience</Label>
                      <Input id="drivingExperience" value={localUserProfile.driverDetails.drivingExperience || "Not set"} readOnly className="mt-1 bg-muted/50" />
                    </div>
                    <div>
                      <Label htmlFor="primaryVehicle">Primary Vehicle</Label>
                      <Input id="primaryVehicle" value={localUserProfile.driverDetails.primaryVehicle || "Not set"} readOnly className="mt-1 bg-muted/50" />
                    </div>
                    <div>
                      <Label htmlFor="passengerCapacity">Passenger Capacity</Label>
                      <Input id="passengerCapacity" value={localUserProfile.driverDetails.passengerCapacity || "Not set"} readOnly className="mt-1 bg-muted/50" />
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
