
import type React from 'react';
import type { Timestamp } from 'firebase/firestore'; 

export enum UserRole {
  STUDENT = 'student',
  PARENT = 'parent',
  DRIVER = 'driver', 
  ADMIN = 'admin',
}

export type NavItem = {
  title: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  label?: string;
  disabled?: boolean;
  external?: boolean;
  roles?: UserRole[];
  items?: NavItem[]; 
  collapsible?: boolean;
};

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
  canDrive?: boolean;
  driverDetails?: {
    ageRange?: string;
    drivingExperience?: string;
    primaryVehicle?: string; 
    passengerCapacity?: string;
  };
  managedStudentIds?: string[];
  associatedParentIds?: string[];
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
  associatedGroupIds: string[]; 
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

export interface RydData {
  requestedBy: string; 
  eventId?: string; 
  eventName?: string; 
  
  destination: string; 
  pickupLocation: string; 

  rydTimestamp: Timestamp; 
  earliestPickupTimestamp: Timestamp; 
  
  status: RydStatus; 
  
  driverId?: string; 
  passengerIds: string[]; 
  
  notes?: string; 
  
  createdAt: Timestamp; 
  updatedAt?: Timestamp; 
  assignedActiveRydId?: string; 
}

export enum ActiveRydStatus {
  PLANNING = 'planning', 
  AWAITING_PASSENGERS = 'awaiting_passengers', 
  IN_PROGRESS_PICKUP = 'in_progress_pickup', 
  IN_PROGRESS_ROUTE = 'in_progress_route', 
  COMPLETED = 'completed', 
  CANCELLED_BY_DRIVER = 'cancelled_by_driver',
  CANCELLED_BY_SYSTEM = 'cancelled_by_system', 
}

export enum PassengerManifestStatus {
  AWAITING_PICKUP = 'awaiting_pickup',
  ON_BOARD = 'on_board',
  DROPPED_OFF = 'dropped_off',
  MISSED_PICKUP = 'missed_pickup',
  CANCELLED_BY_PASSENGER = 'cancelled_by_passenger',
}

export interface PassengerManifestItem {
  userId: string; 
  originalRydRequestId: string; 
  pickupAddress: string; 
  destinationAddress: string; 
  status: PassengerManifestStatus; 
  pickupOrder?: number; 
  dropoffOrder?: number; 
  estimatedPickupTime?: Timestamp; 
  actualPickupTime?: Timestamp; 
  estimatedDropoffTime?: Timestamp; 
  actualDropoffTime?: Timestamp; 
  notes?: string; 
}

export interface ActiveRyd {
  id: string; 
  driverId: string; 
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
  plannedArrivalTime?: Timestamp; // New field
  estimatedCompletionTime?: Timestamp;
  startLocationAddress?: string; 
  finalDestinationAddress?: string; 
  routePolyline?: string; 
  passengerManifest: PassengerManifestItem[];
  associatedEventId?: string; 
  notes?: string; 
}
