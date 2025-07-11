
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from '@/components/ui/button';
import { Loader2, Car, CalendarDays, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getUpcomingScheduleAction } from '@/actions/dashboardActions';
import type { ScheduleItem } from '@/types';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

// --- Subcomponents defined within the same file ---

const ScheduleItemCard = ({ item }: { item: ScheduleItem }) => {
  const Icon = item.type === 'ryd' || item.type === 'request' ? Car : CalendarDays;
  return (
    <Link href={item.href} className="block hover:bg-muted/50 rounded-lg transition-colors -mx-2 px-2 py-2">
      <div className="flex items-start gap-3">
        <Icon className="h-5 w-5 mt-1 text-muted-foreground flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-tight truncate">{item.title}</p>
          {item.subtitle && <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.subtitle}</p>}
        </div>
        <p className="text-xs text-muted-foreground mt-1 whitespace-nowrap">{format(parseISO(item.timestamp), 'p')}</p>
      </div>
    </Link>
  );
};


// --- Main Component ---

export function UpcomingSchedule() {
  const { user } = useAuth();
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    const fetchSchedule = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await getUpcomingScheduleAction({ userId: user.uid });
        if (result.success && result.schedule) {
          setSchedule(result.schedule);
        } else {
          setError(result.message || "Failed to fetch schedule.");
        }
      } catch (e: any) {
        setError(`An unexpected client-side error occurred: ${e.message}`);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSchedule();
  }, [user]);

  const groupedByDay = schedule.reduce((acc, item) => {
    const day = format(parseISO(item.timestamp), 'yyyy-MM-dd');
    if (!acc[day]) {
      acc[day] = [];
    }
    acc[day].push(item);
    return acc;
  }, {} as Record<string, ScheduleItem[]>);
  
  const dayKeys = Object.keys(groupedByDay).sort();

  return (
    <Card className="shadow-lg w-full">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg sm:text-xl">Upcoming Schedule</CardTitle>
        <CardDescription className="text-sm">Your rydz and events for the next 14 days.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-96">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-96 text-center text-destructive bg-destructive/10 p-4 rounded-md">
            <AlertTriangle className="h-8 w-8 mb-2" />
            <p className="font-semibold">Could not load schedule</p>
            <p className="text-xs mt-1">{error}</p>
          </div>
        ) : dayKeys.length === 0 ? (
          <div className="text-center text-muted-foreground h-96 flex flex-col items-center justify-center px-4 sm:px-0">
            <CalendarDays className="h-8 w-8 mb-2" />
            <p>Your schedule is clear for the next two weeks.</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-4 pr-4">
              {dayKeys.map((day, index) => {
                const dayDate = parseISO(day);
                let dayLabel = format(dayDate, 'EEEE, MMMM d');
                if (isToday(dayDate)) dayLabel = "Today";
                if (isTomorrow(dayDate)) dayLabel = "Tomorrow";
                
                return (
                  <div key={day}>
                    {index > 0 && <Separator className="my-3" />}
                    <h3 className="font-semibold text-sm sm:text-base mb-2 sticky top-0 bg-background/95 py-1 z-10">{dayLabel}</h3>
                    <div className="space-y-1">
                      {groupedByDay[day].map(item => (
                        <ScheduleItemCard key={item.id} item={item} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
