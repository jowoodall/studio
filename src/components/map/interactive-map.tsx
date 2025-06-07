
"use client";

import React, { useEffect, useState } from 'react';
import { APIProvider, Map, AdvancedMarker } from '@vis.gl/react-google-maps';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, MapPin, LocateFixed } from "lucide-react";
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface MapMarker {
  id: string;
  position: { lat: number; lng: number };
  title?: string;
}

interface InteractiveMapProps {
  className?: string;
  defaultCenterLat?: number;
  defaultCenterLng?: number;
  defaultZoom?: number;
  markers?: MapMarker[];
}

const CHATTANOOGA_CENTER_LAT = 35.0456;
const CHATTANOOGA_CENTER_LNG = -85.3097;
const AREA_ZOOM = 9; // Zoom level for a 25-mile radius overview
const USER_LOCATION_ZOOM = 12;

export function InteractiveMap({
  className,
  defaultCenterLat = CHATTANOOGA_CENTER_LAT,
  defaultCenterLng = CHATTANOOGA_CENTER_LNG,
  defaultZoom = AREA_ZOOM,
  markers = [],
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
          // If defaulting, ensure the map focuses on the default area
          setCurrentCenter({ lat: defaultCenterLat, lng: defaultCenterLng });
          setCurrentZoom(defaultZoom);
          if (mapInstance) {
            mapInstance.panTo({ lat: defaultCenterLat, lng: defaultCenterLng });
            mapInstance.setZoom(defaultZoom);
          }
        }
      );
    } else {
      console.log("Geolocation is not supported by this browser.");
      // Fallback to default
      setCurrentCenter({ lat: defaultCenterLat, lng: defaultCenterLng });
      setCurrentZoom(defaultZoom);
      if (mapInstance) {
        mapInstance.panTo({ lat: defaultCenterLat, lng: defaultCenterLng });
        mapInstance.setZoom(defaultZoom);
      }
    }
  };

  useEffect(() => {
    if (!geolocationAttempted) {
      fetchUserLocation();
      setGeolocationAttempted(true);
    }
  }, [geolocationAttempted, mapInstance, defaultCenterLat, defaultCenterLng, defaultZoom]); // Added dependencies


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
            disableDefaultUI={true} // Reverted to true as per previous request
            mapId="rydzconnect_map"
            className="w-full h-full"
            onLoad={(map) => setMapInstance(map.map!)}
          >
            {markers.map(marker => (
              <AdvancedMarker key={marker.id} position={marker.position} title={marker.title}>
                 {/* You can customize the marker icon here, e.g., using an img or a div */}
                 <span className="text-2xl">📍</span>
              </AdvancedMarker>
            ))}
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
