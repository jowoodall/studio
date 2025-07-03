"use client";

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { APIProvider, Map, AdvancedMarker, useMapsLibrary } from '@vis.gl/react-google-maps';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, MapPin, LocateFixed, Loader2, Route, Clock, Users, Navigation } from "lucide-react";
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { OptimizedRoute, RouteWaypoint, RouteOptimizationRequest } from '@/types/route';
import { RouteRenderer, useRouteOptimization } from '@/utils/routeOptimizer';

interface MapMarker {
  id: string;
  position: { lat: number; lng: number };
  title?: string;
  type?: 'driver' | 'passenger' | 'event' | 'default';
}

interface InteractiveMapProps {
  className?: string;
  defaultCenterLat?: number;
  defaultCenterLng?: number;
  defaultZoom?: number;
  markers?: MapMarker[];
  centerAddress?: string | null;
  // Route optimization props
  enableRouteOptimization?: boolean;
  routeRequest?: RouteOptimizationRequest;
  onRouteCalculated?: (route: OptimizedRoute) => void;
  showRouteDetails?: boolean;
}

const CHATTANOOGA_CENTER_LAT = 35.0456;
const CHATTANOOGA_CENTER_LNG = -85.3097;
const AREA_ZOOM = 9;
const LOCATION_ZOOM = 14;

function RouteDetailsPanel({ route, onClose }: { route: OptimizedRoute; onClose: () => void }) {
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const formatDistance = (meters: number) => {
    const miles = meters * 0.000621371;
    return `${miles.toFixed(1)} miles`;
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Card className="absolute top-4 right-4 w-80 max-h-96 overflow-y-auto z-10 shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center">
            <Route className="mr-2 h-5 w-5" />
            Route Plan
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>×</Button>
        </div>
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span className="flex items-center">
            <Clock className="mr-1 h-4 w-4" />
            {formatDuration(route.totalDuration)}
          </span>
          <span className="flex items-center">
            <Navigation className="mr-1 h-4 w-4" />
            {formatDistance(route.totalDistance)}
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {route.waypoints.map((waypoint, index) => (
            <div key={waypoint.id} className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-1">
                <div className={cn(
                  "w-3 h-3 rounded-full border-2",
                  waypoint.type === 'driver_start' && "bg-green-500 border-green-500",
                  waypoint.type === 'passenger_pickup' && "bg-blue-500 border-blue-500",
                  waypoint.type === 'event_destination' && "bg-red-500 border-red-500"
                )} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">
                    {waypoint.type === 'driver_start' && 'Start'}
                    {waypoint.type === 'passenger_pickup' && `Pickup ${index}`}
                    {waypoint.type === 'event_destination' && 'Destination'}
                  </span>
                  {waypoint.passengerName && (
                    <Badge variant="secondary" className="text-xs">
                      {waypoint.passengerName}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-1 truncate">
                  {waypoint.address}
                </p>
                {waypoint.estimatedArrivalTime && (
                  <div className="flex gap-3 text-xs">
                    <span>ETA: {formatTime(waypoint.estimatedArrivalTime)}</span>
                    {waypoint.estimatedDepartureTime && 
                     waypoint.type === 'passenger_pickup' && (
                      <span>Depart: {formatTime(waypoint.estimatedDepartureTime)}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function MapComponent({
  defaultCenterLat,
  defaultCenterLng,
  defaultZoom,
  markers: propMarkers = [],
  centerAddress,
  enableRouteOptimization = false,
  routeRequest,
  onRouteCalculated,
  showRouteDetails = false,
}: Omit<InteractiveMapProps, 'className'>) {
  const geocodingApi = useMapsLibrary('geocoding');
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const [routeRenderer, setRouteRenderer] = useState<RouteRenderer | null>(null);
  const [showRoutePanel, setShowRoutePanel] = useState(false);
  
  const [internalMarker, setInternalMarker] = useState<MapMarker | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodingError, setGeocodingError] = useState<string | null>(null);
  
  const { optimizeRoute, isOptimizing, optimizedRoute, error: routeError, clearError } = useRouteOptimization();

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

  // Initialize route renderer when map loads
  useEffect(() => {
    if (mapInstance && enableRouteOptimization) {
      const renderer = new RouteRenderer(mapInstance);
      setRouteRenderer(renderer);
      
      return () => {
        renderer.destroy();
      };
    }
  }, [mapInstance, enableRouteOptimization]);

  // Handle route optimization
  useEffect(() => {
    if (enableRouteOptimization && routeRequest && mapInstance) {
      optimizeRoute(routeRequest);
    }
  }, [enableRouteOptimization, routeRequest, mapInstance, optimizeRoute]);

  // Render optimized route
  useEffect(() => {
    if (optimizedRoute && routeRenderer) {
      routeRenderer.renderRoute(optimizedRoute, (waypoint) => {
        console.log('Waypoint clicked:', waypoint);
      });
      
      if (onRouteCalculated) {
        onRouteCalculated(optimizedRoute);
      }
    }
  }, [optimizedRoute, routeRenderer, onRouteCalculated]);

  // Handle address geocoding
  useEffect(() => {
    if (!geocodingApi || !mapInstance || !centerAddress || enableRouteOptimization) {
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
  }, [centerAddress, geocodingApi, mapInstance, enableRouteOptimization]);

  const getMarkerContent = (marker: MapMarker) => {
    switch (marker.type) {
      case 'driver':
        return <span className="text-2xl">🚗</span>;
      case 'passenger':
        return <span className="text-2xl">👤</span>;
      case 'event':
        return <span className="text-2xl">🎯</span>;
      default:
        return <span className="text-2xl">📍</span>;
    }
  };

  const markersToDisplay = enableRouteOptimization ? [] : (centerAddress ? (internalMarker ? [internalMarker] : []) : propMarkers);

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
        {!enableRouteOptimization && markersToDisplay.map(marker => (
          <AdvancedMarker key={marker.id} position={marker.position} title={marker.title}>
            {getMarkerContent(marker)}
          </AdvancedMarker>
        ))}
      </Map>
      
      {/* Loading and Error States */}
      {(isGeocoding || geocodingError || isOptimizing || routeError) && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm z-10">
          {isGeocoding && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-card shadow-lg">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Finding location...</span>
            </div>
          )}
          {isOptimizing && (
            <div className="flex items-center gap-