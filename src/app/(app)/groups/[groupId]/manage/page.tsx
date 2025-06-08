
"use client";

import React, { useState, use } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Users, Car, Trash2, UserPlus, ShieldCheck, Loader2, PlusCircle } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// Mock group data - in a real app, you'd fetch this
const mockGroupsData: { [key: string]: { name: string; description: string; } } = {
  "1": { name: "Morning School Run", description: "Daily carpool to Northwood High." },
  "2": { name: "Soccer Practice Crew", description: "Carpool for weekend soccer practice." },
  "3": { name: "Work Commute (Downtown)", description: "Shared rydz to downtown offices." },
};

type MemberRole = "admin" | "member";

interface GroupMember {
  id: string;
  name: string;
  avatarUrl: string;
  dataAiHint: string;
  role: MemberRole;
  canDrive: boolean;
}

const mockGroupMembers: { [groupId: string]: GroupMember[] } = {
  "1": [
    { id: "user1", name: "Alice Wonderland", avatarUrl: "https://placehold.co/100x100.png?text=AW", dataAiHint: "woman smiling", role: "admin", canDrive: true },
    { id: "user2", name: "Bob The Builder", avatarUrl: "https://placehold.co/100x100.png?text=BB", dataAiHint: "man construction", role: "member", canDrive: true },
    { id: "user3", name: "Charlie Brown", avatarUrl: "https://placehold.co/100x100.png?text=CB", dataAiHint: "boy cartoon", role: "member", canDrive: false },
  ],
  "2": [
    { id: "user4", name: "Diana Prince", avatarUrl: "https://placehold.co/100x100.png?text=DP", dataAiHint: "woman hero", role: "admin", canDrive: true },
    { id: "user5", name: "Edward Scissorhands", avatarUrl: "https://placehold.co/100x100.png?text=ES", dataAiHint: "man pale", role: "member", canDrive: false },
  ],
  "3": [
     { id: "user1", name: "Alice Wonderland", avatarUrl: "https://placehold.co/100x100.png?text=AW", dataAiHint: "woman smiling", role: "admin", canDrive: true },
  ]
};

interface ResolvedPageParams {
  groupId: string;
}

export default function ManageGroupMembersPage({ params: paramsPromise }: { params: Promise<ResolvedPageParams> }) {
  const params = use(paramsPromise);
  const { groupId } = params || {};
  const { toast } = useToast();

  const [groupDetails, setGroupDetails] = useState(() => groupId ? mockGroupsData[groupId] : null);
  const [members, setMembers] = useState<GroupMember[]>(() => groupId ? mockGroupMembers[groupId] || [] : []);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [isAddingMember, setIsAddingMember] = useState(false);

  React.useEffect(() => {
    if (groupId) {
      setGroupDetails(mockGroupsData[groupId] || null);
      setMembers(mockGroupMembers[groupId] || []);
    }
  }, [groupId]);

  const handleRoleChange = (memberId: string, newRole: MemberRole) => {
    setMembers(prevMembers =>
      prevMembers.map(member =>
        member.id === memberId ? { ...member, role: newRole } : member
      )
    );
    const memberName = members.find(m => m.id === memberId)?.name;
    toast({
      title: "Role Updated",
      description: `${memberName || 'Member'}'s role changed to ${newRole}. (Mock update)`,
    });
  };

  const handleRemoveMember = (memberId: string) => {
    const memberName = members.find(m => m.id === memberId)?.name;
    setMembers(prevMembers => prevMembers.filter(member => member.id !== memberId));
    toast({
      title: "Member Removed",
      description: `${memberName || 'Member'} has been removed from the group. (Mock update)`,
      variant: "destructive"
    });
  };
  
  const handleAddMember = () => {
    if (!newMemberEmail.trim()) {
        toast({ title: "Error", description: "Please enter an email to invite.", variant: "destructive"});
        return;
    }
    setIsAddingMember(true);
    // Simulate API call to invite member
    setTimeout(() => {
        // In a real app, you'd verify the email and add the user.
        // For mock, we add a placeholder user if not already present.
        const existingMember = members.find(m => m.name.toLowerCase().includes(newMemberEmail.split('@')[0].toLowerCase()));
        if (!existingMember) {
            const newMember: GroupMember = {
                id: `user-${Date.now()}`,
                name: newMemberEmail.split('@')[0] || "New User",
                avatarUrl: `https://placehold.co/100x100.png?text=${newMemberEmail.substring(0,2).toUpperCase()}`,
                dataAiHint: "person silhouette",
                role: "member",
                canDrive: false,
            };
            setMembers(prev => [...prev, newMember]);
            toast({ title: "Member Invited", description: `${newMember.name} has been invited to the group. (Mock)`});
        } else {
            toast({ title: "Already Member", description: `${existingMember.name} is already in this group.`, variant: "default"});
        }
        setNewMemberEmail("");
        setIsAddingMember(false);
    }, 1000);
  };


  if (!groupId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-10">
        <Loader2 className="w-16 h-16 text-muted-foreground animate-spin mb-4" />
        <p className="text-muted-foreground">Loading group details...</p>
      </div>
    );
  }

  if (!groupDetails) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-10">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Group Not Found</h2>
        <p className="text-muted-foreground">The group with ID "{groupId}" could not be found.</p>
        <Button asChild className="mt-4">
          <Link href="/groups">Back to Groups</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={`Manage Members: ${groupDetails.name}`}
        description={`Add, remove, or change roles for members of "${groupDetails.name}".`}
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
                />
                <Button onClick={handleAddMember} disabled={isAddingMember} className="w-full sm:w-auto">
                    {isAddingMember ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                    Invite Member
                </Button>
            </div>
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
                      <span className="font-medium">{member.name}</span>
                      {member.canDrive && (
                        <Car className="inline-block h-4 w-4 ml-1.5 text-blue-500" title="Can drive" />
                      )}
                      {member.role === "admin" && (
                        <ShieldCheck className="inline-block h-4 w-4 ml-1.5 text-green-500" title="Administrator" />
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                    <Select
                      value={member.role}
                      onValueChange={(value) => handleRoleChange(member.id, value as MemberRole)}
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
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-center py-4">This group has no members yet.</p>
          )}
        </CardContent>
         <CardFooter className="border-t pt-6">
            <Button variant="link" asChild>
                <Link href="/groups">Back to All Groups</Link>
            </Button>
        </CardFooter>
      </Card>
    </>
  );
}

    