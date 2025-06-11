
"use client";

import React, { useState, useEffect, use, useCallback } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Users, Car, Trash2, UserPlus, ShieldCheck, Loader2, PlusCircle, UserX } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, collection, query, where, getDocs, writeBatch } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import type { GroupData, UserProfileData, UserRole as GlobalUserRole } from "@/types";


type MemberRoleInGroup = "admin" | "member";

interface DisplayGroupMember {
  id: string;
  name: string;
  avatarUrl?: string;
  dataAiHint?: string;
  roleInGroup: MemberRoleInGroup;
  canDrive: boolean;
  email?: string;
}

interface ManageGroupPageParams {
  groupId: string;
}

export default function ManageGroupMembersPage({ params: paramsPromise }: { params: Promise<ManageGroupPageParams> }) {
  const params = use(paramsPromise);
  const { groupId } = params || {};
  const { toast } = useToast();
  const { user: authUser } = useAuth();

  const [group, setGroup] = useState<GroupData | null>(null);
  const [members, setMembers] = useState<DisplayGroupMember[]>([]);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGroupAndMembersData = useCallback(async () => {
    if (!groupId) {
      setError("Group ID is missing.");
      setIsLoadingPage(false);
      return;
    }
    setIsLoadingPage(true);
    setError(null);
    try {
      const groupDocRef = doc(db, "groups", groupId);
      const groupDocSnap = await getDoc(groupDocRef);

      if (!groupDocSnap.exists()) {
        setError(`Group with ID "${groupId}" not found.`);
        setGroup(null);
        setMembers([]);
        setIsLoadingPage(false);
        return;
      }

      const groupData = { id: groupDocSnap.id, ...groupDocSnap.data() } as GroupData;
      setGroup(groupData);

      if (groupData.memberIds && groupData.memberIds.length > 0) {
        const memberPromises = groupData.memberIds.map(async (memberUid) => {
          const userDocRef = doc(db, "users", memberUid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const userData = userDocSnap.data() as UserProfileData;
            return {
              id: userDocSnap.id,
              name: userData.fullName,
              avatarUrl: userData.avatarUrl,
              dataAiHint: userData.dataAiHint,
              roleInGroup: groupData.adminIds.includes(memberUid) ? "admin" : "member",
              canDrive: userData.canDrive || false,
              email: userData.email,
            };
          }
          return null;
        });
        const fetchedMembers = (await Promise.all(memberPromises)).filter(Boolean) as DisplayGroupMember[];
        setMembers(fetchedMembers);
      } else {
        setMembers([]);
      }
    } catch (e: any) {
      console.error("Error fetching group/members data:", e);
      setError("Failed to load group or member data. " + (e.message || ""));
      toast({ title: "Error", description: "Could not load group/member information.", variant: "destructive" });
    } finally {
      setIsLoadingPage(false);
    }
  }, [groupId, toast]);

  useEffect(() => {
    fetchGroupAndMembersData();
  }, [fetchGroupAndMembersData]);

  const handleRoleChange = async (memberId: string, newRole: MemberRoleInGroup) => {
    if (!group || !authUser) return;
    // Basic check: ensure current user is an admin of this group
    if (!group.adminIds.includes(authUser.uid)) {
        toast({ title: "Permission Denied", description: "Only group admins can change roles.", variant: "destructive"});
        return;
    }
    // Simplified: doesn't prevent removing last admin for now
    const groupDocRef = doc(db, "groups", groupId);
    try {
      if (newRole === "admin") {
        await updateDoc(groupDocRef, { adminIds: arrayUnion(memberId) });
      } else { // newRole is "member"
        await updateDoc(groupDocRef, { adminIds: arrayRemove(memberId) });
      }
      setMembers(prevMembers =>
        prevMembers.map(member =>
          member.id === memberId ? { ...member, roleInGroup: newRole } : member
        )
      );
      toast({
        title: "Role Updated",
        description: `${members.find(m => m.id === memberId)?.name || 'Member'}'s role changed to ${newRole}.`,
      });
    } catch (e: any) {
      console.error("Error updating role:", e);
      toast({ title: "Role Update Failed", description: e.message || "Could not update role.", variant: "destructive"});
    }
  };

  const handleRemoveMember = async (memberIdToRemove: string) => {
    if (!group || !authUser) return;
    if (!group.adminIds.includes(authUser.uid) && authUser.uid !== memberIdToRemove) { // Admins can remove others, users can remove themselves (if feature allowed)
        toast({ title: "Permission Denied", description: "Only group admins can remove other members.", variant: "destructive"});
        return;
    }
    // Simplified: doesn't prevent removing last admin or self if last admin for now

    const memberName = members.find(m => m.id === memberIdToRemove)?.name || 'Member';
    try {
      const batch = writeBatch(db);
      const groupDocRef = doc(db, "groups", groupId);
      batch.update(groupDocRef, {
        memberIds: arrayRemove(memberIdToRemove),
        adminIds: arrayRemove(memberIdToRemove) // Also remove from admins if they were one
      });

      const userDocRef = doc(db, "users", memberIdToRemove);
      batch.update(userDocRef, {
        joinedGroupIds: arrayRemove(groupId)
      });

      await batch.commit();

      setMembers(prevMembers => prevMembers.filter(member => member.id !== memberIdToRemove));
      // Also update group state if memberIds/adminIds are stored directly on it
      setGroup(prev => prev ? ({...prev, 
        memberIds: prev.memberIds.filter(id => id !== memberIdToRemove),
        adminIds: prev.adminIds.filter(id => id !== memberIdToRemove),
      }) : null);

      toast({
        title: "Member Removed",
        description: `${memberName} has been removed from the group.`,
      });
    } catch (e: any) {
      console.error("Error removing member:", e);
      toast({ title: "Removal Failed", description: e.message || "Could not remove member.", variant: "destructive"});
    }
  };
  
  const handleAddMember = async () => {
    if (!group || !newMemberEmail.trim() || !authUser) {
        toast({ title: "Error", description: "Group details missing or email is empty.", variant: "destructive"});
        return;
    }
    if (!group.adminIds.includes(authUser.uid)) {
        toast({ title: "Permission Denied", description: "Only group admins can add members.", variant: "destructive"});
        return;
    }

    setIsAddingMember(true);
    const emailToInvite = newMemberEmail.trim().toLowerCase();

    try {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("email", "==", emailToInvite));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            toast({ title: "User Not Found", description: `No user found with email: ${emailToInvite}.`, variant: "destructive" });
            setIsAddingMember(false);
            return;
        }
        
        const userDocToAdd = querySnapshot.docs[0];
        const newMemberId = userDocToAdd.id;
        const newMemberData = userDocToAdd.data() as UserProfileData;

        if (group.memberIds.includes(newMemberId)) {
            toast({ title: "Already Member", description: `${newMemberData.fullName} is already in this group.` });
            setIsAddingMember(false);
            setNewMemberEmail("");
            return;
        }

        const batch = writeBatch(db);
        const groupDocRef = doc(db, "groups", groupId);
        batch.update(groupDocRef, { memberIds: arrayUnion(newMemberId) });

        const userDocRef = doc(db, "users", newMemberId);
        batch.update(userDocRef, { joinedGroupIds: arrayUnion(groupId) });
        
        await batch.commit();

        const newDisplayMember: DisplayGroupMember = {
            id: newMemberId,
            name: newMemberData.fullName,
            avatarUrl: newMemberData.avatarUrl,
            dataAiHint: newMemberData.dataAiHint,
            roleInGroup: "member", // New members are always 'member' by default
            canDrive: newMemberData.canDrive || false,
            email: newMemberData.email,
        };
        setMembers(prev => [...prev, newDisplayMember]);
        setGroup(prev => prev ? ({ ...prev, memberIds: [...prev.memberIds, newMemberId]}) : null);
        
        toast({ title: "Member Invited", description: `${newMemberData.fullName} has been added to the group.`});
        setNewMemberEmail("");
    } catch (e: any) {
        console.error("Error adding member:", e);
        toast({ title: "Invitation Failed", description: e.message || "Could not add member.", variant: "destructive"});
    } finally {
        setIsAddingMember(false);
    }
  };

  if (isLoadingPage) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-10">
        <Loader2 className="w-16 h-16 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground">Loading group members...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-10">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Error</h2>
        <p className="text-muted-foreground px-4">{error}</p>
        <Button asChild className="mt-4">
          <Link href="/groups">Back to Groups</Link>
        </Button>
      </div>
    );
  }
  
  if (!group && !isLoadingPage) {
     return (
        <div className="flex flex-col items-center justify-center h-full text-center py-10">
            <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Group Not Found</h2>
            <p className="text-muted-foreground">The group with ID "{groupId}" could not be found or loaded.</p>
            <Button asChild className="mt-4">
            <Link href="/groups">Back to Groups</Link>
            </Button>
        </div>
     );
  }


  return (
    <>
      <PageHeader
        title={`Manage Members: ${group.name}`}
        description={`Add, remove, or change roles for members of "${group.name}".`}
      />

      <Card className="shadow-xl mb-6">
        <CardHeader>
            <CardTitle className="flex items-center"><UserPlus className="mr-2 h-5 w-5 text-primary" /> Add New Member</CardTitle>
            <CardDescription>Invite someone to join this group by their email address.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex flex-col sm:flex-row gap-2">
                <Input 
                    type="email" 
                    placeholder="Enter member's email address" 
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    className="flex-grow"
                    disabled={isAddingMember || !group.adminIds.includes(authUser?.uid || '')}
                />
                <Button 
                    onClick={handleAddMember} 
                    disabled={isAddingMember || !newMemberEmail.trim() || !group.adminIds.includes(authUser?.uid || '')} 
                    className="w-full sm:w-auto"
                >
                    {isAddingMember ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                    Invite Member
                </Button>
            </div>
            {!group.adminIds.includes(authUser?.uid || '') && (
                <p className="text-xs text-destructive mt-2">Only group admins can add new members.</p>
            )}
        </CardContent>
      </Card>

      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center"><Users className="mr-2 h-5 w-5 text-primary" /> Current Members ({members.length})</CardTitle>
          <CardDescription>View and manage the members of this carpool group.</CardDescription>
        </CardHeader>
        <CardContent>
          {members.length > 0 ? (
            <ul className="space-y-4">
              {members.map((member) => (
                <li key={member.id} className="flex flex-col sm:flex-row items-center justify-between p-4 border rounded-lg hover:shadow-md transition-shadow gap-4 sm:gap-2">
                  <div className="flex items-center gap-3 flex-grow w-full sm:w-auto">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={member.avatarUrl} alt={member.name} data-ai-hint={member.dataAiHint}/>
                      <AvatarFallback>{member.name.split(" ").map(n => n[0]).join("")}</AvatarFallback>
                    </Avatar>
                    <div>
                      <Link href={`/profile/view/${member.id}`} className="font-medium hover:underline">{member.name}</Link>
                       <p className="text-xs text-muted-foreground">{member.email}</p>
                      {member.canDrive && (
                        <Car className="inline-block h-4 w-4 ml-1.5 text-blue-500" title="Can drive" />
                      )}
                      {member.roleInGroup === "admin" && (
                        <ShieldCheck className="inline-block h-4 w-4 ml-1.5 text-green-500" title="Administrator" />
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                    <Select
                      value={member.roleInGroup}
                      onValueChange={(value) => handleRoleChange(member.id, value as MemberRoleInGroup)}
                      disabled={!group.adminIds.includes(authUser?.uid || '') || member.id === authUser?.uid}
                    >
                      <SelectTrigger className="w-[120px] text-xs sm:text-sm">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleRemoveMember(member.id)}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Remove ${member.name}`}
                      disabled={!group.adminIds.includes(authUser?.uid || '') && member.id !== authUser?.uid || (member.id === authUser?.uid && group.adminIds.length === 1 && group.adminIds[0] === authUser?.uid && group.memberIds.length > 1) }
                      title={!group.adminIds.includes(authUser?.uid || '') && member.id !== authUser?.uid ? "Only admins can remove others" : (member.id === authUser?.uid && group.adminIds.length === 1 && group.adminIds[0] === authUser?.uid) ? "Cannot remove self as last admin" : `Remove ${member.name}`}
                    >
                      {member.id === authUser?.uid ? <UserX className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-center py-4">This group has no members yet.</p>
          )}
        </CardContent>
         <CardFooter className="border-t pt-6 flex justify-between items-center">
            <Button variant="link" asChild>
                <Link href={`/groups/${groupId}`}>Back to Group</Link>
            </Button>
            <Button variant="link" asChild>
                <Link href="/groups">All Groups</Link>
            </Button>
        </CardFooter>
      </Card>
    </>
  );
}
