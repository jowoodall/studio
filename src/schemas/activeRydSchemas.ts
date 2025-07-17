
import * as z from 'zod';
import { RydDirection } from '@/types';

export const offerDriveFormSchema = z.object({
  direction: z.nativeEnum(RydDirection, { required_error: "Please select a ryd direction." }),
  eventId: z.string().min(1, "Event ID is required."),
  seatsAvailable: z.coerce.number().min(1, "Must offer at least 1 seat.").max(8, "Cannot offer more than 8 seats."),
  notes: z.string().max(200, "Notes cannot exceed 200 characters.").optional(),
  proposedDepartureTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:MM). Example: 16:30 for 4:30 PM."),
  plannedArrivalTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:MM). Example: 17:30 for 5:30 PM."),
  vehicleMakeModel: z.string().min(3, "Vehicle make and model must be at least 3 characters.").max(50, "Vehicle make and model cannot exceed 50 characters."),
  vehicleColor: z.string().max(30, "Vehicle color cannot exceed 30 characters.").optional(),
  licensePlate: z.string().max(15, "License plate cannot exceed 15 characters.").optional(),
  driverStartLocation: z.string().min(3, "Starting location must be at least 3 characters.").max(150, "Starting location cannot exceed 150 characters."),
  driverEndLocation: z.string().min(3, "Ending location must be at least 3 characters.").max(150, "Ending location cannot exceed 150 characters."),
});

export type OfferDriveFormValues = z.infer<typeof offerDriveFormSchema>;
