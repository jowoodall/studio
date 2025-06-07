
"use client";

import React, { useEffect, useState } from 'react';
import { APIProvider, Map } from '@vis.gl/react-google-maps';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, MapPin, LocateFixed } from "lucide-react";
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface InteractiveMapProps {
  className?: string;
  defaultCenterLat?: number;
  defaultCenterLng?: number;
  defaultZoom?: number;
}

const USA_CENTER_LAT = 39.8283;
const USA_CENTER_LNG = -98.5795;
const INITIAL_ZOOM = 4;
const USER_LOCATION_ZOOM = 14;

export function InteractiveMap({
  className,
  defaultCenterLat = USA_CENTER_LAT,
  defaultCenterLng = USA_CENTER_LNG,
  defaultZoom = INITIAL_ZOOM,
}: InteractiveMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const [currentCenter, setCurrentCenter] = useState({ lat: defaultCenterLat, lng: defaultCenterLng });
  const [currentZoom, setCurrentZoom] = useState(defaultZoom);
  const [geolocationAttempted, setGeolocationAttempted] = useState(false);
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);


  const fetchUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setCurrentCenter(userLocation);
          setCurrentZoom(USER_LOCATION_ZOOM);
          if (mapInstance) {
            mapInstance.panTo(userLocation);
            mapInstance.setZoom(USER_LOCATION_ZOOM);
          }
        },
        (error) => {
          console.error("Error getting user location:", error.message);
          // Fallback to default, which is already set
        }
      );
    } else {
      console.log("Geolocation is not supported by this browser.");
      // Fallback to default
    }
  };

  useEffect(() => {
    if (!geolocationAttempted) {
      fetchUserLocation();
      setGeolocationAttempted(true);
    }
  }, [geolocationAttempted]);


  if (!apiKey) {
    return (
      <Card className={cn("flex flex-col items-center justify-center text-center", className)}>
        <CardHeader>
          <MapPin className="mx-auto h-10 w-10 text-destructive mb-2" />
          <CardTitle>Map Unavailable</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center text-destructive bg-destructive/10 p-3 rounded-md">
            <AlertTriangle className="h-5 w-5 mr-2" />
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
    <Card className={cn("overflow-hidden relative", className)}>
      <APIProvider apiKey={apiKey}>
        <div className="w-full h-full">
          <Map
            center={currentCenter}
            zoom={currentZoom}
            gestureHandling={'greedy'}
            disableDefaultUI={true}
            mapId="rydzconnect_map"
            className="w-full h-full"
            onLoad={(map) => setMapInstance(map.map!)}
          >
            {/* Markers and other map elements will go here later */}
          </Map>
        </div>
        <Button
            variant="outline"
            size="icon"
            onClick={fetchUserLocation}
            className="absolute bottom-4 right-4 bg-background/80 hover:bg-background shadow-md z-10"
            aria-label="Center map on my location"
        >
            <LocateFixed className="h-5 w-5" />
        </Button>
      </APIProvider>
    </Card>
  );
}
