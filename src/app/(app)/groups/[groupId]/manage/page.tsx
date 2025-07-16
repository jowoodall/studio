

"use client";

import React, { useState, useEffect, use, useCallback } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Users, Car, Trash2, UserPlus, ShieldCheck, Loader2, PlusCircle, UserX, Info, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import type { GroupData, UserProfileData, UserRole as GlobalUserRole, NotificationType } from "@/types";
import { Badge } from "@/components/ui/badge";
import { getGroupManagementDataAction, manageGroupMemberAction } from "@/actions/groupActions";

type MemberRoleInGroup = "admin" | "member";

interface DisplayGroupMember {
  id: string;
  name: string;
  avatarUrl?: string;
  dataAiHint?: string;
  roleInGroup: MemberRoleInGroup;
  canDrive: boolean;
  email?: string;
  hasAcceptedInvitation: boolean; 
}

interface ManageGroupPageParams {
  groupId: string;
}

export default function ManageGroupMembersPage({ params: paramsPromise }: { params: Promise<ManageGroupPageParams> }) {
  const params = use(paramsPromise);
  const { groupId } = params || {};
  const { toast } = useToast();
  const { user: authUser, loading: authLoading } = useAuth();

  const [group, setGroup] = useState<GroupData | null>(null);
  const [members, setMembers] = useState<DisplayGroupMember[]>([]);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState<Record<string, boolean>>({});

  const fetchGroupAndMembersData = useCallback(async () => {
    if (!groupId || !authUser) {
      if (!authLoading) setIsLoadingPage(false);
      return;
    }
    
    setIsLoadingPage(true);
    setError(null);
    try {
      const result = await getGroupManagementDataAction(groupId, authUser.uid);
      if (result.success && result.data) {
        setGroup(result.data.group);
        setMembers(result.data.members);
      } else {
        throw new Error(result.message || "Failed to load group data.");
      }
    } catch (e: any) {
      console.error("Error fetching group/members data:", e);
      setError(e.message);
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsLoadingPage(false);
    }
  }, [groupId, authUser, toast, authLoading]);

  useEffect(() => {
    if (!authLoading) {
      fetchGroupAndMembersData();
    }
  }, [authLoading, fetchGroupAndMembersData]);

  const handleAction = async (action: 'add' | 'remove' | 'promote' | 'demote', targetMemberId: string, targetMemberEmail?: string) => {
    if (!authUser || !group) return;

    const actionKey = `${action}-${targetMemberId || targetMemberEmail}`;
    setIsProcessingAction(p => ({ ...p, [actionKey]: true }));
    if (action === 'add') setIsAddingMember(true);
    
    try {
        const result = await manageGroupMemberAction({
            actingUserId: authUser.uid,
            groupId: group.id,
            action,
            targetMemberId,
            targetMemberEmail,
        });
        if (result.success) {
            toast({ title: "Success", description: result.message });
            if(action === 'add') setNewMemberEmail("");
            await fetchGroupAndMembersData(); // Refresh data from server
        } else {
            toast({ title: "Action Failed", description: result.message, variant: "destructive" });
        }
    } catch (e: any) {
        toast({ title: "Error", description: `An unexpected client error occurred: ${e.message}`, variant: "destructive" });
    } finally {
        setIsProcessingAction(p => ({ ...p, [actionKey]: false }));
        if (action === 'add') setIsAddingMember(false);
    }
  };

  if (isLoadingPage || authLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-10">
        <Loader2 className="w-16 h-16 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground">Loading group members...</p>
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-10">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Error</h2>
        <p className="text-muted-foreground px-4">{error || "Group could not be loaded."}</p>
        <Button asChild className="mt-4">
          <Link href="/groups">Back to Groups</Link>
        </Button>
      </div>
    );
  }
  
  const isCurrentUserAdmin = group.adminIds.includes(authUser?.uid || '');

  return (
    <>
      <PageHeader
        title={`Manage Members: ${group.name}`}
        description={`Add, remove, or change roles for members of "${group.name}".`}
      />

      {isCurrentUserAdmin && (
        <Card className="shadow-xl mb-6">
            <CardHeader>
                <CardTitle className="flex items-center"><UserPlus className="mr-2 h-5 w-5 text-primary" /> Add New Member</CardTitle>
                <CardDescription>Invite someone to join this group by their email address. They will need to accept the invitation.</CardDescription>
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
          <CardDescription>View and manage the members of this carpool group.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex justify-start">
            <Button variant="outline" size="sm" asChild>
                <Link href={`/groups/${groupId}`}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Group
                </Link>
            </Button>
          </div>
          {members.length > 0 ? (
            <ul className="space-y-4">
              {members.map((member) => {
                const isProcessing = !!isProcessingAction[`remove-${member.id}`] || !!isProcessingAction[`promote-${member.id}`] || !!isProcessingAction[`demote-${member.id}`];
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
                          {!member.hasAcceptedInvitation && (
                              <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-600">
                                  <Info className="mr-1 h-3 w-3" /> Pending Acceptance
                              </Badge>
                          )}
                        </div>
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
                        onValueChange={(value) => handleAction(value as MemberRoleInGroup, member.id)}
                        disabled={!isCurrentUserAdmin || member.id === authUser?.uid || !member.hasAcceptedInvitation || isProcessing}
                      >
                        <SelectTrigger className="w-[120px] text-xs sm:text-sm">
                          {isProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : <SelectValue placeholder="Select role" />}
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
                        disabled={
                            (!isCurrentUserAdmin && member.id !== authUser?.uid) ||
                            (member.id === authUser?.uid && isCurrentUserAdmin && group.adminIds.length <= 1 && members.filter(m => m.hasAcceptedInvitation).length > 1) ||
                            isProcessing
                        }
                        title={!isCurrentUserAdmin && member.id !== authUser?.uid ? "Only admins can remove others" : `Remove ${member.name}`}
                      >
                        {isProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : (member.id === authUser?.uid ? <UserX className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />)}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-muted-foreground text-center py-4">This group has no members yet.</p>
          )}
        </CardContent>
         <CardFooter className="border-t pt-6 flex justify-end items-center">
            <Button variant="link" asChild>
                <Link href="/groups">All Groups</Link>
            </Button>
        </CardFooter>
      </Card>
    </>
  );
}
