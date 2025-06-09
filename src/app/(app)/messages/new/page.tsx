
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Send, ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'New Message',
  description: 'Compose a new message to a user or group.',
};

export default function NewMessagePage() {
  // In a real app, you'd handle form submission and recipient selection here
  return (
    <>
      <PageHeader
        title="Compose New Message"
        description="Select a recipient (user or group) and write your message below."
        actions={
            <Button variant="outline" asChild>
                <Link href="/messages">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Messages
                </Link>
            </Button>
        }
      />
      <Card className="w-full max-w-xl mx-auto shadow-lg">
        <CardHeader>
          <CardTitle>New Message</CardTitle>
          <CardDescription>
            Search for a user or group to start a conversation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="recipient">To:</Label>
            <Input id="recipient" placeholder="Search by name, email, or group name..." className="mt-1" />
            {/* Add search/dropdown functionality for recipients here */}
          </div>
          <div>
            <Label htmlFor="messageBody">Message:</Label>
            <Textarea
              id="messageBody"
              placeholder="Type your message here..."
              className="mt-1 min-h-[150px] resize-none"
            />
          </div>
          <div className="flex justify-end">
            <Button>
              <Send className="mr-2 h-4 w-4" />
              Send Message
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
