
"use client";

import React, { useState, useEffect, use, useCallback } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Users, Car, Trash2, UserPlus, ShieldCheck, Loader2, PlusCircle, UserX, Info, ArrowLeft, User, School } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { useAuth } from '@/context/AuthContext';
import { UserRole, type FamilyData, type UserProfileData } from "@/types";
import { Badge } from "@/components/ui/badge";
import { manageFamilyMemberAction } from "@/actions/familyActions";
import { cn } from "@/lib/utils";

type MemberRoleInFamily = "admin" | "member";

interface DisplayFamilyMember {
  id: string;
  name: string;
  avatarUrl?: string;
  dataAiHint?: string;
  roleInFamily: MemberRoleInFamily;
  email?: string;
  userRole: UserRole;
}

interface ManageFamilyPageParams {
  familyId: string;
}

const roleIconMap: Record<UserRole, React.ElementType> = {
  [UserRole.STUDENT]: School,
  [UserRole.PARENT]: User,
  [UserRole.DRIVER]: Car,
  [UserRole.ADMIN]: ShieldCheck,
};

export default function ManageFamilyMembersPage({ params: paramsPromise }: { params: Promise<ManageFamilyPageParams> }) {
  const params = use(paramsPromise);
  const { familyId } = params || {};
  const { toast } = useToast();
  const { user: authUser } = useAuth();

  const [family, setFamily] = useState<FamilyData | null>(null);
  const [members, setMembers] = useState<DisplayFamilyMember[]>([]);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [isProcessingRole, setIsProcessingRole] = useState<Record<string, boolean>>({});
  const [isProcessingRemoval, setIsProcessingRemoval] = useState<Record<string, boolean>>({});
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFamilyAndMembersData = useCallback(async () => {
    if (!familyId) {
      setError("Family ID is missing.");
      setIsLoadingPage(false);
      return;
    }
    setIsLoadingPage(true);
    setError(null);
    try {
      const familyDocRef = doc(db, "families", familyId);
      const familyDocSnap = await getDoc(familyDocRef);

      if (!familyDocSnap.exists()) {
        setError(`Family with ID "${familyId}" not found.`);
        setFamily(null);
        setMembers([]);
        setIsLoadingPage(false);
        return;
      }

      const familyData = { id: familyDocSnap.id, ...familyDocSnap.data() } as FamilyData;
      setFamily(familyData);

      if (familyData.memberIds && familyData.memberIds.length > 0) {
        const memberPromises = familyData.memberIds.map(async (memberUid) => {
          const userDocRef = doc(db, "users", memberUid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const userData = userDocSnap.data() as UserProfileData;
            return {
              id: userDocSnap.id,
              name: userData.fullName,
              avatarUrl: userData.avatarUrl,
              dataAiHint: userData.dataAiHint,
              roleInFamily: familyData.adminIds.includes(memberUid) ? "admin" : "member",
              email: userData.email,
              userRole: userData.role,
            };
          }
          return null;
        });
        const fetchedMembers = (await Promise.all(memberPromises)).filter(Boolean) as DisplayFamilyMember[];
        setMembers(fetchedMembers);
      } else {
        setMembers([]);
      }
    } catch (e: any) {
      console.error("Error fetching family/members data:", e);
      setError("Failed to load family or member data. " + (e.message || ""));
      toast({ title: "Error", description: "Could not load family/member information.", variant: "destructive" });
    } finally {
      setIsLoadingPage(false);
    }
  }, [familyId, toast]);

  useEffect(() => {
    fetchFamilyAndMembersData();
  }, [fetchFamilyAndMembersData]);

  const handleAction = async (
    action: 'add' | 'remove' | 'promote' | 'demote',
    targetMemberId: string,
    targetMemberEmail?: string
  ) => {
    if (!authUser || !family) return;

    const key = `${action}-${targetMemberId}`;
    if (action === 'promote' || action === 'demote') setIsProcessingRole(p => ({ ...p, [key]: true }));
    if (action === 'remove') setIsProcessingRemoval(p => ({ ...p, [key]: true }));
    if (action === 'add') setIsAddingMember(true);
    
    try {
      const result = await manageFamilyMemberAction({
        actingUserId: authUser.uid,
        familyId: family.id,
        action,
        targetMemberId,
        targetMemberEmail,
      });

      if (result.success) {
        toast({ title: "Success", description: result.message });
        await fetchFamilyAndMembersData(); // Refresh data
        if(action === 'add') setNewMemberEmail("");
      } else {
        toast({ title: "Action Failed", description: result.message, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Error", description: `An unexpected error occurred: ${e.message}`, variant: "destructive" });
    } finally {
      if (action === 'promote' || action === 'demote') setIsProcessingRole(p => ({ ...p, [key]: false }));
      if (action === 'remove') setIsProcessingRemoval(p => ({ ...p, [key]: false }));
      if (action === 'add') setIsAddingMember(false);
    }
  };

  if (isLoadingPage) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-10">
        <Loader2 className="w-16 h-16 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground">Loading family members...</p>
      </div>
    );
  }

  if (error || !family) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-10">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Error</h2>
        <p className="text-muted-foreground px-4">{error || "Family not found."}</p>
        <Button asChild className="mt-4">
          <Link href="/family">Back to My Families</Link>
        </Button>
      </div>
    );
  }
  
  const isCurrentUserAdmin = family.adminIds.includes(authUser?.uid || '');

  return (
    <>
      <PageHeader
        title={`Manage Family: ${family.name}`}
        description={`Add, remove, or change roles for members of "${family.name}".`}
      />

      {isCurrentUserAdmin && (
        <Card className="shadow-xl mb-6">
          <CardHeader>
              <CardTitle className="flex items-center"><UserPlus className="mr-2 h-5 w-5 text-primary" /> Add New Member</CardTitle>
              <CardDescription>Invite someone to join this family by their email address.</CardDescription>
          </CardHeader>
          <CardContent>
              <div className="flex flex-col sm:flex-row gap-2">
                  <Input 
                      type="email" 
                      placeholder="Enter member's email address" 
                      value={newMemberEmail}
                      onChange={(e) => setNewMemberEmail(e.target.value)}
                      className="flex-grow"
                      disabled={isAddingMember}
                  />
                  <Button 
                      onClick={() => handleAction('add', '', newMemberEmail)}
                      disabled={isAddingMember || !newMemberEmail.trim()}
                      className="w-full sm:w-auto"
                  >
                      {isAddingMember ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                      Invite Member
                  </Button>
              </div>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center"><Users className="mr-2 h-5 w-5 text-primary" /> Current Members ({members.length})</CardTitle>
          <CardDescription>View and manage the members of this family unit.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex justify-start">
            <Button variant="outline" size="sm" asChild>
                <Link href={`/family`}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to My Families
                </Link>
            </Button>
          </div>
          {members.length > 0 ? (
            <ul className="space-y-4">
              {members.map((member) => {
                const RoleIcon = roleIconMap[member.userRole] || User;
                const roleIsStudent = member.userRole === UserRole.STUDENT;

                return (
                  <li key={member.id} className="flex flex-col sm:flex-row items-center justify-between p-4 border rounded-lg hover:shadow-md transition-shadow gap-4 sm:gap-2">
                    <div className="flex items-center gap-3 flex-grow w-full sm:w-auto">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={member.avatarUrl} alt={member.name} data-ai-hint={member.dataAiHint}/>
                        <AvatarFallback>{member.name.split(" ").map(n => n[0]).join("")}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                         <div className="flex items-center gap-2">
                           <Link href={`/profile/view/${member.id}`} className="font-medium hover:underline">{member.name}</Link>
                           <Badge variant="outline" className={cn("text-xs capitalize", roleIsStudent ? "border-blue-300 text-blue-600" : "border-green-300 text-green-600")}>
                             <RoleIcon className="mr-1 h-3 w-3" />
                             {member.userRole}
                           </Badge>
                         </div>
                         <p className="text-xs text-muted-foreground">{member.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                      <Select
                        value={member.roleInFamily}
                        onValueChange={(value) => handleAction(value as MemberRoleInFamily, member.id)}
                        disabled={!isCurrentUserAdmin || member.id === authUser?.uid || isProcessingRole[`promote-${member.id}`] || isProcessingRole[`demote-${member.id}`]}
                      >
                        <SelectTrigger className="w-[120px] text-xs sm:text-sm">
                          {isProcessingRole[`promote-${member.id}`] || isProcessingRole[`demote-${member.id}`] 
                            ? <Loader2 className="h-4 w-4 animate-spin"/> 
                            : <SelectValue placeholder="Select role" />
                          }
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleAction('remove', member.id)}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`Remove ${member.name}`}
                        disabled={!isCurrentUserAdmin || (member.id === authUser?.uid && family.adminIds.length <= 1) || isProcessingRemoval[`remove-${member.id}`]}
                        title={!isCurrentUserAdmin ? "Only admins can remove members" : (member.id === authUser?.uid && family.adminIds.length <= 1) ? "Cannot remove the last admin" : `Remove ${member.name}`}
                      >
                        {isProcessingRemoval[`remove-${member.id}`] 
                          ? <Loader2 className="h-4 w-4 animate-spin"/> 
                          : (member.id === authUser?.uid ? <UserX className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />)
                        }
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-muted-foreground text-center py-4">This family has no members yet.</p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
