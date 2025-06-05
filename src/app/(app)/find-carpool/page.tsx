import { FindCarpoolForm } from "@/components/carpool/find-carpool-form";
import { PageHeader } from "@/components/shared/page-header";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Find a Carpool',
  description: 'Use AI to find carpool matches for your events and commutes.',
};

export default function FindCarpoolPage() {
  return (
    <>
      <PageHeader
        title="Find a Carpool with AI"
        description="Enter your event and travel details to get AI-powered carpool suggestions."
      />
      <FindCarpoolForm />
    </>
  );
}
