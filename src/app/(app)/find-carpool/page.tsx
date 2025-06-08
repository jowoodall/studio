
"use client";

import React, { useState } from 'react';
import { FindCarpoolForm } from "@/components/carpool/find-carpool-form";
import { PageHeader } from "@/components/shared/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

// Client components cannot export metadata. Remove or move to a server component parent.
// export const metadata: Metadata = {
//   title: 'Find a Carpool',
//   description: 'Use AI to find carpool matches for your events and commutes.',
// };

interface MockEvent {
  id: string;
  name: string;
  location: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
}

const mockEvents: MockEvent[] = [
  { id: "event1", name: "School Annual Day", location: "Northwood High Auditorium", date: "2024-12-15", time: "10:00" },
  { id: "event2", name: "Community Soccer Match", location: "City Sports Complex", date: "2024-11-30", time: "14:00" },
  { id: "event3", name: "Tech Conference 2024", location: "Downtown Convention Center", date: "2025-01-20", time: "09:00" },
];

interface SelectedEventDetails {
  location: string;
  date: Date;
  time: string;
}

export default function FindCarpoolPage() {
  const [selectedEventDetails, setSelectedEventDetails] = useState<SelectedEventDetails | null>(null);

  const handleEventSelect = (eventId: string) => {
    if (eventId === "manual") {
      setSelectedEventDetails(null);
      return;
    }
    const event = mockEvents.find(e => e.id === eventId);
    if (event) {
      // Convert date string to Date object, adjust for local timezone by splitting
      const [year, month, day] = event.date.split('-').map(Number);
      const eventDate = new Date(year, month - 1, day); // Month is 0-indexed

      setSelectedEventDetails({
        location: event.location,
        date: eventDate,
        time: event.time,
      });
    } else {
      setSelectedEventDetails(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Find a Carpool with AI"
        description="Select an event or enter details manually to get AI-powered carpool suggestions."
      />
      <Card className="mb-6 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">Select an Event (Optional)</CardTitle>
          <CardDescription>Choosing an event will pre-fill some details below.</CardDescription>
        </CardHeader>
        <CardContent>
          <Label htmlFor="event-select" className="sr-only">Select Event</Label>
          <Select onValueChange={handleEventSelect}>
            <SelectTrigger id="event-select" className="w-full md:w-[300px]">
              <SelectValue placeholder="Choose an event or enter manually" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Enter Details Manually</SelectItem>
              {mockEvents.map(event => (
                <SelectItem key={event.id} value={event.id}>
                  {event.name} ({event.date})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
      <FindCarpoolForm
        initialEventLocation={selectedEventDetails?.location}
        initialEventDate={selectedEventDetails?.date}
        initialEventTime={selectedEventDetails?.time}
      />
    </>
  );
}
