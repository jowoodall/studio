
'use client';
import Link from 'next/link';
import { Bell, UserCircle, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Logo } from '@/components/icons/logo';
import { useSidebar } from '@/components/ui/sidebar'; 
import { siteConfig, userAccountMenu } from '@/config/site';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

export function AppHeader() {
  const { toggleSidebar, isMobile } = useSidebar();
  const router = useRouter();
  const { toast } = useToast();

  const handleLogout = (event: Event) => {
    event.preventDefault(); // Prevent default if it's trying to navigate via an href
    // Placeholder for actual logout logic (e.g., clearing session, calling API)
    console.log("Logging out...");
    toast({
      title: "Logged Out",
      description: "You have been successfully logged out.",
    });
    router.push('/'); // Redirect to homepage
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center space-x-4 sm:justify-between sm:space-x-0">
        <div className="flex gap-6 md:gap-10 items-center">
          {isMobile && (
             <Button variant="ghost" size="icon" onClick={toggleSidebar} aria-label="Toggle sidebar">
                <Menu className="h-5 w-5" />
             </Button>
          )}
          {!isMobile && (
             <Link href="/dashboard" className="hidden items-center space-x-2 md:flex">
                <Logo iconOnly />
                <span className="hidden font-bold sm:inline-block font-headline">{siteConfig.name}</span>
             </Link>
          )}
           {isMobile && (
             <Link href="/dashboard" className="flex items-center space-x-2">
                <Logo iconOnly />
             </Link>
          )}
        </div>

        <div className="flex flex-1 items-center justify-end space-x-4">
          <nav className="flex items-center space-x-2">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/notifications" aria-label="Notifications">
                <Bell className="h-5 w-5" />
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="User menu">
                  <UserCircle className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {userAccountMenu.map((item) => {
                  if (item.title === 'Log Out') {
                    return (
                      <DropdownMenuItem key={item.title} onSelect={handleLogout} className="cursor-pointer">
                        {item.icon && <item.icon className="h-4 w-4 text-muted-foreground" />}
                        <span className="ml-2">{item.title}</span>
                      </DropdownMenuItem>
                    );
                  }
                  return (
                    <DropdownMenuItem key={item.href} asChild>
                      <Link href={item.href} className="flex items-center gap-2">
                        {item.icon && <item.icon className="h-4 w-4 text-muted-foreground" />}
                        <span>{item.title}</span>
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
        </div>
      </div>
    </header>
  );
}
