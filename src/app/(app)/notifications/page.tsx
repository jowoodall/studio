
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BellRing, CheckCheck, AlertTriangle, Info, Loader2 } from "lucide-react";
import Link from "next/link";
import { useAuth } from '@/context/AuthContext';
import { getNotificationsAction, markAllNotificationsAsReadAction, markNotificationAsReadAction } from '@/actions/notificationActions';
import { type NotificationData, NotificationType } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

const iconMap: Record<NotificationType, { icon: React.ElementType, colorClass: string, bgClass: string }> = {
  [NotificationType.INFO]: { icon: Info, colorClass: "text-blue-500", bgClass: "bg-blue-100" },
  [NotificationType.SUCCESS]: { icon: CheckCheck, colorClass: "text-green-500", bgClass: "bg-green-100" },
  [NotificationType.WARNING]: { icon: AlertTriangle, colorClass: "text-yellow-500", bgClass: "bg-yellow-100" },
  [NotificationType.ERROR]: { icon: AlertTriangle, colorClass: "text-destructive", bgClass: "bg-destructive/10" },
};

export default function NotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!user) {
      if (!authLoading) setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await getNotificationsAction(user.uid);
      if (result.success && result.notifications) {
        setNotifications(result.notifications as any); // Cast to handle string timestamp
      } else {
        throw new Error(result.message || "Failed to load notifications.");
      }
    } catch (err: any) {
      setError(err.message);
      toast({
        title: "Error Loading Notifications",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, authLoading, toast]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleNotificationClick = useCallback(async (notificationId: string) => {
    const notification = notifications.find(n => n.id === notificationId);
    if (!user || !notification || notification.read) return;

    // Optimistically update the UI
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );

    // Call the server action in the background
    try {
      await markNotificationAsReadAction(user.uid, notificationId);
    } catch (error: any) {
      console.error("Failed to mark notification as read:", error);
      toast({
        title: "Update Failed",
        description: "Could not save read status to the server.",
        variant: "destructive"
      });
      // Revert UI change on failure
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: false } : n)
      );
    }
  }, [user, notifications, toast]);

  const handleMarkAllAsRead = async () => {
    if (!user) return;
    try {
      const result = await markAllNotificationsAsReadAction(user.uid);
      if (result.success) {
        toast({ title: "Notifications Updated", description: result.message });
        // Optimistically update UI
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: "An unexpected error occurred.", variant: "destructive" });
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const renderContent = () => {
    if (isLoading || authLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-full py-12">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="mt-4 text-muted-foreground">Loading notifications...</p>
        </div>
      );
    }
    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full py-12 text-center">
          <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
          <h3 className="text-xl font-semibold">Error Loading Notifications</h3>
          <p className="text-muted-foreground mt-2">{error}</p>
        </div>
      );
    }
    if (notifications.length === 0) {
      return (
        <Card className="text-center py-12 shadow-md">
          <CardHeader>
            <BellRing className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <CardTitle className="font-headline text-2xl">No Notifications</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              You're all caught up!
            </CardDescription>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        {notifications.map((notification) => {
          const { icon: IconComponent, colorClass, bgClass } = iconMap[notification.type];
          
          const notificationCard = (
            <Card className={cn("shadow-md transition-all", !notification.read && 'border-primary border-2')}>
              <CardHeader className="flex flex-row items-start gap-4 pb-3 pt-4">
                <div className={cn("p-2 rounded-full", bgClass)}>
                    <IconComponent className={cn("h-5 w-5", colorClass)} />
                </div>
                <div className="flex-1">
                  <CardTitle className={cn("text-base font-semibold", !notification.read && 'text-primary')}>{notification.title}</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(notification.createdAt as string), { addSuffix: true })}
                  </CardDescription>
                </div>
                {!notification.read && <div className="h-2.5 w-2.5 rounded-full bg-primary mt-1"></div>}
              </CardHeader>
              <CardContent className="pb-4 pt-0 pl-16">
                <p className="text-sm">{notification.message}</p>
              </CardContent>
            </Card>
          );
          
          return notification.link ? (
            <Link 
              href={notification.link} 
              key={notification.id} 
              className="block hover:opacity-90 focus:outline-none" 
              aria-label={`View notification: ${notification.title}`}
              onClick={() => handleNotificationClick(notification.id)}
            >
              {notificationCard}
            </Link>
          ) : (
            <div 
              key={notification.id} 
              onClick={() => handleNotificationClick(notification.id)}
              className={cn(!notification.read && "cursor-pointer")}
              role={!notification.read ? "button" : undefined}
              tabIndex={!notification.read ? 0 : -1}
              onKeyDown={(e) => {
                  if((e.key === 'Enter' || e.key === ' ') && !notification.read) {
                      handleNotificationClick(notification.id);
                  }
              }}
            >
              {notificationCard}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <PageHeader
        title="Notifications"
        description={isLoading ? "Loading..." : `You have ${unreadCount} unread notifications.`}
        actions={
          <Button 
            variant="outline" 
            onClick={handleMarkAllAsRead}
            disabled={unreadCount === 0 || isLoading}
          >
            Mark all as read
          </Button>
        }
      />
      {renderContent()}
    </>
  );
}
