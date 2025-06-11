
"use client";

import React, { useState, useEffect, use } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { User, Mail, Phone, Edit3, Shield, LogOut, Settings, CarIcon, Users, UserCog, LinkIcon, ExternalLinkIcon, Loader2, AlertTriangle, ArrowLeft, MessageSquare } from "lucide-react"; // Added MessageSquare
import Link from "next/link";
import { UserRole, type UserProfileData } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Input } from "@/components/ui/input"; // Added Input import
import { Label } from "@/components/ui/label"; // Added Label import

interface ViewProfilePageParams {
  userId: string;
}

export default function ViewUserProfilePage({ params: paramsPromise }: { params: Promise<ViewProfilePageParams> }) {
  const params = use(paramsPromise);
  const { userId } = params || {};

  const { user: authUser, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [viewedUserProfile, setViewedUserProfile] = useState<UserProfileData | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setProfileError("User ID is missing from the URL.");
      setIsLoadingProfile(false);
      return;
    }

    const fetchUserProfile = async () => {
      setIsLoadingProfile(true);
      setProfileError(null);
      try {
        const userDocRef = doc(db, "users", userId);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          setViewedUserProfile(userDocSnap.data() as UserProfileData);
        } else {
          setProfileError("User profile not found.");
          setViewedUserProfile(null);
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
        setProfileError("Failed to load user profile.");
        setViewedUserProfile(null);
        toast({
          title: "Error",
          description: "Could not load user profile.",
          variant: "destructive",
        });
      } finally {
        setIsLoadingProfile(false);
      }
    };

    fetchUserProfile();
  }, [userId, toast]);

  if (authLoading || isLoadingProfile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading profile...</p>
      </div>
    );
  }

  if (profileError) {
    return (
       <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Error Loading Profile</h2>
        <p className="text-muted-foreground mb-4 px-4">{profileError}</p>
        <Button asChild variant="outline">
          <Link href="/dashboard">Go to Dashboard</Link>
        </Button>
      </div>
    )
  }
  
  if (!viewedUserProfile) {
    return ( // Should be caught by profileError, but as a fallback
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
            <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
            <p className="text-muted-foreground">User profile could not be loaded.</p>
             <Button asChild className="mt-4" variant="outline"><Link href="/dashboard">Go to Dashboard</Link></Button>
        </div>
    );
  }

  const isOwnProfile = authUser?.uid === viewedUserProfile.uid;

  return (
    <>
      <PageHeader
        title={isOwnProfile ? "My Profile" : `${viewedUserProfile.fullName}'s Profile`}
        description={isOwnProfile ? "View and manage your account details." : `Viewing profile for ${viewedUserProfile.fullName}.`}
        actions={
          isOwnProfile ? (
            <Button variant="outline" asChild>
              <Link href="/profile/edit">
                <Edit3 className="mr-2 h-4 w-4" /> Edit My Profile
              </Link>
            </Button>
          ) : (
            <Button variant="outline" asChild>
              <Link href="javascript:history.back()">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Link>
            </Button>
          )
        }
      />

      <div className="grid gap-8 md:grid-cols-3">
        <div className="md:col-span-1">
          <Card className="shadow-lg text-center">
            <CardHeader>
              <Avatar className="h-32 w-32 mx-auto mb-4 border-4 border-primary">
                <AvatarImage src={viewedUserProfile.avatarUrl || `https://placehold.co/128x128.png?text=${viewedUserProfile.fullName.split(" ").map(n=>n[0]).join("")}`} alt={viewedUserProfile.fullName} data-ai-hint={viewedUserProfile.dataAiHint || "profile picture"} />
                <AvatarFallback>{viewedUserProfile.fullName.split(" ").map(n => n[0]).join("")}</AvatarFallback>
              </Avatar>
              <CardTitle className="font-headline text-2xl">{viewedUserProfile.fullName}</CardTitle>
              <CardDescription className="capitalize">
                {viewedUserProfile.role === UserRole.PARENT ? "Parent or Guardian" : viewedUserProfile.role === UserRole.STUDENT ? "Student" : viewedUserProfile.role}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground px-4">{viewedUserProfile.bio || "No bio available."}</p>
              <Separator className="my-4" />
              <div className="space-y-3 text-left">
                <div className="flex items-center text-sm">
                  <Mail className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{viewedUserProfile.email}</span>
                </div>
                {viewedUserProfile.phone && (
                    <div className="flex items-center text-sm">
                    <Phone className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>{viewedUserProfile.phone}</span>
                    </div>
                )}
              </div>
              {!isOwnProfile && (
                <Button className="w-full mt-6" asChild>
                    <Link href={`/messages/new?recipient=${viewedUserProfile.uid}&recipientName=${encodeURIComponent(viewedUserProfile.fullName)}`}>
                        <MessageSquare className="mr-2 h-4 w-4" /> Message {viewedUserProfile.fullName.split(" ")[0]}
                    </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Publicly visible details for this user.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {viewedUserProfile.canDrive && viewedUserProfile.driverDetails && (
                  <div className="space-y-6 pl-4 border-l-2 border-primary/30 ml-2 pt-2 pb-4">
                    <div className="flex items-center gap-2 text-primary mb-2">
                        <CarIcon className="h-5 w-5" />
                        <h4 className="font-semibold">Driver Information</h4>
                    </div>
                    {viewedUserProfile.driverDetails.primaryVehicle && (
                        <div>
                        <Label htmlFor="primaryVehicle">Primary Vehicle</Label>
                        <Input id="primaryVehicle" value={viewedUserProfile.driverDetails.primaryVehicle} readOnly className="mt-1 bg-muted/50" />
                        </div>
                    )}
                    {viewedUserProfile.driverDetails.passengerCapacity && (
                        <div>
                        <Label htmlFor="passengerCapacity">Passenger Capacity</Label>
                        <Input id="passengerCapacity" value={viewedUserProfile.driverDetails.passengerCapacity} readOnly className="mt-1 bg-muted/50" />
                        </div>
                    )}
                     {viewedUserProfile.driverDetails.ageRange && (
                        <div>
                        <Label htmlFor="ageRange">Driver Age Range</Label>
                        <Input id="ageRange" value={viewedUserProfile.driverDetails.ageRange} readOnly className="mt-1 bg-muted/50" />
                        </div>
                    )}
                    {viewedUserProfile.driverDetails.drivingExperience && (
                        <div>
                        <Label htmlFor="drivingExperience">Driving Experience</Label>
                        <Input id="drivingExperience" value={viewedUserProfile.driverDetails.drivingExperience} readOnly className="mt-1 bg-muted/50" />
                        </div>
                    )}
                  </div>
                )}
                {(!viewedUserProfile.canDrive || !viewedUserProfile.driverDetails || Object.keys(viewedUserProfile.driverDetails).filter(k => viewedUserProfile.driverDetails![k as keyof typeof viewedUserProfile.driverDetails]).length === 0) && (
                     <div className="space-y-2 pl-4 border-l-2 border-muted ml-2 pt-2 pb-4">
                         <div className="flex items-center gap-2 text-muted-foreground mb-2">
                            <CarIcon className="h-5 w-5" />
                            <h4 className="font-semibold">Driver Information</h4>
                        </div>
                        <p className="text-sm text-muted-foreground">This user has not provided driving details or is not registered as a driver.</p>
                     </div>
                )}
              
              <Separator />
                <div>
                    <Label htmlFor="joined-groups-count">Joined Groups</Label>
                    <Input 
                        id="joined-groups-count" 
                        value={`${viewedUserProfile.joinedGroupIds?.length || 0} group(s)`} 
                        readOnly 
                        className="mt-1 bg-muted/50" 
                    />
                </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

    