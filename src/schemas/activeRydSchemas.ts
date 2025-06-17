
import * as z from 'zod';

// Step 1: Basic schema for the "Offer Drive for Event" form
// This will be used for both client and server-side validation initially.
export const offerDriveFormStep1Schema = z.object({
  eventId: z.string().min(1, "Event ID is required."),
  seatsAvailable: z.coerce.number().min(1, "Must offer at least 1 seat.").max(8, "Cannot offer more than 8 seats."),
  notes: z.string().max(100, "Notes cannot exceed 100 characters.").optional(),
});

export type OfferDriveFormStep1Values = z.infer<typeof offerDriveFormStep1Schema>;
