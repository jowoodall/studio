
'use client';

import React from 'react';
import { Logo } from "@/components/icons/logo";
import Link from "next/link";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Loader2 } from 'lucide-react';

function OnboardingContent({ children }: { children: React.ReactNode }) {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && userProfile?.onboardingComplete) {
        router.push('/dashboard');
    }
  }, [user, userProfile, loading, router]);

  if (loading || !userProfile) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">Loading onboarding session...</p>
        </div>
    );
  }

  return <>{children}</>;
}


export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
        <div className="flex flex-col items-center min-h-screen bg-background p-4">
          <div className="my-8">
            <Link href="/">
              <Logo />
            </Link>
          </div>
          <div className="w-full max-w-2xl">
            <OnboardingContent>
                {children}
            </OnboardingContent>
          </div>
        </div>
    </AuthProvider>
  );
}
