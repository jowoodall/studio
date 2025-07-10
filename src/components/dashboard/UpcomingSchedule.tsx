
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from '@/components/ui/button';
import { Loader2, Car, CalendarDays, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getUpcomingScheduleAction } from '@/actions/dashboardActions';
import type { ScheduleItem } from '@/types';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

// --- Subcomponents defined within the same file ---

const ScheduleItemCard = ({ item }: { item: ScheduleItem }) => {
  const Icon = item.type === 'ryd' || item.type === 'request' ? Car : CalendarDays;
  return (
    <Link href={item.href} className="block hover:bg-muted/50 rounded-lg transition-colors">
      <Card className="shadow-none border-l-4" style={{ borderLeftColor: item.type === 'event' ? 'hsl(var(--secondary))' : 'hsl(var(--primary))' }}>
        <CardContent className="p-3">
          <div className="flex items-start gap-3">
            <Icon className="h-5 w-5 mt-1 text-muted-foreground flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-sm leading-tight">{item.title}</p>
              {item.subtitle && <p className="text-xs text-muted-foreground mt-0.5">{item.subtitle}</p>}
              <p className="text-xs text-muted-foreground mt-1">{format(parseISO(item.timestamp), 'p')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};

const ScheduleDayColumn = ({ day, items }: { day: string; items: ScheduleItem[] }) => {
  const dayDate = parseISO(day);
  let dayLabel = format(dayDate, 'EEE, MMM d');
  if (isToday(dayDate)) dayLabel = "Today";
  if (isTomorrow(dayDate)) dayLabel = "Tomorrow";

  return (
    <div className="flex flex-col w-72 flex-shrink-0 snap-start">
      <h3 className="font-semibold px-3 pb-2 sticky top-0 bg-background/95 backdrop-blur-sm z-10">{dayLabel}</h3>
      <div className="space-y-2 px-1">
        {items.map(item => (
          <ScheduleItemCard key={item.id} item={item} />
        ))}
      </div>
    </div>
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
        const idToken = await user.getIdToken();
        const result = await getUpcomingScheduleAction({ idToken });
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
      <CardHeader>
        <CardTitle>Upcoming Schedule</CardTitle>
        <CardDescription>Your rydz and events for the next 14 days.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-48 text-center text-destructive bg-destructive/10 p-4 rounded-md">
            <AlertTriangle className="h-8 w-8 mb-2" />
            <p className="font-semibold">Could not load schedule</p>
            <p className="text-xs mt-1">{error}</p>
          </div>
        ) : dayKeys.length === 0 ? (
          <div className="text-center text-muted-foreground h-48 flex flex-col items-center justify-center">
            <CalendarDays className="h-8 w-8 mb-2" />
            <p>Your schedule is clear for the next two weeks.</p>
          </div>
        ) : (
          <div className="w-full max-w-full">
            <ScrollArea className="w-full whitespace-nowrap rounded-md pb-4">
              <div className="flex space-x-4">
                {dayKeys.map(day => (
                  <ScheduleDayColumn key={day} day={day} items={groupedByDay[day]} />
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
