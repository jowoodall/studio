
"use client";

import React, { useState, useEffect } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { User, Mail, Phone, Edit3, Shield, LogOut, Settings, CarIcon, Users, UserCog, LinkIcon, ExternalLinkIcon, Loader2, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { UserRole, type UserProfileData } from '@/types'; // Import UserProfileData
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, arrayUnion, Timestamp, writeBatch, query, where, getDocs, collection, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

interface ManagedStudentDisplayInfo {
  uid: string;
  fullName: string;
  email: string;
}

interface AssociatedParentDisplayInfo {
  uid: string;
  fullName: string;
  email: string;
}


const exampleLinkedApps = [
  { id: 'teamsnap', name: 'TeamSnap', description: 'Sync team schedules and events.', connected: false, dataAiHint: 'sports team logo' },
  { id: 'band', name: 'BAND', description: 'Connect with your group calendars.', connected: true, dataAiHint: 'community app logo' },
  { id: 'googlecalendar', name: 'Google Calendar', description: 'Integrate your personal calendar.', connected: false, dataAiHint: 'calendar logo' },
  { id: 'outlookcalendar', name: 'Outlook Calendar', description: 'Link your work or personal calendar.', connected: true, dataAiHint: 'office app logo' },
];

export default function ProfilePage() {
  const { user: authUser, userProfile: authUserProfile, loading: authLoading, isLoadingProfile: isLoadingContextProfile } = useAuth(); // Use context
  const { toast } = useToast();
  // Local state for profile details, initialized from context or fetched if context is still loading/empty
  const [localUserProfile, setLocalUserProfile] = useState<UserProfileData | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  
  const [studentEmailInput, setStudentEmailInput] = useState("");
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [managedStudents, setManagedStudents] = useState<ManagedStudentDisplayInfo[]>([]); 

  const [parentIdentifierInput, setParentIdentifierInput] = useState("");
  const [displayedAssociatedParents, setDisplayedAssociatedParents] = useState<AssociatedParentDisplayInfo[]>([]);
  const [isAddingParent, setIsAddingParent] = useState(false); 

  useEffect(() => {
    async function processProfileData() {
      if (!isLoadingContextProfile && authUserProfile) {
        console.log("ProfilePage: Using profile from context:", authUserProfile);
        setLocalUserProfile(authUserProfile);
        setProfileError(null);

        if (authUserProfile.role === UserRole.PARENT && authUserProfile.managedStudentIds && authUserProfile.managedStudentIds.length > 0) {
          const studentPromises = authUserProfile.managedStudentIds.map(async (studentId) => {
            try {
              const studentDocRef = doc(db, "users", studentId);
              const studentDocSnap = await getDoc(studentDocRef);
              if (studentDocSnap.exists()) {
                const studentData = studentDocSnap.data() as UserProfileData;
                return { uid: studentId, fullName: studentData.fullName, email: studentData.email };
              }
              return null;
            } catch (e) { console.error(e); return null; }
          });
          const resolvedStudents = (await Promise.all(studentPromises)).filter(Boolean) as ManagedStudentDisplayInfo[];
          setManagedStudents(resolvedStudents);
        } else {
          setManagedStudents([]);
        }

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
        // This case implies the user is authenticated by Firebase Auth, but their profile didn't load from context
        // (e.g., Firestore document missing, or initial context profile load failed).
        // We might attempt a direct fetch here as a fallback, or guide the user.
        console.warn("ProfilePage: Auth user exists but no profile in context. UID:", authUser.uid);
        setProfileError("Profile data is not available. It might be a new account or an issue fetching data.");
        // Optionally, try to create/initialize if truly new and identifiable (e.g. from signupForm)
        // For now, just indicate an error.
        setLocalUserProfile(null); // Ensure local profile is also null
      } else if (!authLoading && !authUser) {
        // Not logged in at all
        setLocalUserProfile(null);
        setProfileError(null); // Or "Please log in"
      }
    }

    processProfileData();
  }, [authUser, authUserProfile, authLoading, isLoadingContextProfile]);


  const handleAddStudent = async () => {
    if (!authUser || !localUserProfile || localUserProfile.role !== UserRole.PARENT) {
      toast({ title: "Error", description: "Only parents can add students.", variant: "destructive" });
      return;
    }
    const studentEmailToAdd = studentEmailInput.trim().toLowerCase();
    if (studentEmailToAdd === "") {
      toast({ title: "Input Required", description: "Please enter the student's email address.", variant: "destructive" });
      return;
    }
    if (studentEmailToAdd === authUser.email?.toLowerCase()) {
      toast({ title: "Invalid Action", description: "You cannot add yourself as a managed student.", variant: "destructive" });
      return;
    }

    setIsAddingStudent(true);
    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", studentEmailToAdd));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        toast({ title: "Student Not Found", description: `No user found with email: ${studentEmailToAdd}.`, variant: "destructive" });
        setIsAddingStudent(false); return;
      }
      if (querySnapshot.docs.length > 1) {
        toast({ title: "Multiple Accounts Found", description: `Multiple accounts for email: ${studentEmailToAdd}. Contact support.`, variant: "destructive" });
        setIsAddingStudent(false); return;
      }

      const studentDocSnap = querySnapshot.docs[0];
      const studentIdToAdd = studentDocSnap.id;
      const studentData = studentDocSnap.data() as UserProfileData;

      if (studentData.role !== UserRole.STUDENT) {
        toast({ title: "Invalid Role", description: `${studentEmailToAdd} is not a student. Role: ${studentData.role}.`, variant: "destructive" });
        setIsAddingStudent(false); return;
      }
      
      const isAlreadyManagedByCurrentUser = managedStudents.some(s => s.uid === studentIdToAdd);
      if (isAlreadyManagedByCurrentUser) {
        toast({ title: "Already Managed", description: `${studentData.fullName || 'Student'} is already managed.` });
        setStudentEmailInput(""); setIsAddingStudent(false); return;
      }
      
      const batch = writeBatch(db);
      const parentDocRef = doc(db, "users", authUser.uid);
      // Automatically approve the parent to drive the student they are adding
      batch.update(parentDocRef, { 
        managedStudentIds: arrayUnion(studentIdToAdd),
        [`approvedDrivers.${authUser.uid}`]: arrayUnion(studentIdToAdd),
      });
      const studentDocRef = doc(db, "users", studentIdToAdd);
      batch.update(studentDocRef, { associatedParentIds: arrayUnion(authUser.uid) });
      await batch.commit();

      setManagedStudents(prev => [...prev, { uid: studentIdToAdd, fullName: studentData.fullName, email: studentData.email }]);
      setLocalUserProfile(prev => {
        if (!prev) return null;
        const newApprovedDrivers = { ...(prev.approvedDrivers || {}) };
        const currentApprovals = newApprovedDrivers[authUser.uid] || [];
        newApprovedDrivers[authUser.uid] = [...new Set([...currentApprovals, studentIdToAdd])];
        
        return { 
          ...prev, 
          managedStudentIds: [...(prev.managedStudentIds || []), studentIdToAdd],
          approvedDrivers: newApprovedDrivers,
        };
      });

      setStudentEmailInput("");
      toast({ title: "Student Associated", description: `${studentData.fullName || studentEmailToAdd} linked. You have been auto-approved to drive this student.` });
    } catch (error: any) {
      console.error("handleAddStudent Error:", error);
      toast({ title: "Association Failed", description: error.message || "Could not associate student.", variant: "destructive" });
    } finally {
      setIsAddingStudent(false);
    }
  };

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
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", parentEmailToAdd));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        toast({ title: "Parent Not Found", description: `No user with email: ${parentEmailToAdd}.`, variant: "destructive" });
        setIsAddingParent(false); return;
      }
      const parentDocSnap = querySnapshot.docs[0];
      const parentIdToAdd = parentDocSnap.id;
      const parentData = parentDocSnap.data() as UserProfileData;

      if (parentData.role !== UserRole.PARENT && parentData.role !== UserRole.ADMIN) {
         toast({ title: "Invalid Role", description: `${parentEmailToAdd} is not a parent/admin.`, variant: "destructive" });
         setIsAddingParent(false); return;
      }
      
      const isAlreadyAssociated = displayedAssociatedParents.some(p => p.uid === parentIdToAdd);
      if (isAlreadyAssociated) {
        toast({ title: "Already Associated", description: `${parentData.fullName || 'Parent'} is already associated.` });
        setParentIdentifierInput(""); setIsAddingParent(false); return;
      }
      
      const batch = writeBatch(db);
      // Student's document update
      const studentDocRef = doc(db, "users", authUser.uid);
      batch.update(studentDocRef, { associatedParentIds: arrayUnion(parentIdToAdd) });
      
      // Parent's document update
      const parentDocRefToUpdate = doc(db, "users", parentIdToAdd);
      batch.update(parentDocRefToUpdate, { 
          managedStudentIds: arrayUnion(authUser.uid),
          [`approvedDrivers.${parentIdToAdd}`]: arrayUnion(authUser.uid),
      });
      await batch.commit();
      
      setDisplayedAssociatedParents(prev => [...prev, {uid: parentIdToAdd, fullName: parentData.fullName, email: parentData.email}]);
      setLocalUserProfile(prev => prev ? ({ ...prev, associatedParentIds: [...(prev.associatedParentIds || []), parentIdToAdd] }) : null);
      setParentIdentifierInput("");
      toast({ title: "Parent/Guardian Associated", description: `${parentData.fullName || parentEmailToAdd} linked. They are now an approved driver for you.` });
    } catch (error: any) {
        console.error("handleAddParent Error:", error);
        toast({ title: "Association Failed", description: error.message || "Could not associate parent.", variant: "destructive" });
    } finally {
        setIsAddingParent(false);
    }
  };
  

  if (authLoading || isLoadingContextProfile) { // Combined loading state from context
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
  
  if (!authUser || !localUserProfile) { // If still no authUser or localUserProfile after loading
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
          <Card className="mt-6 shadow-lg">
             <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
             </CardHeader>
             <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start" asChild>
                    <Link href="/settings"><Settings className="mr-2 h-4 w-4" /> Account Settings</Link>
                </Button>
                { (localUserProfile.role === UserRole.PARENT) &&
                    <Button variant="outline" className="w-full justify-start" asChild>
                        <Link href="/parent/approvals"><Shield className="mr-2 h-4 w-4" /> Driver Approvals</Link>
                    </Button>
                }
                 { (localUserProfile.role === UserRole.PARENT) && // Show "My Students" link for parents
                    <Button variant="outline" className="w-full justify-start" asChild>
                        <Link href="/parent/my-students"><Users className="mr-2 h-4 w-4" /> My Students</Link>
                    </Button>
                }
                <Button variant="destructive" className="w-full justify-start" asChild>
                     <Link href="/"> 
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
              <div>
                <Label htmlFor="address">Address</Label>
                <Input id="addressStreet" value={localUserProfile.address?.street || ""} readOnly className="mt-1 bg-muted/50" placeholder="Street not set"/>
                <div className="grid grid-cols-3 gap-2 mt-2">
                    <Input id="addressCity" placeholder="City" value={localUserProfile.address?.city || ""} readOnly className="bg-muted/50" />
                    <Input id="addressState" placeholder="State" value={localUserProfile.address?.state || ""} readOnly className="bg-muted/50" />
                    <Input id="addressZip" placeholder="Zip" value={localUserProfile.address?.zip || ""} readOnly className="bg-muted/50" />
                </div>
              </div>
              <Separator />
              <h3 className="text-md font-semibold text-muted-foreground">Preferences</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="notifications">Notification Preferences</Label>
                  <Input id="notifications" value={localUserProfile.preferences?.notifications || "Not set"} readOnly className="mt-1 bg-muted/50" />
                </div>
                <div>
                  <Label htmlFor="pickupRadius">Preferred Pickup Radius</Label>
                  <Input id="pickupRadius" value={localUserProfile.preferences?.preferredPickupRadius || "Not set"} readOnly className="mt-1 bg-muted/50" />
                </div>
              </div>

              <Separator className="my-6" />

              {localUserProfile.role === UserRole.PARENT && (
                <div className="space-y-6 pl-4 border-l-2 border-accent/40 ml-2 pt-4 pb-4 animate-accordion-down">
                  <div className="flex items-center gap-2 text-accent mb-2">
                      <Users className="h-5 w-5" />
                      <h4 className="font-semibold">Manage My Students</h4>
                  </div>
                  <p className="text-xs text-muted-foreground">Link students you are responsible for by entering their email address. This will allow you to manage their ryd approvals if they also link you as a parent.</p>
                  <div className="flex flex-col gap-2">
                      <Label htmlFor="studentEmailInput" className="sr-only">Student's Email Address</Label>
                      <Input
                      id="studentEmailInput"
                      type="email"
                      placeholder="Enter Student's Email Address"
                      value={studentEmailInput}
                      onChange={(e) => setStudentEmailInput(e.target.value)}
                      className="mt-1"
                      />
                      <Button onClick={handleAddStudent} variant="outline" className="mt-1 self-start" disabled={isAddingStudent}>
                        {isAddingStudent ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Add Student
                      </Button>
                  </div>
                  {managedStudents.length > 0 ? (
                      <div>
                      <h5 className="font-medium text-sm text-muted-foreground mt-4 mb-2">My Managed Students:</h5>
                      <ul className="list-disc list-inside space-y-2 bg-muted/30 p-3 rounded-md">
                          {managedStudents.map((student) => (
                          <li key={student.uid} className="text-sm">
                            <span className="font-medium">{student.fullName}</span> ({student.email})
                          </li> 
                          ))}
                      </ul>
                      </div>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-2">No students are currently managed by you in the system.</p>
                  )}
                </div>
              )}

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

              <Separator className="my-6" />

              <div>
                <div className="flex items-center gap-2 text-muted-foreground mb-4">
                  <LinkIcon className="h-5 w-5" />
                  <h4 className="text-base font-medium">Linked Apps</h4>
                </div>
                <p className="text-xs text-muted-foreground mb-4">Connect MyRydz with other apps you use.</p>
                <div className="space-y-4">
                  {exampleLinkedApps.map((app) => (
                    <div key={app.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-md">
                      <div>
                        <p className="font-medium">{app.name}</p>
                        <p className="text-xs text-muted-foreground">{app.description}</p>
                      </div>
                      <Button variant={app.connected ? "outline" : "default"} size="sm" disabled> 
                        {app.connected ? <><ExternalLinkIcon className="mr-2 h-3 w-3" />Manage</> : "Connect"}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
