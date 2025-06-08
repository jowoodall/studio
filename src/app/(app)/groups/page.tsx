
import { PageHeader } from "@/components/shared/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Users, Edit, Trash2, Settings2, Eye } from "lucide-react"; // Added Eye icon
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from 'next';
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: 'Manage Groups',
};

// Mock data for groups
const mockGroups = [
  { id: "1", name: "Morning School Run", members: 5, description: "Daily carpool to Northwood High.", image: "https://placehold.co/400x200.png?text=School+Run", dataAiHint: "school children" },
  { id: "2", name: "Soccer Practice Crew", members: 3, description: "Carpool for weekend soccer practice.", image: "https://placehold.co/400x200.png?text=Soccer+Practice", dataAiHint: "soccer team" },
  { id: "3", name: "Work Commute (Downtown)", members: 2, description: "Shared rydz to downtown offices.", image: "https://placehold.co/400x200.png?text=Work+Commute", dataAiHint: "city traffic" },
];

export default function GroupsPage() {
  return (
    <>
      <PageHeader
        title="Carpool Groups"
        description="Manage your carpool groups or create new ones."
        actions={
          <Button asChild>
            <Link href="/groups/create">
              <PlusCircle className="mr-2 h-4 w-4" /> Create New Group
            </Link>
          </Button>
        }
      />

      {mockGroups.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {mockGroups.map((group) => (
            <Card key={group.id} className="flex flex-col shadow-lg hover:shadow-xl transition-shadow">
              <Link href={`/groups/${group.id}`} className="block hover:opacity-90 transition-opacity">
                <CardHeader className="relative h-40 p-0">
                   <Image src={group.image} alt={group.name} fill className="rounded-t-lg object-cover" data-ai-hint={group.dataAiHint} />
                </CardHeader>
              </Link>
              <CardContent className="flex-grow pt-4">
                <Link href={`/groups/${group.id}`} className="hover:underline">
                    <CardTitle className="font-headline text-xl mb-1">{group.name}</CardTitle>
                </Link>
                <div className="flex items-center text-sm text-muted-foreground mb-2">
                  <Users className="mr-1.5 h-4 w-4" /> {group.members} members
                </div>
                <CardDescription className="text-sm h-10 overflow-hidden text-ellipsis">{group.description}</CardDescription>
              </CardContent>
              <CardFooter className="border-t pt-4 flex flex-wrap justify-between items-center gap-2">
                <Link
                  href={`/groups/${group.id}`}
                  className={cn(buttonVariants({ variant: "default", size: "sm" }), "flex-grow sm:flex-grow-0")}
                >
                  <Eye className="mr-2 h-4 w-4" /> View Group
                </Link>
                <div className="flex space-x-1">
                    <Link
                        href={`/groups/${group.id}/manage`}
                        className={cn(buttonVariants({ variant: "outline", size: "icon" }))}
                        aria-label="Manage group members"
                        title="Manage Members"
                    >
                        <Settings2 className="h-4 w-4" />
                    </Link>
                    <Link
                        href={`/groups/${group.id}/edit`}
                        className={cn(buttonVariants({ variant: "outline", size: "icon" }))}
                        aria-label="Edit group"
                        title="Edit Group"
                    >
                        <Edit className="h-4 w-4" />
                    </Link>
                  {/* Delete button remains a direct action for now */}
                  <Button variant="destructive" size="icon" aria-label="Delete group" title="Delete Group">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="text-center py-12 shadow-md">
          <CardHeader>
            <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <CardTitle className="font-headline text-2xl">No Groups Yet</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="mb-6">
              You haven&apos;t created or joined any carpool groups.
              Get started by creating one!
            </CardDescription>
            <Button asChild>
              <Link href="/groups/create">
                <PlusCircle className="mr-2 h-4 w-4" /> Create Your First Group
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </>
  );
}
