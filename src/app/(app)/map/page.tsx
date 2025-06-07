
import { InteractiveMap } from "@/components/map/interactive-map";
import { PageHeader } from "@/components/shared/page-header";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Map View',
  description: 'View events, rydz, and live tracking on an interactive map.', // Changed rides to rydz
};

// Mock upcoming events with geographic coordinates for the main map page
const mockUpcomingEventsForMapPage = [
  { id: "mapEvent1", title: "Grand City Marathon", lat: 34.0522, lng: -118.2437, description: "Starts at City Hall" },
  { id: "mapEvent2", title: "Tech Innovators Summit", lat: 37.7749, lng: -122.4194, description: "Moscone Center" },
  { id: "mapEvent3", title: "Lakeside Music Festival", lat: 41.8781, lng: -87.6298, description: "Millennium Park, Chicago" },
  { id: "mapEvent4", title: "Local Farmers Market", lat: 34.0600, lng: -118.2500, description: "Community Square, Los Angeles" },
  { id: "mapEvent5", title: "Art Fair Downtown", lat: 40.7128, lng: -74.0060, description: "SoHo District, New York" },
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
        description="Visualize event locations, carpool routes, and active rydz in real-time. Markers indicate upcoming event locations." // Changed rides to rydz
      />
      <InteractiveMap 
        className="w-full h-[calc(100vh-200px)]" 
        markers={mapPageMarkers} 
      /> {/* Adjust height as needed */}
    </>
  );
}

