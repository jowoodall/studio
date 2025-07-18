
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CheckCircle, XCircle, ShieldCheck, UserCircle, Car, Loader2, UserCog, Trash2, ShieldBan, PlusCircle, Check, Users } from "lucide-react";
import Link from "next/link";
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { type UserProfileData, UserRole } from '@/types';
import { manageDriverApprovalAction, type ManageDriverApprovalInput, updateDriverListAction, addApprovedDriverByEmailAction, getParentApprovalsPageData, type ParentApprovalsPageData } from '@/actions/parentActions';
import { associateStudentWithParentAction } from '@/actions/userActions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from '@/components/ui/label';

interface ParentApprovalsClientProps {
    initialData: ParentApprovalsPageData;
}

export function ParentApprovalsClient({ initialData }: ParentApprovalsClientProps) {
  const { user: authUser, userProfile } = useAuth();
  const { toast } = useToast();

  const [pageData, setPageData] = useState<ParentApprovalsPageData>(initialData);
  const [isProcessing, setIsProcessing] = useState<Record<string, boolean>>({});

  const [addDriverEmail, setAddDriverEmail] = useState("");
  const [isAddingDriver, setIsAddingDriver] = useState(false);

  const [isStudentSelectDialogOpen, setIsStudentSelectDialogOpen] = useState(false);
  const [driverToAdd, setDriverToAdd] = useState<{ id: string; email: string; name: string } | null>(null);
  const [selectedStudentsForApproval, setSelectedStudentsForApproval] = useState<Record<string, boolean>>({});

  const [studentEmailInput, setStudentEmailInput] = useState("");
  const [isAddingStudent, setIsAddingStudent] = useState(false);

  const refreshAllData = useCallback(async () => {
    if (!authUser) return;
    try {
        const result = await getParentApprovalsPageData(authUser.uid);
        if (result.success && result.data) {
            setPageData(result.data);
        } else {
            toast({ title: "Refresh Failed", description: result.message || "Could not refresh page data.", variant: "destructive" });
        }
    } catch (e: any) {
        toast({ title: "Error", description: "Failed to refresh data.", variant: "destructive" });
    }
  }, [authUser, toast]);

  const handleApproval = async (request: ParentApprovalsPageData['pendingApprovals'][0], decision: ManageDriverApprovalInput['decision']) => {
      if (!authUser) return;
      const key = `${request.activeRydId}-${request.student.uid}`;
      setIsProcessing(prev => ({ ...prev, [key]: true }));
      try {
        const result = await manageDriverApprovalAction({
            parentUserId: authUser.uid,
            studentUserId: request.student.uid,
            driverId: request.driver.uid,
            activeRydId: request.activeRydId,
            decision
        });
        if(result.success) {
            toast({ title: "Decision Submitted", description: result.message });
            refreshAllData(); 
        } else {
            toast({ title: "Action Failed", description: result.message, variant: "destructive" });
        }
      } catch (e: any) {
          toast({ title: "Error", description: `An unexpected error occurred: ${e.message}`, variant: "destructive" });
      } finally {
          setIsProcessing(prev => ({ ...prev, [key]: false }));
      }
  };

  const handleRemoveFromList = async (driverId: string, list: 'approved' | 'declined') => {
    if (!authUser) return;
    const key = `${list}-${driverId}`;
    setIsProcessing(prev => ({ ...prev, [key]: true }));
    try {
        const result = await updateDriverListAction({ parentUserId: authUser.uid, driverId, list, action: 'remove' });
        if (result.success) {
            toast({ title: "List Updated", description: result.message });
            refreshAllData(); 
        } else {
            toast({ title: "Update Failed", description: result.message, variant: "destructive" });
        }
    } catch (e: any) {
        toast({ title: "Error", description: `An unexpected error occurred: ${e.message}`, variant: "destructive" });
    } finally {
        setIsProcessing(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleFindDriverByEmail = async (emailToFind?: string) => {
    if (!authUser) return;
    const targetEmail = emailToFind || addDriverEmail;
    if (!targetEmail.trim()) {
      toast({ title: "Email required", description: "Please enter a driver's email.", variant: "destructive"});
      return;
    }
    
    setIsAddingDriver(true);

    const result = await addApprovedDriverByEmailAction({
        parentUserId: authUser.uid,
        driverEmail: targetEmail.trim(),
        studentIds: [] // We pass an empty array because we just want to find the driver first.
    });

    if (result.success && result.driverId && result.driverName) {
        setDriverToAdd({ id: result.driverId, email: targetEmail.trim(), name: result.driverName });
        
        const alreadyApprovedFor = userProfile?.approvedDrivers?.[result.driverId] || [];
        const initialSelection: Record<string, boolean> = {};
        pageData.managedStudents.forEach(student => {
            initialSelection[student.uid] = alreadyApprovedFor.includes(student.uid);
        });
        setSelectedStudentsForApproval(initialSelection);
        setIsStudentSelectDialogOpen(true);
    } else {
        toast({ title: "Not Found", description: result.message, variant: "destructive"});
    }
    setIsAddingDriver(false);
  };
  
  const handleConfirmAddDriver = async () => {
    if (!authUser || !driverToAdd) return;
    
    const selectedIds = Object.entries(selectedStudentsForApproval)
      .filter(([, isSelected]) => isSelected)
      .map(([studentId]) => studentId);
      
    if (selectedIds.length === 0) {
        toast({ title: "No Students Selected", description: "Please select at least one student to approve this driver for.", variant: "destructive"});
        return;
    }
    setIsAddingDriver(true);
    try {
        const result = await addApprovedDriverByEmailAction({
            parentUserId: authUser.uid,
            driverEmail: driverToAdd.email,
            studentIds: selectedIds,
        });
        if (result.success) {
            toast({ title: "Driver Approved", description: result.message });
            setAddDriverEmail("");
            setIsStudentSelectDialogOpen(false);
            setDriverToAdd(null);
            refreshAllData();
        } else {
            toast({ title: "Failed to Add Driver", description: result.message, variant: "destructive" });
        }
    } catch(e: any) {
        toast({ title: "Error", description: e.message || "An unexpected error occurred.", variant: "destructive" });
    } finally {
        setIsAddingDriver(false);
    }
  };

  const handleStudentCheckboxChange = (studentId: string, checked: boolean) => {
    setSelectedStudentsForApproval(prev => ({ ...prev, [studentId]: checked }));
  };
  
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
      const result = await associateStudentWithParentAction({
        parentUid: authUser.uid,
        studentEmail: studentEmailToAdd,
      });

      if (result.success) {
        toast({ title: "Student Associated", description: result.message });
        setStudentEmailInput("");
        refreshAllData(); 
      } else {
        toast({ title: "Association Failed", description: result.message, variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Association Failed", description: error.message || "Could not associate student.", variant: "destructive" });
    } finally {
      setIsAddingStudent(false);
    }
  };

  const renderDriverList = (drivers: ParentApprovalsPageData['approvedDrivers'], listType: 'approved' | 'declined') => {
    const EmptyStateIcon = listType === 'approved' ? ShieldCheck : ShieldBan;
    const emptyTitle = listType === 'approved' ? "No Approved Drivers" : "No Declined Drivers";
    const emptyDescription = listType === 'approved' 
      ? "You have not added any drivers to your permanent approved list yet."
      : "You have not declined any drivers yet.";

    if (drivers.length === 0) {
        return (
           <div className="text-center py-10">
              <EmptyStateIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-headline text-xl">{emptyTitle}</h3>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-sm mx-auto">{emptyDescription}</p>
          </div>
        )
    }
    return (
      <div className="space-y-4">
          {drivers.map(driver => {
              const key = `${listType}-${driver.uid}`;
              const isLoadingAction = isProcessing[key];
              const approvedForStudentIds = userProfile?.approvedDrivers?.[driver.uid] || [];
              const approvedForStudents = pageData.managedStudents.filter(s => approvedForStudentIds.includes(s.uid));

              return (
                  <div key={driver.uid} className="p-3 border rounded-lg shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 min-w-0">
                          <Avatar className="h-12 w-12 flex-shrink-0">
                              <AvatarImage src={driver.avatarUrl} alt={driver.fullName} data-ai-hint={driver.dataAiHint} />
                              <AvatarFallback>{driver.fullName.split(" ").map(n=>n[0]).join("")}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                              <Link href={`/profile/view/${driver.uid}`} className="font-medium hover:underline break-words truncate block">{driver.fullName}</Link>
                              <p className="text-xs text-muted-foreground break-words truncate">{driver.email}</p>
                          </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                          {listType === 'approved' && (
                            <Button variant="ghost" size="sm" onClick={() => handleFindDriverByEmail(driver.email)}>
                                <UserCog className="mr-2 h-4 w-4" /> Edit
                            </Button>
                          )}
                          <Button variant="destructive" size="sm" onClick={() => handleRemoveFromList(driver.uid, listType)} disabled={isLoadingAction}>
                            {isLoadingAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />} Remove
                          </Button>
                      </div>
                    </div>
                     {listType === 'approved' && (
                        <div className="mt-3 pt-3 border-t">
                            <h5 className="text-xs font-semibold text-muted-foreground">Approved for:</h5>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                                {approvedForStudents.length > 0 ? approvedForStudents.map(student => (
                                    <div key={student.uid} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <UserCircle className="h-3 w-3" />
                                        <span>{student.fullName}</span>
                                    </div>
                                )) : <p className="text-xs text-muted-foreground">No students currently selected.</p>}
                            </div>
                        </div>
                    )}
                  </div>
              );
          })}
      </div>
    );
  };
  
    return (
    <>
      <h2 className="font-headline text-2xl font-semibold text-primary mb-4">Pending Driver Requests</h2>
      {pageData.pendingApprovals.length > 0 ? (
        <div className="space-y-6">
          {pageData.pendingApprovals.map((request) => {
            const key = `${request.activeRydId}-${request.student.uid}`;
            const isLoadingAction = isProcessing[key];
            return (
              <Card key={key} className="shadow-lg border-2 border-primary/50">
                <CardHeader className="relative block sm:flex sm:items-start sm:gap-4">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16 flex-shrink-0">
                      <AvatarImage src={request.driver.avatarUrl || `https://placehold.co/100x100.png?text=${request.driver.fullName.split(" ").map(n=>n[0]).join("")}`} alt={request.driver.fullName} data-ai-hint={request.driver.dataAiHint || "driver photo"} />
                      <AvatarFallback>{request.driver.fullName.split(" ").map(n=>n[0]).join("")}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="font-headline text-xl break-words">{request.driver.fullName}</CardTitle>
                      <CardDescription>Request to drive <span className="font-semibold text-foreground">{request.student.fullName}</span></CardDescription>
                    </div>
                  </div>
                  <div className="mt-4 sm:mt-0 sm:absolute sm:top-6 sm:right-6">
                    <Button variant="outline" size="sm" asChild className="w-full sm:w-auto">
                      <Link href={`/profile/view/${request.driver.uid}`}><UserCircle className="mr-2 h-4 w-4" /> View Profile</Link>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="p-3 bg-muted/50 rounded-md border text-sm space-y-1 break-words">
                    <p><span className="font-semibold">Ryd To:</span> {request.rydDetails.eventName}</p>
                    <p><span className="font-semibold">At:</span> {request.rydDetails.destination}</p>
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col items-start gap-4">
                    <div className="text-xs text-muted-foreground w-full">Approve this driver just for this ryd, or add them to your permanent list of approved drivers.</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 w-full">
                        <Button variant="destructive" onClick={() => handleApproval(request, 'reject')} disabled={isLoadingAction} className="min-h-[44px] sm:col-span-2 md:col-span-1">
                            {isLoadingAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />} Reject
                        </Button>
                        <Button variant="outline" onClick={() => handleApproval(request, 'approve_once')} disabled={isLoadingAction} className="min-h-[44px]">
                            {isLoadingAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Car className="mr-2 h-4 w-4" />} Approve Once
                        </Button>
                        <Button onClick={() => handleApproval(request, 'approve_permanently')} className="bg-green-600 hover:bg-green-700 min-h-[44px]" disabled={isLoadingAction}>
                            {isLoadingAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />} Approve & Add
                        </Button>
                    </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="text-center py-12 shadow-md">
          <CardHeader>
            <ShieldCheck className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <CardTitle className="font-headline text-2xl">No Pending Approvals</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="leading-relaxed max-w-sm mx-auto">
              There are no new driver approval requests for your students at this time.
            </CardDescription>
          </CardContent>
        </Card>
      )}

      <Separator className="my-8" />
      
      <div className="grid md:grid-cols-2 gap-8">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center"><Users className="mr-2 h-5 w-5 text-primary"/>Manage My Students</CardTitle>
            <CardDescription>Link students you are responsible for by entering their email address.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                    type="email"
                    placeholder="Enter Student's Email Address"
                    value={studentEmailInput}
                    onChange={(e) => setStudentEmailInput(e.target.value)}
                    className="flex-grow"
                    />
                    <Button onClick={handleAddStudent} variant="outline" className="w-full sm:w-auto" disabled={isAddingStudent}>
                        {isAddingStudent ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />} Add Student
                    </Button>
                </div>
                {pageData.managedStudents.length > 0 && (
                    <div className="pt-4">
                        <h5 className="font-medium text-sm text-muted-foreground mb-2">My Managed Students:</h5>
                        <ul className="space-y-2">
                            {pageData.managedStudents.map((student) => (
                                <li key={student.uid} className="text-sm flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                                  <Avatar className="h-8 w-8 flex-shrink-0">
                                      <AvatarImage src={student.avatarUrl} alt={student.fullName} data-ai-hint={student.dataAiHint} />
                                      <AvatarFallback>{student.fullName.split(" ").map(n=>n[0]).join("")}</AvatarFallback>
                                  </Avatar>
                                  <div className="min-w-0">
                                    <span className="font-medium truncate block break-words">{student.fullName}</span>
                                    <p className="text-xs text-muted-foreground truncate break-words">{student.email}</p>
                                  </div>
                                </li> 
                            ))}
                        </ul>
                    </div>
                )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>My Driver Lists</CardTitle>
            <CardDescription>Proactively approve a driver you trust by entering their email.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-2 items-start mb-4">
                <Input
                  type="email"
                  placeholder="driver@example.com"
                  value={addDriverEmail}
                  onChange={(e) => setAddDriverEmail(e.target.value)}
                  className="flex-grow"
                  disabled={isAddingDriver}
                />
                <Button onClick={() => handleFindDriverByEmail()} disabled={isAddingDriver || !addDriverEmail.trim()} className="w-full sm:w-auto">
                  {isAddingDriver ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />} Add/Edit Driver
                </Button>
            </div>
             <Tabs defaultValue="approved" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="approved"><ShieldCheck className="mr-2 h-4 w-4"/>Approved ({pageData.approvedDrivers.length})</TabsTrigger>
                    <TabsTrigger value="declined"><ShieldBan className="mr-2 h-4 w-4"/>Declined ({pageData.declinedDrivers.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="approved">
                    <Card>
                        <CardHeader className="p-4"><CardDescription>These drivers are approved for the students listed below.</CardDescription></CardHeader>
                        <CardContent className="p-4">{renderDriverList(pageData.approvedDrivers, 'approved')}</CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="declined">
                    <Card>
                        <CardHeader className="p-4"><CardDescription>These drivers are blocked from driving your students.</CardDescription></CardHeader>
                        <CardContent className="p-4">{renderDriverList(pageData.declinedDrivers, 'declined')}</CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isStudentSelectDialogOpen} onOpenChange={setIsStudentSelectDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Approve Driver for Students</DialogTitle>
                <DialogDescription>
                    Select which of your students you want to approve <span className="font-bold">{driverToAdd?.name}</span> to drive.
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                {pageData.managedStudents.length > 0 ? pageData.managedStudents.map(student => (
                    <div key={student.uid} className="flex items-center space-x-2">
                        <Checkbox
                            id={`student-${student.uid}`}
                            checked={selectedStudentsForApproval[student.uid] || false}
                            onCheckedChange={(checked) => handleStudentCheckboxChange(student.uid, !!checked)}
                        />
                        <Label htmlFor={`student-${student.uid}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            {student.fullName}
                        </Label>
                    </div>
                )) : (
                    <p className="text-sm text-muted-foreground">You have no students to select.</p>
                )}
            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="outline">Cancel</Button>
                </DialogClose>
                <Button onClick={handleConfirmAddDriver} disabled={isAddingDriver}>
                    {isAddingDriver ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                    Save Approvals
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
