
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BellRing, CheckCheck, AlertTriangle, Info } from "lucide-react";
import Link from "next/link";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Notifications',
};

const mockNotifications = [
  { id: "1", title: "New Ride Request", message: "John Doe requested a ride to Northwood High.", date: "2024-11-15 09:30 AM", type: "info", read: false, icon: Info, iconColor: "text-blue-500" },
  { id: "2", title: "Ride Confirmed", message: "Your ride with Jane Smith for the School Annual Day is confirmed.", date: "2024-11-14 05:00 PM", type: "success", read: true, icon: CheckCheck, iconColor: "text-green-500" },
  { id: "3", title: "Driver Approved", message: "You approved Alex Johnson to drive your child.", date: "2024-11-14 02:10 PM", type: "success", read: true, icon: CheckCheck, iconColor: "text-green-500"},
  { id: "4", title: "Event Reminder", message: "Community Soccer Match starts in 2 hours.", date: "2024-11-13 12:00 PM", type: "warning", read: false, icon: AlertTriangle, iconColor: "text-yellow-500" },
];

export default function NotificationsPage() {
  // In a real app, you'd fetch notifications
  const unreadCount = mockNotifications.filter(n => !n.read).length;

  return (
    <>
      <PageHeader
        title="Notifications"
        description={`You have ${unreadCount} unread notifications.`}
        actions={
          <Button variant="outline" disabled={mockNotifications.every(n => n.read)}>Mark all as read</Button>
        }
      />

      {mockNotifications.length > 0 ? (
        <div className="space-y-4">
          {mockNotifications.map((notification) => {
            const IconComponent = notification.icon;
            return (
            <Card key={notification.id} className={`shadow-md ${!notification.read ? 'border-primary border-2' : 'border-border'}`}>
              <CardHeader className="flex flex-row items-start gap-4 pb-3 pt-4">
                <div className={`p-2 bg-muted rounded-full ${notification.iconColor} bg-opacity-20`}>
                    <IconComponent className={`h-5 w-5 ${notification.iconColor}`} />
                </div>
                <div className="flex-1">
                  <CardTitle className={`text-base font-semibold ${!notification.read ? 'text-primary' : ''}`}>{notification.title}</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">{notification.date}</CardDescription>
                </div>
                {!notification.read && <div className="h-2.5 w-2.5 rounded-full bg-primary mt-1"></div>}
              </CardHeader>
              <CardContent className="pb-4 pt-0 pl-16">
                <p className="text-sm">{notification.message}</p>
                {/* Add actions specific to notification type if needed */}
                {/* e.g., <Button variant="link" size="sm" className="px-0">View Details</Button> */}
              </CardContent>
            </Card>
          )})}
        </div>
      ) : (
        <Card className="text-center py-12 shadow-md">
          <CardHeader>
            <BellRing className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <CardTitle className="font-headline text-2xl">No Notifications</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              You&apos;re all caught up!
            </CardDescription>
          </CardContent>
        </Card>
      )}
    </>
  );
}
