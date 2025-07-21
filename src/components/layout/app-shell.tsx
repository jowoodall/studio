
'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { AppHeader } from './app-header';
import { AppSidebar } from './app-sidebar';
import { SidebarInset } from '@/components/ui/sidebar';

function ProtectedContent({ children }: { children: React.ReactNode }) {
  const { user, loading, userProfile } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    // Redirect to onboarding if user is logged in but hasn't completed it
    if (!loading && user && userProfile && !userProfile.onboardingComplete) {
        if (!pathname.startsWith('/onboarding')) {
            router.push('/onboarding/welcome');
        }
    }
  }, [user, loading, userProfile, pathname, router]);

  if (loading || !user || !userProfile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Loading user session...</p>
      </div>
    );
  }
  
  if (user && userProfile && !userProfile.onboardingComplete && !pathname.startsWith('/onboarding')) {
     return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Redirecting to onboarding...</p>
      </div>
    );
  }

  return <>{children}</>;
}


export function AppShell({ children }: { children: React.ReactNode }) {
    return (
        <ProtectedContent>
            <div className="flex min-h-screen">
                <AppSidebar />
                <SidebarInset>
                    <AppHeader />
                    <main className="flex-1 p-4 md:p-8 pt-6">
                        {children}
                    </main>
                </SidebarInset>
            </div>
        </ProtectedContent>
    );
}
