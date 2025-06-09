
'use client';

import React, { useEffect } from 'react'; // Import React and useEffect
import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AuthProvider, useAuth } from "@/context/AuthContext"; // Import AuthProvider and useAuth
import { useRouter } from "next/navigation";
import { Loader2 } from 'lucide-react';

// Inner component to handle auth logic after AuthProvider is in context
function AppLayoutContent({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login'); // Redirect to login if not authenticated
    }
  }, [user, loading, router]);

  if (loading || (!loading && !user)) {
    // Show loader while checking auth or if redirecting
    // This covers the brief period where user might be null before redirect completes
    return (
        <div className="flex items-center justify-center min-h-screen bg-background">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
             <p className="ml-3 text-muted-foreground">Verifying authentication...</p>
        </div>
    );
  }

  // If user is authenticated, render the main app layout
  return (
    <SidebarProvider defaultOpen={true}> {/* Manage open state via cookie or prop */}
      <AppSidebar />
      <SidebarInset>
        <div className="flex flex-col min-h-screen">
          <AppHeader />
          <main className="flex-1 p-4 sm:p-6 lg:p-8 bg-background">
            {children}
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

// Main AppLayout component that wraps content with AuthProvider
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <AppLayoutContent>{children}</AppLayoutContent>
    </AuthProvider>
  );
}
