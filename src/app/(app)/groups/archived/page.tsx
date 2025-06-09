
"use client"; // Add this directive

// src/app/(app)/groups/archived/page.tsx
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ArchiveRestore, Users, ArrowLeft } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
// Metadata export is not used in Client Components
// import type { Metadata } from 'next';

// export const metadata: Metadata = {
//   title: 'Archived Groups',
// };

// Mock data for archived groups
const mockArchivedGroups = [
  { id: "archived1", name: "Old Book Club Carpool", members: 4, description: "Weekly carpool for the downtown book club (Disbanded).", image: "https://placehold.co/400x200.png?text=Book+Club+Archive", dataAiHint: "books old" },
  { id: "archived2", name: "Summer Camp Rydz 2023", members: 10, description: "Carpool group for last year's summer camp.", image: "https://placehold.co/400x200.png?text=Camp+Archive", dataAiHint: "kids summer camp" },
];

export default function ArchivedGroupsPage() {
  // Mock unarchive action
  const handleUnarchiveGroup = (groupId: string, groupName: string) => {
    console.log(`Unarchiving group: ${groupName} (ID: ${groupId})`);
    alert(`Mock unarchive: ${groupName} would be restored.`);
    // In a real app, update status and potentially re-fetch/filter lists
  };
  
  return (
    <>
      <PageHeader
        title="Archived Groups"
        description="View groups that you have previously archived."
        actions={
          <Button variant="outline" asChild>
            <Link href="/groups">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Active Groups
            </Link>
          </Button>
        }
      />

      {mockArchivedGroups.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {mockArchivedGroups.map((group) => (
            <Card key={group.id} className="flex flex-col shadow-lg opacity-75 hover:opacity-100 transition-opacity">
              <div className="relative h-40 p-0">
                 <Image src={group.image} alt={group.name} fill className="rounded-t-lg object-cover" data-ai-hint={group.dataAiHint} />
              </div>
              <CardContent className="flex-grow pt-4">
                <CardTitle className="font-headline text-xl mb-1">{group.name}</CardTitle>
                <div className="flex items-center text-sm text-muted-foreground mb-2">
                  <Users className="mr-1.5 h-4 w-4" /> {group.members} members (Archived)
                </div>
                <CardDescription className="text-sm h-10 overflow-hidden text-ellipsis">{group.description}</CardDescription>
              </CardContent>
              <CardFooter className="border-t pt-4 flex justify-end">
                <Button 
                    variant="outline" 
                    onClick={() => handleUnarchiveGroup(group.id, group.name)}
                    className="text-green-600 hover:bg-green-500/10 hover:text-green-700"
                >
                  <ArchiveRestore className="mr-2 h-4 w-4" /> Unarchive
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="text-center py-12 shadow-md">
          <CardHeader>
            <ArchiveRestore className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <CardTitle className="font-headline text-2xl">No Archived Groups</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="mb-6">
              You have not archived any groups yet.
            </CardDescription>
            <Button variant="outline" asChild>
              <Link href="/groups">
                <ArrowLeft className="mr-2 h-4 w-4" /> View Active Groups
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </>
  );
}
