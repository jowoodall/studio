
"use client";

import React, { useState } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Terminal, AlertTriangle } from "lucide-react";
import { simpleLogTestAction } from '@/actions/testLogActions';
import Link from "next/link";


export default function TestLoggingPage() {
  const { toast } = useToast();
  const [message, setMessage] = useState("Hello Server!");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleSubmit = async () => {
    setIsLoading(true);
    setResult(null);
    try {
      const response = await simpleLogTestAction(message);
      if (response.success) {
        setResult(`Client received: ${response.response}`);
        toast({ title: "Test Action Succeeded", description: response.response });
      } else {
        setResult(`Client received error: ${response.response}`);
        toast({ title: "Test Action Failed", description: response.response, variant: "destructive" });
      }
    } catch (error: any) {
      setResult(`Client error: ${error.message || "Unknown error"}`);
      toast({ title: "Client-Side Error", description: `Failed to call test action: ${error.message || "Unknown error"}`, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Developer Utilities"
        description="Tools for testing and administrative actions."
      />
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
          <Button onClick={handleSubmit} disabled={isLoading} className="w-full">
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Terminal className="mr-2 h-4 w-4" />}
            Send Test Message
          </Button>
          {result && (
            <div className="mt-4 p-3 bg-muted rounded-md">
              <p className="text-sm font-semibold">Result from Client:</p>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">{result}</p>
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
