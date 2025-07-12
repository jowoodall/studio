
"use client";

import React, { useState } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { simpleLogTestAction, impersonateUserAction } from "@/actions/adminActions";
import { Loader2, Terminal, AlertTriangle, UserCog } from "lucide-react";
import Link from "next/link";
import { useAuth } from '@/context/AuthContext';

export default function TestLoggingPage() {
  const { toast } = useToast();
  const { user, signInWithCustomToken, userProfile } = useAuth(); // Get user and new sign-in function
  
  // State for simple log test
  const [message, setMessage] = useState("Hello Server!");
  const [isLoadingLogTest, setIsLoadingLogTest] = useState(false);
  const [logTestResult, setLogTestResult] = useState<string | null>(null);

  // State for impersonation
  const [targetEmail, setTargetEmail] = useState("");
  const [isImpersonating, setIsImpersonating] = useState(false);

  const handleLogTestSubmit = async () => {
    setIsLoadingLogTest(true);
    setLogTestResult(null);
    try {
      const response = await simpleLogTestAction(message);
      if (response.success) {
        setLogTestResult(`Client received: ${response.response}`);
        toast({ title: "Test Action Succeeded", description: response.response });
      } else {
        setLogTestResult(`Client received error: ${response.response}`);
        toast({ title: "Test Action Failed", description: response.response, variant: "destructive" });
      }
    } catch (error: any) {
      setLogTestResult(`Client error: ${error.message || "Unknown error"}`);
      toast({ title: "Client-Side Error", description: `Failed to call test action: ${error.message || "Unknown error"}`, variant: "destructive" });
    } finally {
      setIsLoadingLogTest(false);
    }
  };

  const handleImpersonateSubmit = async () => {
    if (!user || !user.email) {
      toast({ title: "Error", description: "You must be logged in to use this feature.", variant: "destructive" });
      return;
    }
    setIsImpersonating(true);
    try {
      const result = await impersonateUserAction({
        impersonatorEmail: user.email,
        targetEmail: targetEmail,
      });

      if (result.success && result.customToken) {
        toast({ title: "Impersonation Success", description: `Logging in as ${targetEmail}...` });
        await signInWithCustomToken(result.customToken);
        // The AuthContext will handle redirecting to the dashboard
      } else {
        toast({ title: "Impersonation Failed", description: result.message, variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Client-Side Error", description: `Failed to call impersonation action: ${error.message || "Unknown error"}`, variant: "destructive" });
    } finally {
      setIsImpersonating(false);
    }
  };

  const isAllowedImpersonator = userProfile?.email === 'joey.woodall@gmail.com';

  return (
    <>
      <PageHeader
        title="Developer Utilities"
        description="Tools for testing and administrative actions."
      />

      {isAllowedImpersonator && (
        <Card className="w-full max-w-md mx-auto mb-6">
          <CardHeader>
            <CardTitle className="text-primary flex items-center gap-2"><UserCog /> Impersonate User</CardTitle>
            <CardDescription>
              Log in as another user to test their views and permissions. Use with caution.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              value={targetEmail}
              onChange={(e) => setTargetEmail(e.target.value)}
              placeholder="Enter target user's email"
              type="email"
            />
            <Button onClick={handleImpersonateSubmit} disabled={isImpersonating || !targetEmail} className="w-full">
              {isImpersonating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserCog className="mr-2 h-4 w-4" />}
              Login as User
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Server-Side Logging Test</CardTitle>
          <CardDescription>
            Verify console.log statements from Server Actions appear in your server terminal.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Enter message to send"
          />
          <Button onClick={handleLogTestSubmit} disabled={isLoadingLogTest} className="w-full">
            {isLoadingLogTest ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Terminal className="mr-2 h-4 w-4" />}
            Send Test Message
          </Button>
          {logTestResult && (
            <div className="mt-4 p-3 bg-muted rounded-md">
              <p className="text-sm font-semibold">Result from Client:</p>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">{logTestResult}</p>
            </div>
          )}
        </CardContent>
      </Card>
      
      <Card className="w-full max-w-md mx-auto mt-6">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2"><AlertTriangle /> Admin Utilities</CardTitle>
          <CardDescription>
              Access special developer and data management tools.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
              <Link href="/admin/purge-data">
              Go to Data Purge Utility
              </Link>
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
