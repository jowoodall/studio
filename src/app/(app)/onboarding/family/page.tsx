
'use client';

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowRight, CheckCircle2, Search, Users } from "lucide-react";
import { createFamilyAction, findFamiliesByMemberEmailAction, joinFamilyByIdAction } from '@/actions/familyActions';
import { Separator } from '@/components/ui/separator';
import type { FamilyData } from '@/types';

const createFamilyFormSchema = z.object({
  familyName: z.string().min(3, "Family name must be at least 3 characters.").max(50, "Family name cannot exceed 50 characters."),
});

const joinFamilyFormSchema = z.object({
    email: z.string().email({ message: "Please enter a valid email address." }),
});

type CreateFamilyFormValues = z.infer<typeof createFamilyFormSchema>;
type JoinFamilyFormValues = z.infer<typeof joinFamilyFormSchema>;

export default function OnboardingFamilyPage() {
  const { user, refreshUserProfile } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFindingFamilies, setIsFindingFamilies] = useState(false);
  const [isJoiningFamily, setIsJoiningFamily] = useState<Record<string, boolean>>({});
  const [foundFamilies, setFoundFamilies] = useState<FamilyData[]>([]);
  const [searchedEmail, setSearchedEmail] = useState<string>("");

  const createForm = useForm<CreateFamilyFormValues>({
    resolver: zodResolver(createFamilyFormSchema),
    defaultValues: { familyName: "" },
  });

  const joinForm = useForm<JoinFamilyFormValues>({
    resolver: zodResolver(joinFamilyFormSchema),
    defaultValues: { email: "" },
  });

  async function onFamilyCreate(data: CreateFamilyFormValues) {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await createFamilyAction({
        creatorId: user.uid,
        familyName: data.familyName,
      });

      if (result.success) {
        toast({ title: "Family Created!", description: result.message });
        await finishOnboarding();
      } else {
        toast({ title: "Creation Failed", description: result.message, variant: "destructive" });
        setIsSubmitting(false);
      }
    } catch (error: any) {
      toast({ title: "Error", description: `An unexpected error occurred: ${error.message}`, variant: "destructive" });
      setIsSubmitting(false);
    }
  }

  async function onFindFamilies(data: JoinFamilyFormValues) {
    if (!user) {
        toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
        return;
    }
    setIsFindingFamilies(true);
    setFoundFamilies([]);
    setSearchedEmail(data.email);
    try {
        const result = await findFamiliesByMemberEmailAction({ memberEmail: data.email });

        if (result.success && result.families) {
            if(result.families.length > 0) {
                toast({ title: "Families Found", description: `Found ${result.families.length} family/families for ${data.email}.` });
                setFoundFamilies(result.families);
            } else {
                toast({ title: "No Families Found", description: `The user ${data.email} is not part of any families.`, variant: "destructive" });
            }
        } else {
            toast({ title: "Could Not Find Families", description: result.message, variant: "destructive" });
        }
    } catch (error: any) {
        toast({ title: "Error", description: `An unexpected error occurred: ${error.message}`, variant: "destructive" });
    } finally {
        setIsFindingFamilies(false);
    }
  }

  async function onJoinFamily(familyId: string) {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    setIsJoiningFamily(prev => ({ ...prev, [familyId]: true }));
    setIsSubmitting(true);
    try {
      const result = await joinFamilyByIdAction({ familyId, joiningUserId: user.uid });
      if (result.success) {
        toast({ title: "Joined Family!", description: result.message });
        await finishOnboarding();
      } else {
        toast({ title: "Failed to Join", description: result.message, variant: "destructive" });
        setIsJoiningFamily(prev => ({ ...prev, [familyId]: false }));
        setIsSubmitting(false);
      }
    } catch (error: any) {
      toast({ title: "Error", description: `An unexpected error occurred: ${error.message}`, variant: "destructive" });
      setIsJoiningFamily(prev => ({ ...prev, [familyId]: false }));
      setIsSubmitting(false);
    }
  }
  
  const finishOnboarding = async () => {
    if (!user) return;
    setIsSubmitting(true); 
    try {
        const userDocRef = doc(db, "users", user.uid);
        await updateDoc(userDocRef, { onboardingComplete: true });
        
        // Explicitly wait for the user profile to refresh before navigating
        await refreshUserProfile(); 
        
        toast({
            title: "Setup Complete!",
            description: "You're all set to start using MyRydz.",
            icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
        });
        router.push('/dashboard');
    } catch (error: any) {
        toast({ title: "Error", description: "Could not finalize onboarding.", variant: "destructive" });
        setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
        <Card className="shadow-xl">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Users className="h-6 w-6 text-primary"/> Create a New Family</CardTitle>
                <CardDescription>Set up a new family unit. You will be the first admin.</CardDescription>
            </CardHeader>
            <CardContent>
            <Form {...createForm}>
                <form onSubmit={createForm.handleSubmit(onFamilyCreate)} className="space-y-6">
                <FormField
                    control={createForm.control}
                    name="familyName"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Family Name</FormLabel>
                        <FormControl>
                        <Input placeholder="e.g., The Smith Family" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Create Family & Finish"}
                </Button>
                </form>
            </Form>
            </CardContent>
        </Card>
        
        <div className="flex items-center text-sm text-muted-foreground">
            <Separator className="flex-1"/>
            <span className="px-4">OR</span>
            <Separator className="flex-1"/>
        </div>

        <Card className="shadow-xl">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Search className="h-6 w-6 text-primary"/> Join an Existing Family</CardTitle>
                <CardDescription>If a family member already has an account, you can find their families by entering their email address.</CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...joinForm}>
                    <form onSubmit={joinForm.handleSubmit(onFindFamilies)} className="space-y-4">
                        <FormField
                            control={joinForm.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Family Member's Email</FormLabel>
                                    <FormControl>
                                        <Input placeholder="member@example.com" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button type="submit" className="w-full" disabled={isFindingFamilies || isSubmitting}>
                            {isFindingFamilies ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                            Find Families
                        </Button>
                    </form>
                </Form>
                {foundFamilies.length > 0 && (
                  <div className="mt-6 space-y-3 pt-4 border-t">
                    <h3 className="text-sm font-semibold">Families found for {searchedEmail}:</h3>
                    {foundFamilies.map(family => (
                        <Card key={family.id} className="bg-muted/50">
                            <CardContent className="p-3 flex justify-between items-center">
                                <div>
                                    <p className="font-medium">{family.name}</p>
                                    <p className="text-xs text-muted-foreground">{family.memberIds.length} member(s)</p>
                                </div>
                                <Button size="sm" onClick={() => onJoinFamily(family.id)} disabled={isSubmitting}>
                                    {isJoiningFamily[family.id] ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : "Join"}
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                  </div>  
                )}
            </CardContent>
        </Card>
        
        <div className="flex items-center text-sm text-muted-foreground">
            <Separator className="flex-1"/>
            <span className="px-4">OR</span>
            <Separator className="flex-1"/>
        </div>

        <div className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
                You can always create or join a family later from the settings page.
            </p>
            <Button onClick={finishOnboarding} variant="outline" className="w-full max-w-md mx-auto" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <>Skip for Now & Finish Setup <ArrowRight className="ml-2 h-4 w-4" /></>}
            </Button>
        </div>
    </div>
  );
}
