
"use client";

import React, { useState } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { User, Mail, Users, CalendarClock, History, ShieldAlert, ExternalLink, Car } from "lucide-react"; // Added Car here
import Link from "next/link";
import type { Metadata } from 'next';

// No direct metadata export from client component files for dynamic pages. 
// If static title needed, define in a parent server component or layout.

interface Student {
  id: string;
  fullName: string;
  email?: string;
  avatarUrl: string;
  dataAiHint: string;
  linkedParents: { id: string; name: string; relationship: string }[];
  // Placeholder for additional info if needed
}

const mockManagedStudents: Student[] = [
  {
    id: "student001",
    fullName: "Jamie Doe",
    email: "jamie.doe@example.com",
    avatarUrl: "https://placehold.co/128x128.png?text=JD",
    dataAiHint: "teenager smiling",
    linkedParents: [
      { id: "parent001", name: "Alex Johnson (You)", relationship: "Parent" },
      { id: "parent002", name: "Chris Smith", relationship: "Guardian" },
    ],
  },
  {
    id: "student002",
    fullName: "Casey Lee",
    email: "casey.lee@example.com",
    avatarUrl: "https://placehold.co/128x128.png?text=CL",
    dataAiHint: "child happy",
    linkedParents: [
      { id: "parent001", name: "Alex Johnson (You)", relationship: "Parent" },
    ],
  },
  {
    id: "student003",
    fullName: "Morgan Brown",
    avatarUrl: "https://placehold.co/128x128.png?text=MB",
    dataAiHint: "teenager glasses",
    linkedParents: [
      { id: "parent001", name: "Alex Johnson (You)", relationship: "Parent" },
      { id: "parent003", name: "Pat Taylor", relationship: "Parent" },
      { id: "parent004", name: "Sam Davis", relationship: "Guardian" },
    ],
  },
];

export default function MyStudentsPage() {
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const selectedStudent = mockManagedStudents.find(s => s.id === selectedStudentId) || null;

  return (
    <>
      <PageHeader
        title="My Students"
        description="Select a student to view their profile, linked guardians, and ride information."
      />

      <Card className="mb-6 shadow-lg">
        <CardHeader>
          <CardTitle>Select Student</CardTitle>
        </CardHeader>
        <CardContent>
          <Label htmlFor="studentSelect" className="sr-only">Select a student</Label>
          <Select onValueChange={setSelectedStudentId} value={selectedStudentId || ""}>
            <SelectTrigger id="studentSelect" className="w-full md:w-[300px]">
              <SelectValue placeholder="Choose a student..." />
            </SelectTrigger>
            <SelectContent>
              {mockManagedStudents.map((student) => (
                <SelectItem key={student.id} value={student.id}>
                  {student.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedStudent ? (
        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-1">
            <Card className="shadow-lg text-center">
              <CardHeader>
                <Avatar className="h-24 w-24 mx-auto mb-4 border-4 border-primary">
                  <AvatarImage src={selectedStudent.avatarUrl} alt={selectedStudent.fullName} data-ai-hint={selectedStudent.dataAiHint}/>
                  <AvatarFallback>{selectedStudent.fullName.split(" ").map(n => n[0]).join("")}</AvatarFallback>
                </Avatar>
                <CardTitle className="font-headline text-xl">{selectedStudent.fullName}</CardTitle>
                {selectedStudent.email && <CardDescription>{selectedStudent.email}</CardDescription>}
              </CardHeader>
              <CardContent>
                <Button className="w-full" asChild>
                    <Link href={`/profile/edit?userId=${selectedStudent.id}`}> {/* Placeholder for editing student profile */}
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
                <CardDescription>Other adults authorized for {selectedStudent.fullName}.</CardDescription>
              </CardHeader>
              <CardContent>
                {selectedStudent.linkedParents.length > 0 ? (
                  <ul className="space-y-3">
                    {selectedStudent.linkedParents.map(parent => (
                      <li key={parent.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
                        <div>
                          <p className="font-medium">{parent.name}</p>
                          <p className="text-xs text-muted-foreground">{parent.relationship}</p>
                        </div>
                        {parent.name.includes("(You)") ? (
                           <span className="text-xs text-primary font-semibold">This is you</span>
                        ) : (
                            <Button variant="ghost" size="sm" asChild>
                                <Link href={`/profile/view/${parent.id}`}> {/* Placeholder for viewing parent profile */}
                                    View Profile <ExternalLink className="ml-1.5 h-3 w-3" />
                                </Link>
                            </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No other parents or guardians are linked to this student.</p>
                )}
              </CardContent>
               <CardFooter>
                <Button variant="outline">
                    <ShieldAlert className="mr-2 h-4 w-4" /> Manage Guardian Permissions {/* Placeholder */}
                </Button>
              </CardFooter>
            </Card>

            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Car className="mr-2 h-5 w-5 text-primary" />
                  Student's Rides
                </CardTitle>
                <CardDescription>Access {selectedStudent.fullName}'s ride information.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link href={`/students/${selectedStudent.id}/rides/upcoming`}> {/* Placeholder route */}
                    <CalendarClock className="mr-2 h-4 w-4" /> Upcoming Rides
                  </Link>
                </Button>
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link href={`/students/${selectedStudent.id}/rides/history`}> {/* Placeholder route */}
                    <History className="mr-2 h-4 w-4" /> Ride History
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
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
      )}
    </>
  );
}

