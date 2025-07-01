
import type React from 'react';
import type { Timestamp } from 'firebase/firestore'; 

export enum UserRole {
  STUDENT = 'student',
  PARENT = 'parent',
  DRIVER = 'driver', 
  ADMIN = 'admin',
}

export enum EventStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export type NavItem = {
  title: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  label?: string;
  disabled?: boolean;
  external?: boolean;
  roles?: UserRole[];
  allowedEmails?: string[];
  items?: NavItem[]; 
  collapsible?: boolean;
};

export interface SavedLocation {
  id: string;
  name: string;
  address: string;
  icon: 'Home' | 'Briefcase' | 'School' | 'MapPin';
}

export interface UserProfileData {
  uid: string;
  fullName: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  dataAiHint?: string;
  bio?: string;
  phone?: string;
  preferences?: {
    notifications?: string;
    preferredPickupRadius?: string;
  };
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  savedLocations?: SavedLocation[];
  canDrive?: boolean;
  driverDetails?: {
    ageRange?: string;
    drivingExperience?: string;
    primaryVehicle?: string; 
    passengerCapacity?: string;
  };
  managedStudentIds?: string[];
  associatedParentIds?: string[];
  approvedDriverIds?: string[];
  joinedGroupIds?: string[]; 
  createdAt?: Timestamp;
}

export interface GroupData {
  id: string; 
  name: string;
  description: string;
  imageUrl?: string;
  dataAiHint?: string;
  createdBy: string; 
  createdAt: Timestamp;
  memberIds: string[]; 
  adminIds: string[]; 
}

export interface EventData {
  id: string; 
  name: string;
  eventTimestamp: Timestamp; 
  location: string;
  description?: string;
  eventType: string; 
  createdBy: string; 
  createdAt: Timestamp; 
  updatedAt?: Timestamp;
  associatedGroupIds: string[];
  status: EventStatus;
  managerIds: string[];
}

export type EventDriverStatus = "driving" | "not_driving" | "pending_response" | "full_car";

export interface EventDriverStateData {
  id: string; 
  eventId: string;
  driverId: string;
  status: EventDriverStatus;
  seatsAvailable?: number; 
  updatedAt: Timestamp;
}

export type RydStatus = 
  | 'requested' 
  | 'searching_driver' 
  | 'driver_assigned' 
  | 'confirmed_by_driver' 
  | 'en_route_pickup' 
  | 'en_route_destination' 
  | 'completed' 
  | 'cancelled_by_user' 
  | 'cancelled_by_driver' 
  | 'no_driver_found';

export enum ActiveRydStatus {
  PLANNING = 'planning', 
  AWAITING_PASSENGERS = 'awaiting_passengers', 
  RYD_PLANNED = 'ryd_planned',
  IN_PROGRESS_PICKUP = 'in_progress_pickup', 
  IN_PROGRESS_ROUTE = 'in_progress_route', 
  COMPLETED = 'completed', 
  CANCELLED_BY_DRIVER = 'cancelled_by_driver',
  CANCELLED_BY_SYSTEM = 'cancelled_by_system', 
}

export enum PassengerManifestStatus {
  PENDING_DRIVER_APPROVAL = 'pending_driver_approval',
  CONFIRMED_BY_DRIVER = 'confirmed_by_driver',
  REJECTED_BY_DRIVER = 'rejected_by_driver',
  AWAITING_PICKUP = 'awaiting_pickup',
  ON_BOARD = 'on_board',
  DROPPED_OFF = 'dropped_off',
  MISSED_PICKUP = 'missed_pickup',
  CANCELLED_BY_PASSENGER = 'cancelled_by_passenger',
}

export interface PassengerManifestItem {
  userId: string; 
  originalRydRequestId?: string; // Made optional
  pickupAddress?: string; // Made optional, might be set on confirmation
  destinationAddress: string; // Should be set from ActiveRyd.finalDestinationAddress
  status: PassengerManifestStatus; 
  pickupOrder?: number; 
  dropoffOrder?: number; 
  estimatedPickupTime?: Timestamp; 
  actualPickupTime?: Timestamp; 
  estimatedDropoffTime?: Timestamp; 
  actualDropoffTime?: Timestamp; 
  notes?: string; 
  requestedAt: Timestamp; // Added to track when the request to join was made
  earliestPickupTimestamp?: Timestamp; // Added for passenger-specific timing
}

export interface ActiveRyd {
  id: string; 
  driverId: string; 
  passengerUids?: string[]; // Efficient array for querying
  vehicleDetails?: { 
    make?: string;
    model?: string;
    color?: string; 
    licensePlate?: string; 
    passengerCapacity?: string; 
  };
  status: ActiveRydStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  proposedDepartureTime?: Timestamp; 
  plannedArrivalTime?: Timestamp; 
  estimatedCompletionTime?: Timestamp;
  startLocationAddress?: string; 
  finalDestinationAddress?: string; 
  routePolyline?: string; 
  passengerManifest: PassengerManifestItem[];
  associatedEventId?: string; 
  notes?: string;
  eventName?: string; // Denormalized from event
}

export interface DashboardRydData {
  id: string;
  rydFor: { name: string; relation: 'self' | 'student'; uid: string };
  isDriver: boolean;
  eventName: string;
  destination: string;
  rydStatus: ActiveRydStatus; // The overall status of the ActiveRyd
  eventTimestamp: Timestamp; // The time the event itself starts
  earliestPickupTimestamp?: Timestamp; // For passengers, their requested pickup window start
  proposedDepartureTimestamp?: Timestamp; // For drivers, their planned departure time
  driverName?: string;
  driverId?: string;
  passengerCount?: { confirmed: number; pending: number; totalInManifest: number; };
  passengerStatus?: PassengerManifestStatus; // The status of the specific person this ryd is for
}
