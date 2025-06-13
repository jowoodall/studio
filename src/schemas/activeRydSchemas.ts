
import * as z from 'zod';

// Schema for data coming from the "Offer Drive for Event" form,
// used for server-side validation.
export const offerDriveFormServerSchema = z.object({
  eventId: z.string().min(1, "Event ID is required."),
  seatsAvailable: z.coerce.number().min(1, "Must offer at least 1 seat.").max(8, "Cannot offer more than 8 seats."),
  departureTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid departure time format (HH:MM)."),
  startLocationAddress: z.string().max(150, "Address cannot exceed 150 characters.").optional(),
  pickupInstructions: z.string().max(300, "Pickup instructions cannot exceed 300 characters.").optional().default(""),
});

export type OfferDriveFormServerValues = z.infer<typeof offerDriveFormServerSchema>;
