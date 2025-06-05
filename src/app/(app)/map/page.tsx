import { InteractiveMap } from "@/components/map/interactive-map";
import { PageHeader } from "@/components/shared/page-header";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Map View',
  description: 'View events, rides, and live tracking on an interactive map.',
};

export default function MapPage() {
  return (
    <>
      <PageHeader
        title="Interactive Map View"
        description="Visualize event locations, carpool routes, and active rides in real-time."
      />
      <InteractiveMap className="w-full h-[calc(100vh-200px)]" /> {/* Adjust height as needed */}
    </>
  );
}
