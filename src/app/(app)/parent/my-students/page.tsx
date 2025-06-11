
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
import { doc, getDoc } from 'firebase/firestore';

interface UserProfileData {
  uid: string;
  fullName: string;
  email: string;
  role: string;
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
}

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

interface SelectedStudentFullInfo extends ManagedStudentForList {
    associatedParentIds?: string[];
    associatedParentsDetails: AssociatedParentDetail[];
}

// interface UpcomingRyd { // Commenting out as studentRydzToShow is commented
//   id: string;
//   eventName: string;
//   date: string;
//   time: string;
//   destination?: string;
// }

// const mockStudentUpcomingRydz: UpcomingRyd[] = [ // Commenting out as studentRydzToShow is commented
//     { id: "ryd1", eventName: "School Play Rehearsal", date: "2024-12-05", time: "15:00" },
//     { id: "ryd2", eventName: "Soccer Practice", date: "2024-12-07", time: "09:30" },
//     { id: "ryd3", eventName: "Library Study Group", date: "2024-12-10", time: "18:00" },
// ];

export default function MyStudentsPage() {
  const { user: authUser, loading: authLoading } = useAuth();
  const [managedStudentsList, setManagedStudentsList] = useState<ManagedStudentForList[]>([]);
  const [selectedStudentDetails, setSelectedStudentDetails] = useState<SelectedStudentFullInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const fetchManagedStudents = useCallback(async () => {
    if (!authUser) return;
    setIsLoading(true);
    setError(null);
    try {
      const parentDocRef = doc(db, "users", authUser.uid);
      const parentDocSnap = await getDoc(parentDocRef);

      if (parentDocSnap.exists()) {
        const parentData = parentDocSnap.data() as UserProfileData;
        if (parentData.managedStudentIds && parentData.managedStudentIds.length > 0) {
          const studentPromises = parentData.managedStudentIds.map(async (studentId) => {
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
      } else {
        setError("Parent profile not found.");
      }
    } catch (e) {
      console.error("Error fetching managed students:", e);
      setError("Failed to load managed students.");
    } finally {
      setIsLoading(false);
    }
  }, [authUser]);

  useEffect(() => {
    if (!authLoading && authUser) {
      fetchManagedStudents();
    } else if (!authLoading && !authUser) {
      setIsLoading(false);
      setError("Please log in to view your students.");
    }
  }, [authUser, authLoading, fetchManagedStudents]);

  const handleStudentSelect = async (studentId: string) => {
    if (!studentId) {
        setSelectedStudentDetails(null);
        setSelectedStudentId(null);
        return;
    }
    setSelectedStudentId(studentId);
    setIsLoading(true);
    setError(null);

    try {
        const studentDocRef = doc(db, "users", studentId);
        const studentDocSnap = await getDoc(studentDocRef);

        if (studentDocSnap.exists()) {
            const studentData = studentDocSnap.data() as UserProfileData;
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

            setSelectedStudentDetails({
                ...basicInfo,
                associatedParentIds: studentData.associatedParentIds || [],
                associatedParentsDetails,
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
        setIsLoading(false);
    }
  };

  if (authLoading || (isLoading && managedStudentsList.length === 0 && !error)) {
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
        <Button onClick={fetchManagedStudents} className="mt-4">Try Again</Button>
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

  // const studentRydzToShow = selectedStudentDetails ? mockStudentUpcomingRydz.slice(0, 2) : []; // Commented out

  return (
    <>
      <PageHeader
        title="My Students"
        description="Select a student to view their profile, linked guardians, and ryd information."
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
             <p className="text-muted-foreground">You are not managing any students yet. You can add students from your main profile page.</p>
          )}
        </CardContent>
      </Card>

      {isLoading && selectedStudentId && (
           <div className="flex flex-col items-center justify-center py-10">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
            <p className="text-muted-foreground">Loading student details...</p>
          </div>
      )}

      {selectedStudentDetails && !isLoading && (
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
                        {parent.uid === authUser?.uid ? (
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
                  <Car className="mr-2 h-5 w-5 text-primary" />
                  Student's Rydz
                </CardTitle>
                <CardDescription>Quick overview of {selectedStudentDetails.fullName}'s upcoming rydz. (Mock Data)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* {studentRydzToShow.length > 0 ? ( // Commented out usage
                    studentRydzToShow.map(ryd => (
                        <div key={ryd.id} className="p-3 bg-muted/50 rounded-md">
                            <p className="font-semibold text-sm">{ryd.eventName}</p>
                            <div className="flex items-center text-xs text-muted-foreground mt-1">
                                <CalendarDays className="mr-1.5 h-3 w-3" /> {ryd.date}
                                <Clock className="ml-3 mr-1.5 h-3 w-3" /> {ryd.time}
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="text-sm text-muted-foreground">No upcoming rydz scheduled (mock data).</p>
                )} */}
                 <p className="text-sm text-muted-foreground">Rydz display temporarily commented out for debugging.</p>
                 <p className="text-xs text-muted-foreground pt-2">Note: Rydz data shown here is currently mock data and not live.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
      {!isLoading && !selectedStudentId && managedStudentsList.length > 0 && (
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
       {!isLoading && managedStudentsList.length === 0 && !error && (
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
    