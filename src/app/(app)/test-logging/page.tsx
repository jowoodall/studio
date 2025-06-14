
"use client";

import React, { useState } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { simpleLogTestAction } from "@/actions/testLogActions";
import { Loader2, Terminal } from "lucide-react";

export default function TestLoggingPage() {
  const { toast } = useToast();
  const [message, setMessage] = useState("Hello Server!");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleSubmit = async () => {
    setIsLoading(true);
    setResult(null);
    console.log("[TestLoggingPage] Sending message to server action:", message);
    try {
      const response = await simpleLogTestAction(message);
      console.log("[TestLoggingPage] Received response from server action:", response);
      if (response.success) {
        setResult(`Client received: ${response.response}`);
        toast({
          title: "Test Action Succeeded",
          description: response.response,
        });
      } else {
        setResult(`Client received error: ${response.response}`);
        toast({
          title: "Test Action Failed (as expected by input)",
          description: response.response,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("[TestLoggingPage] Error calling server action:", error);
      setResult(`Client error: ${error.message || "Unknown error"}`);
      toast({
        title: "Client-Side Error",
        description: `Failed to call test action: ${error.message || "Unknown error"}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Test Server-Side Logging"
        description="Use this page to verify if console.log statements from Server Actions are appearing in your server terminal."
      />
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Logging Test</CardTitle>
          <CardDescription>
            Enter a message, click send, and then check your Next.js server terminal (not the browser console) for log outputs from `simpleLogTestAction`.
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
            Send Test Message to Server Action
          </Button>
          {result && (
            <div className="mt-4 p-3 bg-muted rounded-md">
              <p className="text-sm font-semibold">Result from Client:</p>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">{result}</p>
            </div>
          )}
           <div className="mt-4 p-3 bg-yellow-100 border border-yellow-300 rounded-md text-yellow-800 text-sm">
            <p className="font-bold">Instructions:</p>
            <ol className="list-decimal list-inside pl-2 mt-1 space-y-1">
              <li>Click the button above.</li>
              <li>Open the terminal window where your Next.js development server (`npm run dev`) is running.</li>
              <li>Look for logs prefixed with `[File: testLogActions.ts]` or `[Action: simpleLogTestAction]`.</li>
              <li>If those logs appear, server-side logging is working. If not, there's an issue with your environment's log visibility.</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
