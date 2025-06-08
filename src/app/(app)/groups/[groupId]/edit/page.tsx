
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Edit } from "lucide-react";
import Link from "next/link";
import type { Metadata } from 'next';

// Mock group data - in a real app, you'd fetch this
const mockGroupsData: { [key: string]: { name: string } } = {
  "1": { name: "Morning School Run" },
  "2": { name: "Soccer Practice Crew" },
  "3": { name: "Work Commute (Downtown)" },
};

export async function generateMetadata({ params }: { params: { groupId: string } }): Promise<Metadata> {
  const groupName = mockGroupsData[params.groupId]?.name || `Group ${params.groupId}`;
  return {
    title: `Edit Group: ${groupName}`,
  };
}

export default function EditGroupPage({ params }: { params: { groupId: string } }) {
  const { groupId } = params;
  const groupDetails = mockGroupsData[groupId];

  if (!groupDetails) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-10">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Group Not Found</h2>
        <p className="text-muted-foreground">The group with ID "{groupId}" could not be found.</p>
        <Button asChild className="mt-4">
          <Link href="/groups">Back to Groups</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={`Edit Group: ${groupDetails.name}`}
        description={`You are currently editing the details for ${groupDetails.name}.`}
      />
      <Card className="w-full max-w-lg mx-auto shadow-lg">
        <CardHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
            <Edit className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-center font-headline text-xl">Edit Group Information</CardTitle>
          <CardDescription className="text-center">
            Modify the details of your carpool group below.
            (This is a placeholder page - form functionality to be implemented.)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-6 border-2 border-dashed border-muted rounded-md text-center text-muted-foreground">
            <p>Group Edit Form Placeholder</p>
            <p className="text-sm">Fields for group name, description, members, etc., would go here.</p>
          </div>
          <Button className="w-full mt-6" disabled>Save Changes (Not Implemented)</Button>
        </CardContent>
      </Card>
       <div className="text-center mt-6">
        <Button variant="link" asChild>
            <Link href="/groups">Back to Groups</Link>
        </Button>
      </div>
    </>
  );
}
