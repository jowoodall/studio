
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { getNotificationsAction } from '@/actions/notificationActions';
import { useAuth } from '@/context/AuthContext';
import { type NotificationData, NotificationType } from '@/types';
import { Loader2, BellRing, Info, CheckCheck, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const iconMap: Record<NotificationType, React.ElementType> = {
  [NotificationType.INFO]: Info,
  [NotificationType.SUCCESS]: CheckCheck,
  [NotificationType.WARNING]: AlertTriangle,
  [NotificationType.ERROR]: AlertTriangle,
};

export function WhatsNewFeed() {
  const { user, loading: authLoading } = useAuth();
  const [unreadNotifications, setUnreadNotifications] = useState<NotificationData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return; 
    if (!user) {
      setIsLoading(false);
      return;
    }
    const fetchNotifications = async () => {
      setIsLoading(true);
      const result = await getNotificationsAction(user.uid);
      if (result.success && result.notifications) {
        // Filter for unread notifications
        const unread = result.notifications.filter(n => !n.read);
        setUnreadNotifications(unread);
      }
      setIsLoading(false);
    };
    fetchNotifications();
  }, [user, authLoading]);

  // While loading, or if there are no unread notifications, render nothing.
  if (isLoading || unreadNotifications.length === 0) {
    return null;
  }
  
  // Display only up to 4 of the most recent unread notifications
  const displayedNotifications = unreadNotifications.slice(0, 4);

  return (
    <Card className="shadow-lg flex flex-col">
      <CardHeader>
        <CardTitle>What's New</CardTitle>
        <CardDescription>A summary of your recent unread notifications.</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow">
          <ul className="space-y-4">
            {displayedNotifications.map(notification => {
              const IconComponent = iconMap[notification.type] || BellRing;
              const link = notification.link || '/notifications';
              const timeAgo = formatDistanceToNow(new Date(notification.createdAt as string), { addSuffix: true });
              return (
                <li key={notification.id}>
                  <Link href={link} className="flex items-start gap-4 p-2 -m-2 rounded-lg hover:bg-accent/50 transition-colors">
                    <IconComponent className="h-5 w-5 mt-0.5 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium leading-tight">
                        {notification.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {timeAgo}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
      </CardContent>
      <CardFooter className="border-t pt-4 mt-auto">
        <Button variant="outline" className="w-full" asChild>
          <Link href="/notifications">View All Notifications</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
