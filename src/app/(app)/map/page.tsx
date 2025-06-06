
import { InteractiveMap } from "@/components/map/interactive-map";
import { PageHeader } from "@/components/shared/page-header";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Map View',
  description: 'View events, rydz, and live tracking on an interactive map.', // Changed rides to rydz
};

export default function MapPage() {
  return (
    <>
      <PageHeader
        title="Interactive Map View"
        description="Visualize event locations, carpool routes, and active rydz in real-time." // Changed rides to rydz
      />
      <InteractiveMap className="w-full h-[calc(100vh-200px)]" /> {/* Adjust height as needed */}
    </>
  );
}

