"use client";

import React, { useEffect, useState, useRef } from 'react';
// Removed Polyline from this import
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

interface RouteCoordinate {
  lat: number;
  lng: number;
}

interface InteractiveMapProps {
  className?: string;
  defaultCenterLat?: number;
  defaultCenterLng?: number;
  defaultZoom?: number;
  markers?: MapMarker[];
  routeCoordinates?: RouteCoordinate[];
}

const CHATTANOOGA_CENTER_LAT = 35.0456;
const CHATTANOOGA_CENTER_LNG = -85.3097;
const AREA_ZOOM = 9;
const USER_LOCATION_ZOOM = 12;

export function InteractiveMap({
  className,
  defaultCenterLat = CHATTANOOGA_CENTER_LAT,
  defaultCenterLng = CHATTANOOGA_CENTER_LNG,
  defaultZoom = AREA_ZOOM,
  markers = [],
  routeCoordinates = [],
}: InteractiveMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const [geolocationAttempted, setGeolocationAttempted] = useState(false);
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const [mapsApi, setMapsApi] = useState<typeof google.maps | null>(null); // To store the google.maps API object
  const polylineRef = useRef<google.maps.Polyline | null>(null); // Ref to store the polyline instance

  const fetchUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          // Only use mapInstance methods, don't update state for controlled behavior
          if (mapInstance) {
            mapInstance.panTo(userLocation);
            mapInstance.setZoom(USER_LOCATION_ZOOM);
          }
        },
        (error) => {
          console.error("Error getting user location:", error.message);
          // Fallback to default center if geolocation fails or is denied
          if (mapInstance) {
            mapInstance.panTo({ lat: defaultCenterLat, lng: defaultCenterLng });
            mapInstance.setZoom(defaultZoom);
          }
        }
      );
    } else {
      console.log("Geolocation is not supported by this browser.");
      if (mapInstance) {
        mapInstance.panTo({ lat: defaultCenterLat, lng: defaultCenterLng });
        mapInstance.setZoom(defaultZoom);
      }
    }
  };

  useEffect(() => {
    // Clean up existing polyline if it exists
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    // Draw new polyline if conditions are met
    if (mapInstance && mapsApi && routeCoordinates && routeCoordinates.length > 1) {
      const newPolyline = new mapsApi.Polyline({
        path: routeCoordinates,
        geodesic: true,
        strokeColor: '#007bff',
        strokeOpacity: 0.8,
        strokeWeight: 5,
      });
      newPolyline.setMap(mapInstance);
      polylineRef.current = newPolyline; // Store the new polyline instance
    }

    // Cleanup function for when the component unmounts or dependencies change
    return () => {
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }
    };
  }, [mapInstance, mapsApi, routeCoordinates]); // Rerun when map, mapsApi, or route changes

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
    <Card className={cn("relative", className)}>
      <APIProvider apiKey={apiKey}>
        <div className="w-full h-full relative" style={{ pointerEvents: 'auto' }}>
          <Map
            defaultCenter={{ lat: defaultCenterLat, lng: defaultCenterLng }}
            defaultZoom={defaultZoom}
            gestureHandling={'greedy'}
            disableDefaultUI={true}
            mapId="rydzconnect_map"
            className="w-full h-full"
            style={{ pointerEvents: 'auto' }}
            onLoad={(evt) => {
              setMapInstance(evt.map);
              setMapsApi(evt.maps);
              if (!geolocationAttempted) { // Attempt geolocation once map is loaded if not tried before
                fetchUserLocation();
                setGeolocationAttempted(true);
              }
            }}
            zoomControl={true}
            // Remove controlled behavior options since we're using uncontrolled mode
            options={{
              zoomControl: true,
              panControl: false,
              streetViewControl: false,
              fullscreenControl: false,
              mapTypeControl: false,
              gestureHandling: 'greedy',
            }}
          >
            {markers.map(marker => (
              <AdvancedMarker key={marker.id} position={marker.position} title={marker.title}>
                 <span className="text-2xl">📍</span>
              </AdvancedMarker>
            ))}
            {/* The Polyline React component is removed from here */}
          </Map>
        </div>
        <Button
            variant="outline"
            size="icon"
            onClick={fetchUserLocation} // Re-center on user location when clicked
            className="absolute bottom-4 right-4 bg-background/80 hover:bg-background shadow-md z-20"
            aria-label="Center map on my location"
            style={{ pointerEvents: 'auto' }}
        >
            <LocateFixed className="h-5 w-5" />
        </Button>
      </APIProvider>
    </Card>
  );
}