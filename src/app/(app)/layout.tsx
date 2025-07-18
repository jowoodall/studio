
'use client';

import React, { useEffect, Suspense } from 'react';
import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from 'lucide-react';

function ProtectedContent({ children }: { children: React.ReactNode }) {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return; // Wait until auth state is determined

    if (!user) {
      router.push('/login');
      return;
    }
    
    // If user profile is loaded and onboarding is not complete,
    // and they are NOT on an onboarding page, redirect them.
    if (userProfile && !userProfile.onboardingComplete && !pathname.startsWith('/onboarding')) {
        router.push('/onboarding/welcome');
    }
    
  }, [user, userProfile, loading, router, pathname]);

  // Show a loader while auth state is loading or if the profile is still being fetched.
  // Also show loader if onboarding is not complete and user is not on an onboarding page (during the redirect).
  if (loading || !user || !userProfile || (!userProfile.onboardingComplete && !pathname.startsWith('/onboarding'))) {
    return (
      <div className="flex h-full w-full items-center justify-center p-8 min-h-[calc(100vh-200px)]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading User Data...</p>
        </div>
      </div>
    );
  }

  // If user is onboarding, let the onboarding layout handle the rendering.
  if (!userProfile.onboardingComplete && pathname.startsWith('/onboarding')) {
      return <>{children}</>;
  }

  // Otherwise, user is onboarded and can see protected content.
  return <>{children}</>;
}


export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <SidebarProvider defaultOpen={true}>
        <AppSidebar />
        <SidebarInset>
          <div className="flex flex-col min-h-screen">
            <AppHeader />
            <main className="flex-1 p-4 sm:p-6 lg:p-8 bg-background">
              <Suspense fallback={
                <div className="flex h-full w-full items-center justify-center p-8 min-h-[calc(100vh-200px)]">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-muted-foreground">Loading Page...</p>
                  </div>
                </div>
              }>
                <ProtectedContent>
                  {children}
                </ProtectedContent>
              </Suspense>
            </main>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </AuthProvider>
  );
}
