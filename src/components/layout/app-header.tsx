
'use client';
import Link from 'next/link';
import React, { useState, useEffect } from 'react';
import { Bell, UserCircle, Menu, LogOut, Settings, Loader2 } from 'lucide-react';
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
import { useRouter, usePathname } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { signOut } from 'firebase/auth'; 
import { auth } from '@/lib/firebase'; 
import { useAuth } from '@/context/AuthContext'; 
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getNotificationsAction } from '@/actions/notificationActions';

export function AppHeader() {
  const { toggleSidebar, isMobile } = useSidebar();
  const router = useRouter();
  const { toast } = useToast();
  const { user, userProfile, loading: authLoading, isLoadingProfile } = useAuth();
  
  const [hasMounted, setHasMounted] = React.useState(false);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const pathname = usePathname();

  React.useEffect(() => {
    setHasMounted(true);
  }, []);
  
  // Effect to fetch notification status
  useEffect(() => {
    if (!user) {
      setHasUnreadNotifications(false);
      return;
    }

    const fetchNotificationStatus = async () => {
      // Don't show the indicator on the notifications page itself
      if (pathname === '/notifications') {
        setHasUnreadNotifications(false);
        return;
      }
      const result = await getNotificationsAction(user.uid);
      if (result.success && result.notifications) {
        const hasUnread = result.notifications.some(n => !n.read);
        setHasUnreadNotifications(hasUnread);
      }
    };

    fetchNotificationStatus();
    // Re-fetch when the user changes or the path changes
  }, [user, pathname]);


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

  const isLoading = authLoading || isLoadingProfile;

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center space-x-4 sm:justify-between sm:space-x-0">
        <div className="flex gap-6 md:gap-10 items-center">
          {!hasMounted ? (
            // Render a static placeholder on the server and initial client render to avoid mismatch
             <Link href="/dashboard" className="hidden items-center space-x-2 md:flex">
                <Logo iconOnly />
                <span className="hidden font-bold sm:inline-block font-headline">{siteConfig.name}</span>
             </Link>
          ) : isMobile ? (
            // Render mobile view only on the client
            <>
              <Button variant="ghost" size="icon" onClick={toggleSidebar} aria-label="Toggle sidebar">
                 <Menu className="h-5 w-5" />
              </Button>
              <Link href="/dashboard" className="flex items-center space-x-2">
                 <Logo iconOnly />
              </Link>
            </>
          ) : (
            // Render desktop view only on the client
             <Link href="/dashboard" className="hidden items-center space-x-2 md:flex">
                <Logo iconOnly />
                <span className="hidden font-bold sm:inline-block font-headline">{siteConfig.name}</span>
             </Link>
          )}
        </div>

        <div className="flex flex-1 items-center justify-end space-x-4">
          <nav className="flex items-center space-x-2">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/notifications" aria-label="Notifications" className="relative">
                <Bell className="h-5 w-5" />
                {hasUnreadNotifications && (
                  <span className="absolute top-1.5 right-1.5 block h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-background" />
                )}
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0">
                  <Avatar className="h-9 w-9">
                    {userProfile?.avatarUrl || user?.photoURL ? (
                      <AvatarImage src={userProfile?.avatarUrl || user?.photoURL || undefined} alt={userProfile?.fullName || user?.displayName || 'User avatar'} />
                    ): null}
                    <AvatarFallback>
                      {isLoading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : userProfile?.fullName ? (
                        userProfile.fullName.charAt(0).toUpperCase()
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
                {isLoading ? (
                  <DropdownMenuItem disabled>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
                  </DropdownMenuItem>
                ) : userProfile ? (
                  <>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{userProfile.fullName}</p>
                        <p className="text-xs leading-none text-muted-foreground">
                          {userProfile.email}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {userAccountMenu
                      .filter(item => {
                        if (!item.roles || item.roles.length === 0) return true; // Always show if no roles defined
                        if (!userProfile || !userProfile.role) {
                           // If profile or role is missing, only allow logout/login/signup, or items without role restrictions.
                           // This case should be rare if isLoadingProfile is handled correctly.
                           return item.title === 'Log Out' || (!item.roles || item.roles.length === 0);
                        }
                        return item.roles.includes(userProfile.role);
                      })
                      .map((item) => {
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
                  </>
                ) : user ? ( // Fallback if userProfile failed to load but Firebase user exists
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
                        <DropdownMenuItem onSelect={handleLogout} className="cursor-pointer">
                            <LogOut className="mr-2 h-4 w-4 text-muted-foreground" />
                            <span>Log Out</span>
                        </DropdownMenuItem>
                    </>
                ) : ( // Not logged in, or still in initial auth loading phase (covered by isLoading)
                    <>
                      <DropdownMenuItem asChild>
                        <Link href="/login" className="flex items-center">
                           <LogOut className="mr-2 h-4 w-4 text-muted-foreground transform rotate-180" />
                          <span>Log In</span>
                        </Link>
                      </DropdownMenuItem>
                       <DropdownMenuItem asChild>
                        <Link href="/signup" className="flex items-center">
                           <UserCircle className="mr-2 h-4 w-4 text-muted-foreground" />
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
