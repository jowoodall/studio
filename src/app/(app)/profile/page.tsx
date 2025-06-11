
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
  
  const [studentEmailInput, setStudentEmailInput] = useState(""); // Changed from studentIdentifierInput
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [managedStudents, setManagedStudents] = useState<string[]>([]); 

  const [parentIdentifierInput, setParentIdentifierInput] = useState("");
  const [associatedParents, setAssociatedParents] = useState<string[]>([]);

  useEffect(() => {
    async function fetchUserProfile() {
      if (authUser) {
        setIsLoadingProfile(true);
        setProfileError(null);
        try {
          const userDocRef = doc(db, "users", authUser.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            const data = userDocSnap.data() as UserProfileData;
            setUserProfile(data);
            setCanDrive(data.canDrive || false);
            setDriverDetails(data.driverDetails || { ageRange: "", drivingExperience: "", primaryVehicle: "", passengerCapacity: "" });
            setSelectedRoleForView(data.role); 
            setManagedStudents(data.managedStudentIds || []);
            setAssociatedParents(data.associatedParentIds || []);

          } else {
            console.log("No such user profile document!");
            setProfileError("User profile not found. Please complete your profile.");
            if (authUser.displayName && authUser.email) {
                try {
                    const newUserProfile: UserProfileData = {
                        uid: authUser.uid,
                        fullName: authUser.displayName,
                        email: authUser.email,
                        role: UserRole.STUDENT,
                        createdAt: Timestamp.now(),
                        avatarUrl: authUser.photoURL || "",
                        canDrive: false,
                        bio: "",
                        phone: "",
                        preferences: { notifications: "email", preferredPickupRadius: "5 miles" },
                        address: { street: "", city: "", state: "", zip: "" },
                        driverDetails: { ageRange: "", drivingExperience: "", primaryVehicle: "", passengerCapacity: ""},
                        managedStudentIds: [],
                        associatedParentIds: [],
                    };
                    await setDoc(doc(db, "users", authUser.uid), newUserProfile);
                    setUserProfile(newUserProfile);
                    setSelectedRoleForView(newUserProfile.role);
                    setProfileError(null); 
                    toast({ title: "Profile Initialized", description: "A basic profile has been created for you." });
                } catch (initError) {
                    console.error("Error initializing user profile:", initError);
                    setProfileError("Failed to initialize profile. Please try refreshing.");
                }
            } else {
                 setProfileError("User profile not found and could not initialize basic profile (missing display name or email).");
            }
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
          setProfileError("Failed to load profile. Please try again.");
        } finally {
          setIsLoadingProfile(false);
        }
      } else if (!authLoading) {
        setIsLoadingProfile(false);
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
    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", studentEmailToAdd));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        toast({ title: "Student Not Found", description: `No user found with email: ${studentEmailToAdd}. Please ensure the student has an account with this email.`, variant: "destructive" });
        setIsAddingStudent(false);
        return;
      }
      
      if (querySnapshot.docs.length > 1) {
        toast({ title: "Multiple Accounts Found", description: `Multiple accounts found with email: ${studentEmailToAdd}. Please contact support.`, variant: "destructive" });
        setIsAddingStudent(false);
        return;
      }

      const studentDocSnap = querySnapshot.docs[0];
      const studentIdToAdd = studentDocSnap.id; // This is the student's UID
      const studentData = studentDocSnap.data() as UserProfileData;

      if (studentData.role === UserRole.PARENT || studentData.role === UserRole.ADMIN) {
        toast({ title: "Invalid Role", description: `User with email ${studentEmailToAdd} is not a student.`, variant: "destructive" });
        setIsAddingStudent(false);
        return;
      }

      if (managedStudents.includes(studentIdToAdd)) {
        toast({ title: "Already Managed", description: `${studentData.fullName || 'Student'} (${studentEmailToAdd}) is already in your managed list.` });
        setStudentEmailInput("");
        setIsAddingStudent(false);
        return;
      }
      
      const batch = writeBatch(db);

      const parentDocRef = doc(db, "users", authUser.uid);
      batch.update(parentDocRef, {
        managedStudentIds: arrayUnion(studentIdToAdd)
      });

      const studentDocRef = doc(db, "users", studentIdToAdd);
      batch.update(studentDocRef, {
        associatedParentIds: arrayUnion(authUser.uid)
      });

      await batch.commit();

      setManagedStudents(prev => [...new Set([...prev, studentIdToAdd])]); 
      setStudentEmailInput("");
      toast({ title: "Student Associated", description: `Student ${studentData.fullName || studentEmailToAdd} is now managed and linked.` });

    } catch (error: any) {
      console.error("Error associating student:", error);
      let errorMessage = "Could not associate student. Please try again.";
      if (error.message?.includes("indexes")) {
          errorMessage = "An index is required for this operation. Please check the browser console for a link to create it in Firebase."
      } else if (error.message?.includes("permission-denied")) {
          errorMessage = "Permission denied. Please check Firestore security rules."
      }
      toast({ title: "Association Failed", description: errorMessage, variant: "destructive" });
    } finally {
      setIsAddingStudent(false);
    }
  };

  const handleAddParent = () => {
    if (!authUser) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    const parentIdToAdd = parentIdentifierInput.trim();
    if (parentIdToAdd === "") {
      toast({ title: "Input Required", description: "Please enter a parent/guardian identifier (UID).", variant: "destructive" });
      return;
    }
     if (parentIdToAdd === authUser.uid) {
      toast({ title: "Invalid Action", description: "You cannot add yourself as an associated parent to your own account.", variant: "destructive" });
      return;
    }
    setAssociatedParents(prev => [...new Set([...prev, parentIdToAdd])]);
    setParentIdentifierInput("");
    toast({ title: "Parent Association (Mock)", description: `Mock association with ${parentIdToAdd}. Real implementation needs Firestore logic and rules.`});
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
        <p className="text-muted-foreground mb-4">{profileError}</p>
        <Button asChild>
          <Link href="/dashboard">Go to Dashboard</Link>
        </Button>
      </div>
    )
  }
  
  if (!authUser || !userProfile) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
            <p className="text-muted-foreground">Please log in to view your profile or profile initialization failed.</p>
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
                {currentDisplayRole === UserRole.PARENT ? "Parent or Guardian" : currentDisplayRole}
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
                  {managedStudents.length > 0 && (
                      <div>
                      <h5 className="font-medium text-sm text-muted-foreground mt-4 mb-2">My Managed Students (User IDs):</h5>
                      <ul className="list-disc list-inside space-y-1 bg-muted/30 p-3 rounded-md">
                          {managedStudents.map((studentId, index) => (
                          // In a real app, you'd fetch student details (like name) using these IDs
                          <li key={index} className="text-sm">{studentId}</li> 
                          ))}
                      </ul>
                      </div>
                  )}
                </div>
              )}

              {selectedRoleForView === UserRole.STUDENT && (
                <div className="space-y-6 pl-4 border-l-2 border-blue-500/40 ml-2 pt-4 pb-4 animate-accordion-down">
                  <div className="flex items-center gap-2 text-blue-600 mb-2">
                      <Users className="h-5 w-5" />
                      <h4 className="font-semibold">My Parents/Guardians</h4>
                  </div>
                  <p className="text-xs text-muted-foreground">Link parents or guardians who can manage your ryd approvals by entering their User ID (UID).</p>
                  <div className="flex flex-col gap-2">
                      <Label htmlFor="parentIdentifier" className="sr-only">Parent/Guardian User ID</Label>
                      <Input
                      id="parentIdentifier"
                      placeholder="Enter Parent/Guardian's User ID (UID)"
                      value={parentIdentifierInput}
                      onChange={(e) => setParentIdentifierInput(e.target.value)}
                      className="mt-1"
                      />
                      <Button onClick={handleAddParent} variant="outline" className="mt-1 self-start">Add Parent/Guardian (Updates Local View)</Button>
                  </div>
                  {associatedParents.length > 0 && (
                      <div>
                      <h5 className="font-medium text-sm text-muted-foreground mt-4 mb-2">My Associated Parents/Guardians (User IDs):</h5>
                      <ul className="list-disc list-inside space-y-1 bg-muted/30 p-3 rounded-md">
                          {associatedParents.map((parentId, index) => (
                          <li key={index} className="text-sm">{parentId}</li>
                          ))}
                      </ul>
                      </div>
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
                      // TODO: Persist this change to Firestore for userProfile.canDrive
                    }}
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
                        onValueChange={(value) => {
                          setDriverDetails(prev => ({ ...prev, ageRange: value }));
                        }}
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
                        onValueChange={(value) => {
                          setDriverDetails(prev => ({ ...prev, drivingExperience: value }));
                        }}
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
                        onChange={(e) => {
                          setDriverDetails(prev => ({ ...prev, primaryVehicle: e.target.value }));
                        }}
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
                        onChange={(e) => {
                          setDriverDetails(prev => ({ ...prev, passengerCapacity: e.target.value }));
                        }}
                        placeholder="e.g., 4"
                        min="1"
                        className="mt-1"
                      />
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

    
