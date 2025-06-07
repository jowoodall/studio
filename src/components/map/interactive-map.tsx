"use client";

import React from 'react';
import { APIProvider, Map } from '@vis.gl/react-google-maps';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, MapPin } from "lucide-react";
import { cn } from '@/lib/utils';

interface InteractiveMapProps {
  className?: string;
  defaultCenter?: { lat: number; lng: number };
  defaultZoom?: number;
  // markers, routes props can be added later
}

export function InteractiveMap({ 
  className, 
  defaultCenter = { lat: 39.8283, lng: -98.5795 }, // Center of USA
  defaultZoom = 4 
}: InteractiveMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return (
      <Card className={cn("flex flex-col items-center justify-center text-center", className)}>
        <CardHeader>
          <MapPin className="mx-auto h-10 w-10 text-destructive mb-2" />
          <CardTitle>Map Unavailable</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center text-destructive bg-destructive/10 p-3 rounded-md">
            <AlertTriangle className="h-5 w-5 mr-2"/>
            <p className="text-sm font-medium">
              Google Maps API Key is not configured.
            </p>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Please set the NEXT_PUBLIC_GOOGLE_MAPS_API_KEY environment variable.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("overflow-hidden", className)}>
      {/* <CardHeader className="absolute z-10 bg-background/80 backdrop-blur-sm p-2 rounded-br-lg rounded-tl-lg">
        <CardTitle className="flex items-center text-sm">
          <MapPin className="mr-1 h-4 w-4 text-primary" />
          Interactive Map
        </CardTitle>
      </CardHeader> */}
      {/* The CardHeader above can be added back if title overlay is desired, might need style tweaks */}
      <APIProvider apiKey={apiKey}>
        <div className="w-full h-full"> {/* Ensure map takes full space of its container */}
          <Map
            defaultCenter={defaultCenter}
            defaultZoom={defaultZoom}
            gestureHandling={'greedy'}
            disableDefaultUI={true}
            mapId="rydzconnect_map" // Optional: for Cloud-based map styling
            className="w-full h-full"
          >
            {/* Markers and other map elements will go here later */}
          </Map>
        </div>
      </APIProvider>
    </Card>
  );
}
