
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
import { UserRole } from '@/types';
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, arrayUnion, Timestamp, writeBatch, query, where, getDocs, collection, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

// Define a type for the user profile data from Firestore
interface UserProfileData {
  uid: string;
  fullName: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  dataAiHint?: string;
  bio?: string;
  phone?: string;
  preferences?: {
    notifications?: string;
    preferredPickupRadius?: string;
  };
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  canDrive?: boolean;
  driverDetails?: {
    ageRange?: string;
    drivingExperience?: string;
    primaryVehicle?: string;
    passengerCapacity?: string;
  };
  managedStudentIds?: string[];
  associatedParentIds?: string[];
  createdAt?: Timestamp;
}

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
  const { user: authUser, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [userProfile, setUserProfile] = useState<UserProfileData | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [canDrive, setCanDrive] = useState(false);
  const [driverDetails, setDriverDetails] = useState({
    ageRange: "",
    drivingExperience: "",
    primaryVehicle: "",
    passengerCapacity: "",
  });
  const [selectedRoleForView, setSelectedRoleForView] = useState<UserRole | undefined>(undefined);
  
  const [studentEmailInput, setStudentEmailInput] = useState("");
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [managedStudents, setManagedStudents] = useState<ManagedStudentDisplayInfo[]>([]); 

  const [parentIdentifierInput, setParentIdentifierInput] = useState("");
  const [displayedAssociatedParents, setDisplayedAssociatedParents] = useState<AssociatedParentDisplayInfo[]>([]);
  const [isAddingParent, setIsAddingParent] = useState(false); 

  useEffect(() => {
    async function fetchUserProfile() {
      if (authUser) {
        setIsLoadingProfile(true);
        setProfileError(null);
        console.log("ProfilePage: Fetching profile for user UID:", authUser.uid);
        try {
          const userDocRef = doc(db, "users", authUser.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            const data = userDocSnap.data() as UserProfileData;
            console.log("ProfilePage: User profile data fetched:", data);
            setUserProfile(data);
            setCanDrive(data.canDrive || false);
            setDriverDetails(data.driverDetails || { ageRange: "", drivingExperience: "", primaryVehicle: "", passengerCapacity: "" });
            setSelectedRoleForView(data.role); 
            
            if (data.role === UserRole.PARENT && data.managedStudentIds && data.managedStudentIds.length > 0) {
              console.log("ProfilePage: Parent role detected. Fetching managed student details for IDs:", data.managedStudentIds);
              const studentPromises = data.managedStudentIds.map(async (studentId) => {
                try {
                  const studentDocRef = doc(db, "users", studentId);
                  const studentDocSnap = await getDoc(studentDocRef);
                  if (studentDocSnap.exists()) {
                    const studentData = studentDocSnap.data() as UserProfileData;
                    return { uid: studentId, fullName: studentData.fullName, email: studentData.email };
                  }
                  console.warn(`ProfilePage: Managed student with ID ${studentId} not found during profile load.`);
                  return null;
                } catch (studentFetchError) {
                  console.error(`ProfilePage: Error fetching student ${studentId} details:`, studentFetchError);
                  return null;
                }
              });
              const resolvedStudents = (await Promise.all(studentPromises)).filter(Boolean) as ManagedStudentDisplayInfo[];
              console.log("ProfilePage: Resolved managed student details:", resolvedStudents);
              setManagedStudents(resolvedStudents);
            } else {
              setManagedStudents([]);
            }

            if (data.role === UserRole.STUDENT && data.associatedParentIds && data.associatedParentIds.length > 0) {
              console.log("ProfilePage: Student role detected. Fetching associated parent details for IDs:", data.associatedParentIds);
              const parentPromises = data.associatedParentIds.map(async (parentId) => {
                try {
                  const parentDocRef = doc(db, "users", parentId);
                  const parentDocSnap = await getDoc(parentDocRef);
                  if (parentDocSnap.exists()) {
                    const parentData = parentDocSnap.data() as UserProfileData;
                    return { uid: parentId, fullName: parentData.fullName, email: parentData.email };
                  }
                  console.warn(`ProfilePage: Associated parent with ID ${parentId} not found during profile load.`);
                  return null;
                } catch (parentFetchError) {
                  console.error(`ProfilePage: Error fetching parent ${parentId} details:`, parentFetchError);
                  return null;
                }
              });
              const resolvedParents = (await Promise.all(parentPromises)).filter(Boolean) as AssociatedParentDisplayInfo[];
              console.log("ProfilePage: Resolved associated parent details:", resolvedParents);
              setDisplayedAssociatedParents(resolvedParents);
            } else {
              setDisplayedAssociatedParents([]);
            }

          } else {
            console.warn("ProfilePage: User profile document does not exist for UID:", authUser.uid);
            setProfileError("User profile not found. Attempting to initialize basic profile.");
            if (authUser.displayName && authUser.email) {
                try {
                    console.log("ProfilePage: Initializing new profile for:", authUser.uid, authUser.displayName, authUser.email);
                    const newUserProfile: UserProfileData = {
                        uid: authUser.uid,
                        fullName: authUser.displayName,
                        email: authUser.email,
                        role: UserRole.STUDENT, // Default role
                        createdAt: Timestamp.now(),
                        avatarUrl: authUser.photoURL || "",
                        dataAiHint: "",
                        bio: "",
                        phone: "",
                        preferences: { notifications: "email", preferredPickupRadius: "5 miles" },
                        address: { street: "", city: "", state: "", zip: "" },
                        canDrive: false,
                        driverDetails: { ageRange: "", drivingExperience: "", primaryVehicle: "", passengerCapacity: ""},
                        managedStudentIds: [],
                        associatedParentIds: [],
                    };
                    await setDoc(doc(db, "users", authUser.uid), newUserProfile);
                    setUserProfile(newUserProfile);
                    setSelectedRoleForView(newUserProfile.role);
                    setProfileError(null); 
                    toast({ title: "Profile Initialized", description: "A basic profile has been created for you." });
                    console.log("ProfilePage: Basic profile successfully initialized.");
                } catch (initError) {
                    console.error("ProfilePage: Error initializing user profile:", initError);
                    setProfileError("Failed to initialize profile. Please try refreshing.");
                }
            } else {
                 setProfileError("User profile not found and could not initialize (missing display name or email from auth provider).");
                 console.error("ProfilePage: Cannot initialize profile - missing displayName or email in authUser object.");
            }
          }
        } catch (error) {
          console.error("ProfilePage: General error fetching user profile:", error);
          setProfileError("Failed to load profile. Please try again.");
        } finally {
          setIsLoadingProfile(false);
          console.log("ProfilePage: Finished profile fetching process.");
        }
      } else if (!authLoading) {
        setIsLoadingProfile(false);
        console.log("ProfilePage: Auth not loaded or no authUser.");
      }
    }

    if (!authLoading) {
        fetchUserProfile();
    }
  }, [authUser, authLoading, toast]);


  const handleAddStudent = async () => {
    if (!authUser) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
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
    console.log("handleAddStudent: Attempting to add student with email:", studentEmailToAdd);
    console.log("handleAddStudent: Current authUser (Parent) UID:", authUser?.uid);

    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", studentEmailToAdd));
      console.log("handleAddStudent: Executing query for student email:", studentEmailToAdd);
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        console.warn("handleAddStudent: No student found with email:", studentEmailToAdd);
        toast({ title: "Student Not Found", description: `No user found with email: ${studentEmailToAdd}. Please ensure they have an account and the email is correct.`, variant: "destructive" });
        setIsAddingStudent(false);
        return;
      }
      
      if (querySnapshot.docs.length > 1) {
        console.warn("handleAddStudent: Multiple students found with email:", studentEmailToAdd, "Found docs:", querySnapshot.docs.length);
        toast({ title: "Multiple Accounts Found", description: `Multiple accounts found for email: ${studentEmailToAdd}. Please contact support.`, variant: "destructive" });
        setIsAddingStudent(false);
        return;
      }

      const studentDocSnap = querySnapshot.docs[0];
      const studentIdToAdd = studentDocSnap.id;
      const studentData = studentDocSnap.data() as UserProfileData;
      console.log("handleAddStudent: Found student:", studentIdToAdd, "Data:", studentData);

      if (studentData.role !== UserRole.STUDENT) {
        console.warn("handleAddStudent: User found is not a student. Role:", studentData.role);
        toast({ title: "Invalid Role", description: `User with email ${studentEmailToAdd} is not registered as a student and cannot be managed. Current role: ${studentData.role}.`, variant: "destructive" });
        setIsAddingStudent(false);
        return;
      }
      
      const isAlreadyManagedByCurrentUser = managedStudents.some(s => s.uid === studentIdToAdd);
      if (isAlreadyManagedByCurrentUser) {
        console.log("handleAddStudent: Student UID", studentIdToAdd, "is already in managedStudents list.");
        toast({ title: "Already Managed", description: `${studentData.fullName || 'Student'} (${studentEmailToAdd}) is already in your managed list.` });
        setStudentEmailInput("");
        setIsAddingStudent(false);
        return;
      }
      
      const batch = writeBatch(db);

      // Update Parent's document
      const parentDocRef = doc(db, "users", authUser.uid);
      batch.update(parentDocRef, {
        managedStudentIds: arrayUnion(studentIdToAdd)
      });
      console.log(`handleAddStudent: Batch op 1: Add student ${studentIdToAdd} to parent ${authUser.uid}'s managedStudentIds`);
      
      // Update Student's document
      const studentDocRef = doc(db, "users", studentIdToAdd);
      batch.update(studentDocRef, {
        associatedParentIds: arrayUnion(authUser.uid)
      });
      console.log(`handleAddStudent: Batch op 2: Add parent ${authUser.uid} to student ${studentIdToAdd}'s associatedParentIds`);
      

      console.log("handleAddStudent: Attempting batch.commit()");
      await batch.commit();
      console.log("handleAddStudent: Batch commit successful.");

      // Update local state for immediate UI feedback
      setManagedStudents(prev => {
        const studentExistsInDisplay = prev.some(s => s.uid === studentIdToAdd);
        if (studentExistsInDisplay) return prev; // Should be caught by earlier check, but defensive
        return [...prev, { uid: studentIdToAdd, fullName: studentData.fullName, email: studentData.email }];
      });
      
      setUserProfile(prevProfile => prevProfile ? ({
        ...prevProfile,
        managedStudentIds: [...(prevProfile.managedStudentIds || []), studentIdToAdd] 
      }) : null);

      setStudentEmailInput("");
      toast({ title: "Student Associated", description: `Student ${studentData.fullName || studentEmailToAdd} is now linked to your account.` });

    } catch (error: any) {
      console.error("handleAddStudent: Error associating student:", error);
      let errorMessage = "Could not associate student. Please try again.";
       if (error.message?.toLowerCase().includes("index") || error.message?.toLowerCase().includes("requires an index")) {
          errorMessage = "Database operation failed: A required index is missing. Your Firestore queries for users by email need an index on the 'email' field in the 'users' collection. Please check your browser's developer console (F12 -> Console); Firebase usually provides a direct link there to create the necessary index. Click that link and create the index."
      } else if (error.message?.includes("permission-denied") || error.code?.includes("permission-denied") || error.message?.includes("Missing or insufficient permissions")) {
          errorMessage = "Permission denied by Firestore security rules. Please check your rules to ensure this operation is allowed for both updating your profile and the student's profile. Also, ensure the Firestore database is correctly provisioned in your Firebase project."
      } else if (error.code === 'unavailable' || error.message?.includes('unavailable')) {
        errorMessage = "The Firestore service is temporarily unavailable. Please try again later."
      }
      toast({ title: "Association Failed", description: errorMessage, variant: "destructive", duration: 10000 });
    } finally {
      setIsAddingStudent(false);
      console.log("handleAddStudent: Finished student association attempt.");
    }
  };

  const handleAddParent = async () => {
    if (!authUser || !userProfile || userProfile.role !== UserRole.STUDENT) {
      toast({ title: "Error", description: "Only students can add parents/guardians.", variant: "destructive" });
      return;
    }
    const parentEmailToAdd = parentIdentifierInput.trim().toLowerCase();
    if (parentEmailToAdd === "") {
      toast({ title: "Input Required", description: "Please enter the parent's email address.", variant: "destructive" });
      return;
    }
    setIsAddingParent(true);
    console.log("handleAddParent: Student (UID:", authUser.uid, ") attempting to add parent with email:", parentEmailToAdd);
    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", parentEmailToAdd));
      console.log("handleAddParent: Executing query for parent email:", parentEmailToAdd);
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        console.warn("handleAddParent: No parent found with email:", parentEmailToAdd);
        toast({ title: "Parent Not Found", description: `No user found with email: ${parentEmailToAdd}. Ensure they have an account and the email is correct.`, variant: "destructive" });
        setIsAddingParent(false);
        return;
      }
       const parentDocSnap = querySnapshot.docs[0];
       const parentIdToAdd = parentDocSnap.id;
       const parentData = parentDocSnap.data() as UserProfileData;
       console.log("handleAddParent: Found parent:", parentIdToAdd, "Data:", parentData);

      if (parentData.role !== UserRole.PARENT && parentData.role !== UserRole.ADMIN) { // Admins might also act as guardians
         console.warn("handleAddParent: User found is not a parent/admin. Role:", parentData.role);
         toast({ title: "Invalid Role", description: `User with email ${parentEmailToAdd} is not registered as a parent or admin.`, variant: "destructive" });
         setIsAddingParent(false);
         return;
      }
      
      const isAlreadyAssociated = displayedAssociatedParents.some(p => p.uid === parentIdToAdd);
      if (isAlreadyAssociated) {
        console.log("handleAddParent: Parent UID", parentIdToAdd, "is already in associatedParents list.");
        toast({ title: "Already Associated", description: `${parentData.fullName || 'Parent/Guardian'} is already associated with your account.` });
        setParentIdentifierInput("");
        setIsAddingParent(false);
        return;
      }
      
      const batch = writeBatch(db);

      // Update Student's document
      const studentDocRef = doc(db, "users", authUser.uid);
      batch.update(studentDocRef, {
        associatedParentIds: arrayUnion(parentIdToAdd)
      });
      console.log(`handleAddParent: Batch op 1: Add parent ${parentIdToAdd} to student ${authUser.uid}'s associatedParentIds`);

      // Update Parent's document
      const parentDocRefToUpdate = doc(db, "users", parentIdToAdd);
      batch.update(parentDocRefToUpdate, {
        managedStudentIds: arrayUnion(authUser.uid) // Add student's UID to parent's managed list
      });
      console.log(`handleAddParent: Batch op 2: Add student ${authUser.uid} to parent ${parentIdToAdd}'s managedStudentIds`);

      console.log("handleAddParent: Attempting batch.commit()");
      await batch.commit();
      console.log("handleAddParent: Batch commit successful for student adding parent.");
      
      setDisplayedAssociatedParents(prev => [...prev, {uid: parentIdToAdd, fullName: parentData.fullName, email: parentData.email}]);
      setUserProfile(prevProfile => prevProfile ? ({
        ...prevProfile,
        associatedParentIds: [...(prevProfile.associatedParentIds || []), parentIdToAdd]
      }) : null);

      setParentIdentifierInput("");
      toast({ title: "Parent/Guardian Associated", description: `${parentData.fullName || 'Parent/Guardian'} (${parentEmailToAdd}) is now linked.` });

    } catch (error: any) {
        console.error("handleAddParent: Error associating parent:", error);
        let errorMessage = "Could not associate parent/guardian. Please try again.";
        if (error.message?.toLowerCase().includes("index")) {
             errorMessage = "Database operation failed: A required index for querying by email is missing. This is usually resolved by creating an index in Firestore."
        } else if (error.message?.includes("permission-denied") || error.code?.includes("permission-denied") || error.message?.includes("Missing or insufficient permissions")) {
             errorMessage = "Permission denied by Firestore security rules. Please check your rules to ensure this operation is allowed for both updating your profile and the parent's profile."
        }
        toast({ title: "Association Failed", description: errorMessage, variant: "destructive", duration: 9000 });
    } finally {
        setIsAddingParent(false);
        console.log("handleAddParent: Finished parent association attempt.");
    }
  };
  
  const currentDisplayRole = userProfile?.role || selectedRoleForView;

  if (authLoading || isLoadingProfile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading profile...</p>
      </div>
    );
  }

  if (profileError && !userProfile) {
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
  
  if (!authUser || !userProfile) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
            <p className="text-muted-foreground">Please log in to view your profile or profile data could not be loaded.</p>
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
                <AvatarImage src={userProfile.avatarUrl || authUser.photoURL || `https://placehold.co/128x128.png?text=${userProfile.fullName.split(" ").map(n=>n[0]).join("")}`} alt={userProfile.fullName} data-ai-hint={userProfile.dataAiHint || "profile picture"} />
                <AvatarFallback>{userProfile.fullName.split(" ").map(n=>n[0]).join("")}</AvatarFallback>
              </Avatar>
              <CardTitle className="font-headline text-2xl">{userProfile.fullName}</CardTitle>
              <CardDescription className="capitalize">
                {currentDisplayRole === UserRole.PARENT ? "Parent or Guardian" : currentDisplayRole === UserRole.STUDENT ? "Student" : currentDisplayRole}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground px-4">{userProfile.bio || "No bio available."}</p>
              <Separator className="my-4" />
              <div className="space-y-3 text-left">
                <div className="flex items-center text-sm">
                  <Mail className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{userProfile.email}</span>
                </div>
                <div className="flex items-center text-sm">
                  <Phone className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{userProfile.phone || "Not provided"}</span>
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
                { (userProfile.role === UserRole.PARENT) &&
                    <Button variant="outline" className="w-full justify-start" asChild>
                        <Link href="/parent/approvals"><Shield className="mr-2 h-4 w-4" /> Driver Approvals</Link>
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
              <CardDescription>Details about your account and preferences.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input id="fullName" value={userProfile.fullName} readOnly className="mt-1 bg-muted/50" />
                </div>
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input id="email" type="email" value={userProfile.email} readOnly className="mt-1 bg-muted/50" />
                </div>
              </div>
               <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input id="phone" type="tel" value={userProfile.phone || ""} readOnly className="mt-1 bg-muted/50" />
                </div>
              <div>
                <Label htmlFor="address">Address</Label>
                <Input id="addressStreet" value={userProfile.address?.street || ""} readOnly className="mt-1 bg-muted/50" placeholder="Street not set"/>
                <div className="grid grid-cols-3 gap-2 mt-2">
                    <Input id="addressCity" placeholder="City" value={userProfile.address?.city || ""} readOnly className="bg-muted/50" />
                    <Input id="addressState" placeholder="State" value={userProfile.address?.state || ""} readOnly className="bg-muted/50" />
                    <Input id="addressZip" placeholder="Zip" value={userProfile.address?.zip || ""} readOnly className="bg-muted/50" />
                </div>
              </div>
              <Separator />
              <h3 className="text-md font-semibold text-muted-foreground">Preferences</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="notifications">Notification Preferences</Label>
                  <Input id="notifications" value={userProfile.preferences?.notifications || "Not set"} readOnly className="mt-1 bg-muted/50" />
                </div>
                <div>
                  <Label htmlFor="pickupRadius">Preferred Pickup Radius</Label>
                  <Input id="pickupRadius" value={userProfile.preferences?.preferredPickupRadius || "Not set"} readOnly className="mt-1 bg-muted/50" />
                </div>
              </div>

              <Separator className="my-6" />

              <div>
                <Label htmlFor="roleSelect" className="text-base font-medium">My Primary Role (View)</Label>
                <Select
                  value={selectedRoleForView}
                  onValueChange={(value) => setSelectedRoleForView(value as UserRole)}
                >
                  <SelectTrigger id="roleSelect" className="mt-1">
                    <SelectValue placeholder="Select role to view relevant sections" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UserRole.STUDENT}>View as Student</SelectItem>
                    <SelectItem value={UserRole.PARENT}>View as Parent or Guardian</SelectItem>
                    <SelectItem value={UserRole.ADMIN}>View as Admin</SelectItem>
                  </SelectContent>
                </Select>
                 <p className="text-xs text-muted-foreground mt-1">Your actual role is: <span className="font-semibold capitalize">{userProfile.role}</span>. This selector changes your view.</p>
              </div>

              {selectedRoleForView === UserRole.PARENT && (
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

              {selectedRoleForView === UserRole.STUDENT && (
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

              {selectedRoleForView === UserRole.ADMIN && (
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
                    checked={canDrive}
                    onCheckedChange={(checked) => {
                      setCanDrive(Boolean(checked));
                    }}
                    disabled 
                  />
                  <Label htmlFor="canDrive" className="text-base font-medium">
                    I can drive
                  </Label>
                </div>

                {canDrive && userProfile.driverDetails && (
                  <div className="space-y-6 pl-4 border-l-2 border-primary/20 ml-2 pt-2 pb-4 animate-accordion-down">
                    <div className="flex items-center gap-2 text-primary mb-2">
                        <CarIcon className="h-5 w-5" />
                        <h4 className="font-semibold">Driver Information (Read-only)</h4>
                    </div>
                    <div>
                      <Label htmlFor="ageRange">Age Range</Label>
                      <Input id="ageRange" value={userProfile.driverDetails.ageRange || "Not set"} readOnly className="mt-1 bg-muted/50" />
                    </div>
                    <div>
                      <Label htmlFor="drivingExperience">Driving Experience</Label>
                      <Input id="drivingExperience" value={userProfile.driverDetails.drivingExperience || "Not set"} readOnly className="mt-1 bg-muted/50" />
                    </div>
                    <div>
                      <Label htmlFor="primaryVehicle">Primary Vehicle</Label>
                      <Input id="primaryVehicle" value={userProfile.driverDetails.primaryVehicle || "Not set"} readOnly className="mt-1 bg-muted/50" />
                    </div>
                    <div>
                      <Label htmlFor="passengerCapacity">Passenger Capacity</Label>
                      <Input id="passengerCapacity" value={userProfile.driverDetails.passengerCapacity || "Not set"} readOnly className="mt-1 bg-muted/50" />
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
    