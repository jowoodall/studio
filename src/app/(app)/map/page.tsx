
import { InteractiveMap } from "@/components/map/interactive-map";
import { PageHeader } from "@/components/shared/page-header";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Map View',
  description: 'View events, rydz, and live tracking on an interactive map.',
};

// Mock upcoming events around Chattanooga, TN (approx. 35.0456° N, 85.3097° W)
const mockUpcomingEventsForMapPage = [
  { id: "mapEvent1", title: "Tennessee Aquarium Visit", lat: 35.0541, lng: -85.3105, description: "1 Broad St, Chattanooga" },
  { id: "mapEvent2", title: "Rock City Gardens Tour", lat: 34.9710, lng: -85.3500, description: "Lookout Mountain, GA side" },
  { id: "mapEvent3", title: "Chattanooga Choo Choo Event", lat: 35.0380, lng: -85.3150, description: "Terminal Station" },
  { id: "mapEvent4", title: "Walnut Street Bridge Stroll", lat: 35.0560, lng: -85.3080, description: "Pedestrian Bridge" },
  { id: "mapEvent5", title: "Signal Mountain Farmers Market", lat: 35.1600, lng: -85.3400, description: "Pruett's Market Area" },
];

export default function MapPage() {
  const mapPageMarkers = mockUpcomingEventsForMapPage.map(event => ({
    id: event.id,
    position: { lat: event.lat, lng: event.lng },
    title: `${event.title} - ${event.description}`,
  }));

  return (
    <>
      <PageHeader
        title="Interactive Map View"
        description="Visualize event locations, carpool routes, and active rydz in real-time. Markers indicate upcoming event locations."
      />
      <InteractiveMap 
        className="w-full h-[calc(100vh-200px)]" 
        markers={mapPageMarkers} 
        defaultCenterLat={35.0456} // Explicitly set Chattanooga as center
        defaultCenterLng={-85.3097}
        defaultZoom={9} // Set appropriate zoom for the region
      /> {/* Adjust height as needed */}
    </>
  );
}
