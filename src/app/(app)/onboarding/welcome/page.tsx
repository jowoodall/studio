
'use client';

import React from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, CheckCircle2, MapPin, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function WelcomeOnboardingPage() {
    const { userProfile } = useAuth();
    const router = useRouter();

    if (!userProfile) {
        // Auth context will redirect, but this is a fallback
        return null; 
    }
    
    return (
        <Card className="shadow-xl">
            <CardHeader className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
                    <CheckCircle2 className="h-10 w-10 text-primary" />
                </div>
                <CardTitle className="font-headline text-3xl">Welcome to MyRydz, {userProfile.fullName.split(' ')[0]}!</CardTitle>
                <CardDescription className="text-lg">
                    Your account is created. Let's get you set up for success.
                </CardDescription>
            </CardHeader>
            <CardContent className="max-w-md mx-auto space-y-8 py-8">
                <p className="text-center text-muted-foreground">
                    To make your experience seamless, we need just a couple more details. It'll only take a minute.
                </p>
                
                <div className="space-y-4">
                    <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                            <MapPin className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                            <h4 className="font-semibold">Add a Default Location</h4>
                            <p className="text-sm text-muted-foreground">Set your primary pickup spot, like home or school.</p>
                        </div>
                    </div>
                     <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                            <Users className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                            <h4 className="font-semibold">Join or Create a Family</h4>
                            <p className="text-sm text-muted-foreground">Connect with family members to manage rydz together.</p>
                        </div>
                    </div>
                </div>

                <Button size="lg" className="w-full" asChild>
                    <Link href="/onboarding/location">
                        Let's Go! <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                </Button>
            </CardContent>
        </Card>
    );
}
