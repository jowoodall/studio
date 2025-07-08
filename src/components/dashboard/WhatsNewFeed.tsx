
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
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return; // Wait for auth state to be resolved
    if (!user) {
      setIsLoading(false);
      return;
    }
    const fetchNotifications = async () => {
      setIsLoading(true);
      const result = await getNotificationsAction(user.uid);
      if (result.success && result.notifications) {
        setNotifications((result.notifications as any).slice(0, 4)); // Get top 4
      }
      setIsLoading(false);
    };
    fetchNotifications();
  }, [user, authLoading]);

  return (
    <Card className="shadow-lg flex flex-col">
      <CardHeader>
        <CardTitle>What's New</CardTitle>
        <CardDescription>A summary of your recent activity and notifications.</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow">
        {isLoading ? (
          <div className="flex justify-center items-center py-4 h-40">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center text-muted-foreground py-4 h-40 flex flex-col items-center justify-center">
            <BellRing className="mx-auto h-8 w-8 mb-2" />
            <p>No new activity to show.</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {notifications.map(notification => {
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
        )}
      </CardContent>
      <CardFooter className="border-t pt-4 mt-auto">
        <Button variant="outline" className="w-full" asChild>
          <Link href="/notifications">View All Notifications</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
