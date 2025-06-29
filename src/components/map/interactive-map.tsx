
"use client";

import React, { useEffect, useState, useRef } from 'react';
import { APIProvider, Map, AdvancedMarker, useMapsLibrary } from '@vis.gl/react-google-maps';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, MapPin, LocateFixed, Loader2 } from "lucide-react";
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
  centerAddress?: string | null;
}

const CHATTANOOGA_CENTER_LAT = 35.0456;
const CHATTANOOGA_CENTER_LNG = -85.3097;
const AREA_ZOOM = 9;
const LOCATION_ZOOM = 14;

function MapComponent({
  defaultCenterLat,
  defaultCenterLng,
  defaultZoom,
  markers: propMarkers = [],
  centerAddress,
}: Omit<InteractiveMapProps, 'className'>) {
  const geocodingApi = useMapsLibrary('geocoding');
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  
  const [internalMarker, setInternalMarker] = useState<MapMarker | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodingError, setGeocodingError] = useState<string | null>(null);
  
  const fetchUserLocation = () => {
    if (navigator.geolocation && mapInstance) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          mapInstance.panTo({ lat: position.coords.latitude, lng: position.coords.longitude });
          mapInstance.setZoom(LOCATION_ZOOM);
        },
        (error) => console.error("Error getting user location:", error.message)
      );
    }
  };

  useEffect(() => {
    if (!geocodingApi || !mapInstance || !centerAddress) {
      if (!centerAddress) {
        setInternalMarker(null);
        setGeocodingError(null);
      }
      return;
    }
    
    setIsGeocoding(true);
    setGeocodingError(null);

    const geocoder = new geocodingApi.Geocoder();
    geocoder.geocode({ address: centerAddress }, (results, status) => {
      setIsGeocoding(false);
      if (status === 'OK' && results && results[0]) {
        const location = results[0].geometry.location;
        const newPosition = { lat: location.lat(), lng: location.lng() };
        mapInstance.panTo(newPosition);
        mapInstance.setZoom(LOCATION_ZOOM);
        setInternalMarker({
          id: 'geocoded-marker',
          position: newPosition,
          title: centerAddress,
        });
      } else {
        console.error(`Geocode was not successful for the following reason: ${status}`);
        setGeocodingError(`Could not find location for: "${centerAddress}"`);
        setInternalMarker(null);
      }
    });

  }, [centerAddress, geocodingApi, mapInstance]);

  const markersToDisplay = centerAddress ? (internalMarker ? [internalMarker] : []) : propMarkers;

  return (
    <div className="w-full h-full relative">
      <Map
        defaultCenter={{ lat: defaultCenterLat!, lng: defaultCenterLng! }}
        defaultZoom={defaultZoom}
        gestureHandling={'greedy'}
        disableDefaultUI={true}
        mapId="rydzconnect_map"
        className="w-full h-full"
        onLoad={(evt) => setMapInstance(evt.map)}
        zoomControl={true}
        options={{
            zoomControl: true,
            panControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            mapTypeControl: false,
            gestureHandling: 'greedy',
        }}
      >
        {markersToDisplay!.map(marker => (
          <AdvancedMarker key={marker.id} position={marker.position} title={marker.title}>
              <span className="text-2xl">📍</span>
          </AdvancedMarker>
        ))}
      </Map>
      
      {(isGeocoding || geocodingError) && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm z-10">
          {isGeocoding ? (
            <div className="flex items-center gap-2 p-3 rounded-md bg-card shadow-lg">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Finding location...</span>
            </div>
          ) : (
             <div className="flex items-center gap-2 p-3 rounded-md bg-destructive text-destructive-foreground shadow-lg">
                <AlertTriangle className="h-5 w-5" />
                <span>{geocodingError}</span>
            </div>
          )}
        </div>
      )}

       <Button
            variant="outline"
            size="icon"
            onClick={fetchUserLocation}
            className="absolute bottom-4 right-4 bg-background/80 hover:bg-background shadow-md z-10"
            aria-label="Center map on my location"
        >
            <LocateFixed className="h-5 w-5" />
        </Button>
    </div>
  );
}

export function InteractiveMap({
  className,
  defaultCenterLat = CHATTANOOGA_CENTER_LAT,
  defaultCenterLng = CHATTANOOGA_CENTER_LNG,
  defaultZoom = AREA_ZOOM,
  ...props
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
    <Card className={cn("relative overflow-hidden", className)}>
      <APIProvider apiKey={apiKey}>
        <MapComponent 
            defaultCenterLat={defaultCenterLat}
            defaultCenterLng={defaultCenterLng}
            defaultZoom={defaultZoom}
            {...props} 
        />
      </APIProvider>
    </Card>
  );
}
