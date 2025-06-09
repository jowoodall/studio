
'use client';
import Link from 'next/link';
import { Bell, UserCircle, Menu, LogOut, Settings } from 'lucide-react'; // Added LogOut, Settings
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
import { signOut } from 'firebase/auth'; // Import Firebase signOut
import { auth } from '@/lib/firebase'; // Import auth instance
import { useAuth } from '@/context/AuthContext'; // Import useAuth
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'; // For user avatar

export function AppHeader() {
  const { toggleSidebar, isMobile } = useSidebar();
  const router = useRouter();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth(); // Get user and loading state from context

  const handleLogout = async (event: Event) => {
    event.preventDefault(); 
    try {
      await signOut(auth);
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out.",
      });
      router.push('/'); 
    } catch (error) {
      console.error("Logout error:", error);
      toast({
        title: "Logout Failed",
        description: "Could not log you out. Please try again.",
        variant: "destructive",
      });
    }
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
                <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0">
                  <Avatar className="h-9 w-9">
                    {user?.photoURL && <AvatarImage src={user.photoURL} alt={user.displayName || 'User avatar'} />}
                    <AvatarFallback>
                      {authLoading ? (
                        <UserCircle className="h-5 w-5 text-muted-foreground" />
                      ) : user?.displayName ? (
                        user.displayName.charAt(0).toUpperCase()
                      ) : (
                        <UserCircle className="h-5 w-5" />
                      )}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {user && !authLoading && (
                  <>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user.displayName || "User"}</p>
                        <p className="text-xs leading-none text-muted-foreground">
                          {user.email}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                  </>
                )}
                {userAccountMenu.map((item) => {
                  // Conditionally render items based on auth state if needed (e.g. hide "Log Out" if not logged in)
                  if (!user && item.title === "Log Out") return null;
                  if (!user && item.title !== "Log Out" && item.href !== "/login" && item.href !== "/signup") {
                    // Potentially hide other auth-only items if not logged in, or handle via route protection
                  }

                  if (item.title === 'Log Out') {
                    return (
                      <DropdownMenuItem key={item.title} onSelect={handleLogout} className="cursor-pointer">
                        {item.icon && <item.icon className="mr-2 h-4 w-4 text-muted-foreground" />}
                        <span>{item.title}</span>
                      </DropdownMenuItem>
                    );
                  }
                  return (
                    <DropdownMenuItem key={item.href} asChild>
                      <Link href={item.href} className="flex items-center">
                        {item.icon && <item.icon className="mr-2 h-4 w-4 text-muted-foreground" />}
                        <span>{item.title}</span>
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
                 {!user && !authLoading && ( // Show Login/Signup if not logged in
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/login" className="flex items-center">
                           <LogOut className="mr-2 h-4 w-4 text-muted-foreground transform rotate-180" /> {/* Using LogOut icon creatively for LogIn */}
                          <span>Log In</span>
                        </Link>
                      </DropdownMenuItem>
                       <DropdownMenuItem asChild>
                        <Link href="/signup" className="flex items-center">
                           <UserCircle className="mr-2 h-4 w-4 text-muted-foreground" /> {/* Placeholder */}
                          <span>Sign Up</span>
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
        </div>
      </div>
    </header>
  );
}
