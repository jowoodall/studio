
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { User, Users, ExternalLink, Car, CalendarDays, Clock, Loader2, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { type UserProfileData, UserRole, type GroupData, type RydData, type RydStatus, type ActiveRyd, ActiveRydStatus as ARStatus } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface ManagedStudentForList {
  id: string;
  fullName: string;
  email?: string;
  avatarUrl?: string;
  dataAiHint?: string;
}

interface AssociatedParentDetail {
    uid: string;
    fullName: string;
    email?: string;
}

interface ActiveGroupInfo {
  id: string;
  name: string;
}

interface SelectedStudentFullInfo extends ManagedStudentForList {
    associatedParentIds?: string[];
    associatedParentsDetails: AssociatedParentDetail[];
    activeGroups: ActiveGroupInfo[];
}

interface StudentRydInfo {
  id: string;
  eventName?: string;
  destination: string;
  rydTimestamp: Timestamp;
  status: RydStatus | ARStatus;
  driverName?: string;
  driverId?: string;
  assignedActiveRydId?: string;
  isDriver?: boolean;
}


export default function MyStudentsPage() {
  const { user: authUser, userProfile: authUserProfile, loading: authLoading, isLoadingProfile: isLoadingContextProfile } = useAuth();
  const { toast } = useToast();

  const [managedStudentsList, setManagedStudentsList] = useState<ManagedStudentForList[]>([]);
  const [selectedStudentDetails, setSelectedStudentDetails] = useState<SelectedStudentFullInfo | null>(null);
  const [isFetchingStudentDetails, setIsFetchingStudentDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  
  const [studentRydz, setStudentRydz] = useState<StudentRydInfo[]>([]);
  const [isFetchingStudentRydz, setIsFetchingStudentRydz] = useState(false);

  const fetchManagedStudentsList = useCallback(async () => {
    if (!authUserProfile || authUserProfile.role !== UserRole.PARENT) {
      setManagedStudentsList([]);
      if (authUserProfile && authUserProfile.role !== UserRole.PARENT) {
          setError("This page is for parents only.");
      }
      return;
    }
    setIsFetchingStudentDetails(true); 
    setError(null);
    try {
      if (authUserProfile.managedStudentIds && authUserProfile.managedStudentIds.length > 0) {
        const studentPromises = authUserProfile.managedStudentIds.map(async (studentId) => {
          const studentDocRef = doc(db, "users", studentId);
          const studentDocSnap = await getDoc(studentDocRef);
          if (studentDocSnap.exists()) {
            const sData = studentDocSnap.data() as UserProfileData;
            return {
              id: studentDocSnap.id,
              fullName: sData.fullName,
              email: sData.email,
              avatarUrl: sData.avatarUrl,
              dataAiHint: sData.dataAiHint,
            };
          }
          return null;
        });
        const students = (await Promise.all(studentPromises)).filter(Boolean) as ManagedStudentForList[];
        setManagedStudentsList(students);
      } else {
        setManagedStudentsList([]);
      }
    } catch (e) {
      console.error("Error fetching managed students list:", e);
      setError("Failed to load managed students list.");
    } finally {
      setIsFetchingStudentDetails(false);
    }
  }, [authUserProfile]);

  useEffect(() => {
    if (!authLoading && !isLoadingContextProfile && authUserProfile) {
      fetchManagedStudentsList();
    } else if (!authLoading && !isLoadingContextProfile && !authUserProfile && authUser) {
      setError("Profile not loaded or you might not have parent permissions.");
    } else if (!authLoading && !authUser) {
      setError("Please log in to view your students.");
    }
  }, [authUser, authUserProfile, authLoading, isLoadingContextProfile, fetchManagedStudentsList]);
  
  const fetchStudentRydz = useCallback(async (studentId: string, studentName: string) => {
    if (!studentId) return;
    setIsFetchingStudentRydz(true);
    setStudentRydz([]);
    try {
      // Statuses for passenger requests
      const upcomingRequestStatuses: RydStatus[] = [
        'requested', 'searching_driver', 'driver_assigned', 'confirmed_by_driver',
        'en_route_pickup', 'en_route_destination'
      ];
      // Statuses for driver rydz
      const upcomingActiveRydStatuses: ARStatus[] = [
        ARStatus.PLANNING,
        ARStatus.AWAITING_PASSENGERS,
        ARStatus.IN_PROGRESS_PICKUP,
        ARStatus.IN_PROGRESS_ROUTE,
      ];
      
      // Query 1: Rydz requested FOR the student (as passenger)
      const requestsForUserQuery = query(
        collection(db, "rydz"),
        where("passengerIds", "array-contains", studentId),
        where("status", "in", upcomingRequestStatuses)
      );

      // Query 2: Active Rydz where the student is the DRIVER
      const activeRydzAsDriverQuery = query(
        collection(db, "activeRydz"),
        where("driverId", "==", studentId),
        where("status", "in", upcomingActiveRydStatuses)
      );
      
      const [
        requestsForUserSnap,
        activeRydzAsDriverSnap
      ] = await Promise.all([
        getDocs(requestsForUserQuery),
        getDocs(activeRydzAsDriverQuery)
      ]);
      
      // Process passenger rydz
      const passengerRydzPromises = requestsForUserSnap.docs.map(async (docSnap) => {
        const rydData = docSnap.data() as RydData;
        let driverName = "Pending";
        let driverId: string | undefined = undefined;
        if (rydData.driverId) {
            try {
                const driverDoc = await getDoc(doc(db, "users", rydData.driverId));
                if (driverDoc.exists()) {
                    driverName = (driverDoc.data() as UserProfileData).fullName;
                    driverId = driverDoc.id;
                }
            } catch (e) { console.warn(`Could not fetch driver profile for ${rydData.driverId}`); }
        }
        return {
            id: docSnap.id,
            eventName: rydData.eventName || rydData.destination,
            destination: rydData.destination,
            rydTimestamp: rydData.rydTimestamp,
            status: rydData.status,
            driverName: driverName,
            driverId: driverId,
            assignedActiveRydId: rydData.assignedActiveRydId,
            isDriver: false,
        };
      });

      // Process driver rydz
      const driverRydz = activeRydzAsDriverSnap.docs.map(docSnap => {
        const activeRyd = docSnap.data() as ActiveRyd;
        return {
            id: docSnap.id,
            eventName: activeRyd.eventName || activeRyd.finalDestinationAddress,
            destination: activeRyd.finalDestinationAddress || 'Destination TBD',
            rydTimestamp: activeRyd.plannedArrivalTime || activeRyd.proposedDepartureTime || activeRyd.createdAt,
            status: activeRyd.status,
            driverName: studentName, // The student is the driver
            driverId: studentId,
            assignedActiveRydId: docSnap.id,
            isDriver: true,
        };
      });

      const passengerRydz = (await Promise.all(passengerRydzPromises)).filter(Boolean) as StudentRydInfo[];
      const combinedRydz = [...passengerRydz, ...driverRydz];
      
      combinedRydz.sort((a, b) => a.rydTimestamp.toMillis() - b.rydTimestamp.toMillis());
      setStudentRydz(combinedRydz);

    } catch (e: any) {
      console.error("Error fetching student rydz:", e);
      toast({ title: "Error", description: "Could not load the student's upcoming rydz. Please check Firestore security rules.", variant: "destructive" });
    } finally {
      setIsFetchingStudentRydz(false);
    }
  }, [toast]);

  const handleStudentSelect = async (studentId: string) => {
    if (!studentId) {
        setSelectedStudentDetails(null);
        setSelectedStudentId(null);
        setStudentRydz([]);
        return;
    }
    setSelectedStudentId(studentId);
    setIsFetchingStudentDetails(true);
    setError(null);
    setStudentRydz([]);

    try {
        const studentDocRef = doc(db, "users", studentId);
        const studentDocSnap = await getDoc(studentDocRef);

        if (studentDocSnap.exists()) {
            const studentData = studentDocSnap.data() as UserProfileData;
            
            // Fetch student's profile and their rydz concurrently
            fetchStudentRydz(studentId, studentData.fullName);

            const basicInfo: ManagedStudentForList = {
                id: studentDocSnap.id,
                fullName: studentData.fullName,
                email: studentData.email,
                avatarUrl: studentData.avatarUrl,
                dataAiHint: studentData.dataAiHint,
            };

            let associatedParentsDetails: AssociatedParentDetail[] = [];
            if (studentData.associatedParentIds && studentData.associatedParentIds.length > 0) {
                const parentDetailPromises = studentData.associatedParentIds.map(async (pid) => {
                    const parentDocRef = doc(db, "users", pid);
                    const parentDocSnap = await getDoc(parentDocRef);
                    if (parentDocSnap.exists()) {
                        const pData = parentDocSnap.data() as UserProfileData;
                        return { uid: pid, fullName: pData.fullName, email: pData.email };
                    }
                    return null;
                });
                associatedParentsDetails = (await Promise.all(parentDetailPromises)).filter(Boolean) as AssociatedParentDetail[];
            }

            let activeGroups: ActiveGroupInfo[] = [];
            if (studentData.joinedGroupIds && studentData.joinedGroupIds.length > 0) {
                const groupPromises = studentData.joinedGroupIds.map(async (groupId) => {
                    const groupDocRef = doc(db, "groups", groupId);
                    const groupDocSnap = await getDoc(groupDocRef);
                    if (groupDocSnap.exists()) {
                        const groupData = groupDocSnap.data() as GroupData;
                        return { id: groupDocSnap.id, name: groupData.name };
                    }
                    return null;
                });
                activeGroups = (await Promise.all(groupPromises)).filter(Boolean) as ActiveGroupInfo[];
            }

            setSelectedStudentDetails({
                ...basicInfo,
                associatedParentIds: studentData.associatedParentIds || [],
                associatedParentsDetails,
                activeGroups,
            });
        } else {
            setError("Selected student details not found.");
            setSelectedStudentDetails(null);
        }
    } catch (e) {
        console.error("Error fetching selected student details:", e);
        setError("Failed to load student details.");
        setSelectedStudentDetails(null);
    } finally {
        setIsFetchingStudentDetails(false);
    }
  };

  const isLoading = authLoading || isLoadingContextProfile;

  if (isLoading && managedStudentsList.length === 0 && !error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading student data...</p>
      </div>
    );
  }

  if (error && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Error</h2>
        <p className="text-muted-foreground px-4">{error}</p>
        <Button onClick={fetchManagedStudentsList} className="mt-4">Try Again</Button>
      </div>
    );
  }

  if (!authUser && !authLoading) { 
      return (
          <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
              <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
              <p className="text-muted-foreground">You must be logged in to view this page.</p>
              <Button asChild className="mt-4"><Link href="/login">Log In</Link></Button>
          </div>
      );
  }
  
  if (authUserProfile && authUserProfile.role !== UserRole.PARENT && !isLoading) {
     return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground px-4">This page is only accessible to users with the Parent role.</p>
            <Button asChild className="mt-4"><Link href="/dashboard">Go to Dashboard</Link></Button>
        </div>
     );
  }

  return (
    <>
      <PageHeader
        title="My Students"
        description="Select a student to view their profile, linked guardians, active groups, and ryd information."
      />

      <Card className="mb-6 shadow-lg">
        <CardHeader>
          <CardTitle>Select Student</CardTitle>
        </CardHeader>
        <CardContent>
          <Label htmlFor="studentSelect" className="sr-only">Select a student</Label>
          {managedStudentsList.length > 0 ? (
            <Select onValueChange={handleStudentSelect} value={selectedStudentId || ""}>
              <SelectTrigger id="studentSelect" className="w-full md:w-[300px]">
                <SelectValue placeholder="Choose a student..." />
              </SelectTrigger>
              <SelectContent>
                {managedStudentsList.map((student) => (
                  <SelectItem key={student.id} value={student.id}>
                    {student.fullName} ({student.email || 'No email'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
             <p className="text-muted-foreground">{isFetchingStudentDetails ? "Loading students..." : "You are not managing any students yet. You can add students from your main profile page."}</p>
          )}
        </CardContent>
      </Card>

      {isFetchingStudentDetails && selectedStudentId && ( 
           <div className="flex flex-col items-center justify-center py-10">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
            <p className="text-muted-foreground">Loading student details...</p>
          </div>
      )}

      {selectedStudentDetails && !isFetchingStudentDetails && (
        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-1">
            <Card className="shadow-lg text-center">
              <CardHeader>
                <Avatar className="h-24 w-24 mx-auto mb-4 border-4 border-primary">
                  <AvatarImage src={selectedStudentDetails.avatarUrl || `https://placehold.co/128x128.png?text=${selectedStudentDetails.fullName.split(" ").map(n=>n[0]).join("")}`} alt={selectedStudentDetails.fullName} data-ai-hint={selectedStudentDetails.dataAiHint || "student avatar"}/>
                  <AvatarFallback>{selectedStudentDetails.fullName.split(" ").map(n => n[0]).join("")}</AvatarFallback>
                </Avatar>
                <CardTitle className="font-headline text-xl">{selectedStudentDetails.fullName}</CardTitle>
                {selectedStudentDetails.email && <CardDescription>{selectedStudentDetails.email}</CardDescription>}
              </CardHeader>
              <CardContent>
                <Button className="w-full" asChild>
                    <Link href={`/profile/edit?userId=${selectedStudentDetails.id}`}>
                        <User className="mr-2 h-4 w-4" /> View/Edit Student Profile
                    </Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="md:col-span-2 space-y-6">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="mr-2 h-5 w-5 text-primary" />
                  Linked Parents & Guardians
                </CardTitle>
                <CardDescription>Other adults authorized for {selectedStudentDetails.fullName}.</CardDescription>
              </CardHeader>
              <CardContent>
                {selectedStudentDetails.associatedParentsDetails.length > 0 ? (
                  <ul className="space-y-3">
                    {selectedStudentDetails.associatedParentsDetails.map(parent => (
                      <li key={parent.uid} className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
                        <div>
                          <p className="font-medium">{parent.fullName}</p>
                          <p className="text-xs text-muted-foreground">{parent.email || 'No email'}</p>
                        </div>
                        {parent.uid === authUserProfile?.uid ? ( 
                           <span className="text-xs text-primary font-semibold">This is you</span>
                        ) : (
                            <Button variant="ghost" size="sm" asChild>
                                <Link href={`/profile/view/${parent.uid}`}>
                                    View Profile <ExternalLink className="ml-1.5 h-3 w-3" />
                                </Link>
                            </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No other parents or guardians are linked to this student in the system.</p>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center">
                        <Users className="mr-2 h-5 w-5 text-green-500" /> 
                        Active Groups
                    </CardTitle>
                    <CardDescription>{selectedStudentDetails.fullName}'s joined carpool groups.</CardDescription>
                </CardHeader>
                <CardContent>
                    {selectedStudentDetails.activeGroups.length > 0 ? (
                        <ul className="space-y-3">
                            {selectedStudentDetails.activeGroups.map(group => (
                                <li key={group.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
                                    <p className="font-medium">{group.name}</p>
                                    <Button variant="ghost" size="sm" asChild>
                                        <Link href={`/groups/${group.id}`}>
                                            View Group <ExternalLink className="ml-1.5 h-3 w-3" />
                                        </Link>
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-sm text-muted-foreground">This student is not a member of any active groups.</p>
                    )}
                </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Car className="mr-2 h-5 w-5 text-blue-500" />
                  Student's Upcoming Rydz
                </CardTitle>
                <CardDescription>
                  Upcoming rydz for {selectedStudentDetails.fullName}.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isFetchingStudentRydz ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <p className="ml-2 text-muted-foreground">Loading rydz...</p>
                  </div>
                ) : studentRydz.length > 0 ? (
                  <ul className="space-y-3 max-h-96 overflow-y-auto">
                    {studentRydz.map(ryd => (
                      <li key={ryd.id} className="p-3 border rounded-md bg-muted/20">
                        <h4 className="font-semibold text-sm">{ryd.eventName}</h4>
                        <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
                          <p className="flex items-center"><CalendarDays className="mr-1.5 h-3 w-3" /> {format(ryd.rydTimestamp.toDate(), "MMM d, yyyy 'at' p")}</p>
                          {ryd.isDriver ? (
                              <p className="flex items-center font-medium text-primary"><User className="mr-1.5 h-3 w-3" /> Driving</p>
                          ) : (
                              <p className="flex items-center"><User className="mr-1.5 h-3 w-3" /> Driver: {ryd.driverName}</p>
                          )}
                          <p className="flex items-center font-medium capitalize"><Clock className="mr-1.5 h-3 w-3" /> Status: {String(ryd.status).replace(/_/g, ' ')}</p>
                        </div>
                        {ryd.assignedActiveRydId && (
                          <Button asChild variant="link" size="sm" className="px-0 h-auto mt-1">
                            <Link href={`/rydz/tracking/${ryd.assignedActiveRydId}`}>
                              {ryd.isDriver ? 'Manage Ryd' : 'View Details'}
                              <ExternalLink className="ml-1 h-3 w-3" />
                            </Link>
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No upcoming rydz found for this student.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
      {!isLoading && !selectedStudentId && managedStudentsList.length > 0 && !isFetchingStudentDetails && (
            <Card className="text-center py-12 shadow-md">
            <CardHeader>
                <User className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <CardTitle className="font-headline text-xl">No Student Selected</CardTitle>
            </CardHeader>
            <CardContent>
                <CardDescription>
                Please select a student from the dropdown above to view their details.
                </CardDescription>
            </CardContent>
            </Card>
        )
      }
       {!isLoading && managedStudentsList.length === 0 && !error && !isFetchingStudentDetails && (
         <Card className="text-center py-12 shadow-md">
            <CardHeader>
                <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <CardTitle className="font-headline text-xl">No Students Managed</CardTitle>
            </CardHeader>
            <CardContent>
                <CardDescription>
                You are not currently managing any students. You can add students via your main profile page.
                </CardDescription>
                 <Button asChild className="mt-4"><Link href="/profile">Go to My Profile</Link></Button>
            </CardContent>
            </Card>
       )}
    </>
  );
}
