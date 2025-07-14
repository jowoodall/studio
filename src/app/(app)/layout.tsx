
'use client';

import React, { useEffect } from 'react';
import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Loader2 } from 'lucide-react';

function ProtectedContent({ children }: { children: React.ReactNode }) {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    // New logic to handle onboarding
    if (!loading && userProfile && !userProfile.onboardingComplete) {
        router.push('/onboarding/welcome');
    }
  }, [user, userProfile, loading, router]);

  if (loading || !user || !userProfile?.onboardingComplete) {
    // This loader is inside the main content area, not replacing the whole page.
    // This maintains the overall HTML structure and prevents hydration errors.
    return (
      <div className="flex h-full w-full items-center justify-center p-8 min-h-[calc(100vh-200px)]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading User Data...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}


export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // This structure is now STATIC. It always renders, on server and client.
  return (
    <AuthProvider>
      <SidebarProvider defaultOpen={true}>
        <AppSidebar />
        <SidebarInset>
          <div className="flex flex-col min-h-screen">
            <AppHeader />
            <main className="flex-1 p-4 sm:p-6 lg:p-8 bg-background">
              <ProtectedContent>
                {children}
              </ProtectedContent>
            </main>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </AuthProvider>
  );
}
