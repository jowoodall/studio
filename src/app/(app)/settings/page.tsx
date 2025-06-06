
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Cog } from "lucide-react";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Account Settings',
  description: 'Manage your account settings.',
};

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Account Settings"
        description="Manage your notification preferences, privacy settings, and more."
      />
      <Card className="shadow-lg">
        <CardHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
            <Cog className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-center font-headline text-xl">Settings Dashboard</CardTitle>
          <CardDescription className="text-center">
            This is where you'll be able to manage various aspects of your RydzConnect account.
            (Functionality to be implemented)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-6 border-2 border-dashed border-muted rounded-md text-center text-muted-foreground">
            <p>Notification Settings Placeholder</p>
            <p className="text-sm">Toggle email, push, and SMS notifications.</p>
          </div>
          <div className="mt-4 p-6 border-2 border-dashed border-muted rounded-md text-center text-muted-foreground">
            <p>Privacy Settings Placeholder</p>
            <p className="text-sm">Control what information is visible to others.</p>
          </div>
           <div className="mt-4 p-6 border-2 border-dashed border-muted rounded-md text-center text-muted-foreground">
            <p>Password Management Placeholder</p>
            <p className="text-sm">Change your account password.</p>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
