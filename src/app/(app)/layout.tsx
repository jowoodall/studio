
'use client';

import React from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { AuthProvider } from '@/context/AuthContext';
import { SidebarProvider } from "@/components/ui/sidebar";
import { HelpAssistant } from '@/components/shared/help-assistant';

export default function AuthenticatedAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <SidebarProvider defaultOpen={true}>
        <AppShell>
          {children}
        </AppShell>
        <HelpAssistant />
      </SidebarProvider>
    </AuthProvider>
  );
}
