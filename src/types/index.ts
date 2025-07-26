

import type React from 'react';
import type { Timestamp } from 'firebase/firestore'; 

export enum UserRole {
  STUDENT = 'student',
  PARENT = 'parent',
  DRIVER = 'driver', 
  ADMIN = 'admin',
}

export enum UserStatus {
  ACTIVE = 'active',
  INVITED = 'invited',
}

export enum EventStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum SubscriptionTier {
    FREE = 'free',
    PREMIUM = 'premium',
    ORGANIZATION = 'organization',
}

export enum RydDirection {
  TO_EVENT = 'to_event',
  FROM_EVENT = 'from_event',
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

export interface NotificationPreferences {
  rydUpdates?: { email?: boolean; text?: boolean };
  groupActivity?: { email?: boolean; text?: boolean };
  parentalApprovals?: { email?: boolean; text?: boolean };
  chatMessages?: { email?: boolean; text?: boolean };
}

export interface FamilyData {
    id: string;
    name: string;
    subscriptionTier: SubscriptionTier;
    subscriptionStartDate?: Timestamp;
    subscriptionEndDate?: Timestamp;
    stripeCustomerId?: string;
    memberIds: string[];
    adminIds: string[];
    createdAt: Timestamp;
    updatedAt?: Timestamp;
}

export interface UserProfileData {
  uid: string;
  placeholderId?: string; // Used to link an invited user to their placeholder doc
  fullName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  invitedBy?: string; // UID of the user who invited them
  subscriptionTier?: SubscriptionTier;
  avatarUrl?: string;
  dataAiHint?: string;
  bio?: string;
  phone?: string;
  onboardingComplete: boolean;
  preferences?: {
    notifications?: NotificationPreferences;
  };
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  savedLocations?: SavedLocation[];
  defaultLocationId?: string;
  canDrive?: boolean;
  driverDetails?: {
    ageRange?: string;
    drivingExperience?: string;
    primaryVehicle?: string; 
    passengerCapacity?: string;
  };
  managedStudentIds?: string[];
  associatedParentIds?: string[];
  approvedDrivers?: { [driverId: string]: string[] };
  declinedDriverIds?: string[];
  joinedGroupIds?: string[]; 
  familyIds?: string[];
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
  eventStartTimestamp: Timestamp; 
  eventEndTimestamp: Timestamp;
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
  PENDING_PARENT_APPROVAL = 'pending_parent_approval',
  REJECTED_BY_PARENT = 'rejected_by_parent',
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
  originalRydRequestId?: string; 
  pickupAddress?: string; 
  destinationAddress: string; 
  status: PassengerManifestStatus; 
  pickupOrder?: number; 
  dropoffOrder?: number; 
  estimatedPickupTime?: Timestamp; 
  actualPickupTime?: Timestamp; 
  estimatedDropoffTime?: Timestamp; 
  actualDropoffTime?: Timestamp; 
  notes?: string; 
  requestedAt: Timestamp; 
  earliestPickupTimestamp?: Timestamp; 
}

export interface RydMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  text: string;
  timestamp: Timestamp;
}

export interface ActiveRyd {
  id: string; 
  driverId: string; 
  passengerUids?: string[]; 
  uidsPendingParentalApproval?: string[]; 
  vehicleDetails?: { 
    make?: string;
    model?: string;
    color?: string; 
    licensePlate?: string; 
    passengerCapacity?: string; 
  };
  status: ActiveRydStatus;
  direction: RydDirection;
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
  eventName?: string; 
  messages?: RydMessage[];
}

export interface DisplayRydRequestData extends RydData {
  requesterProfile?: UserProfileData;
  passengerUserProfiles?: UserProfileData[];
}

export interface DisplayActiveRyd extends ActiveRyd {
  driverProfile?: UserProfileData;
  passengerProfiles?: (UserProfileData & { manifestStatus?: PassengerManifestStatus })[];
}

export interface DisplayRydData extends RydData, Partial<ActiveRyd> {
  isDriver: boolean;
  passengerProfiles?: UserProfileData[];
  driverProfile?: UserProfileData;
}


export interface DashboardRydData {
  id: string;
  rydFor: { name: string; relation: 'self' | 'student'; uid: string };
  isDriver: boolean;
  eventName: string;
  destination: string;
  rydStatus: ActiveRydStatus; 
  eventTimestamp: string; // Changed from Timestamp to string to be serializable
  earliestPickupTimestamp?: Timestamp; 
  proposedDepartureTimestamp?: Timestamp; 
  driverName?: string;
  driverId?: string;
  passengerCount?: { confirmed: number; pending: number; totalInManifest: number; };
  passengerStatus?: PassengerManifestStatus; 
  direction?: RydDirection;
}

export interface RydData {
    id: string;
    requestedBy: string;
    passengerIds: string[];
    eventId?: string;
    eventName?: string;
    direction: RydDirection;
    rydTimestamp: Timestamp;
    earliestPickupTimestamp?: Timestamp;
    pickupLocation: string;
    destination: string;
    notes?: string;
    status: RydStatus;
    driverId?: string;
    assignedActiveRydId?: string;
    createdAt: Timestamp;
    updatedAt?: Timestamp;
}

export interface ConversationListItem {
  rydId: string;
  rydName: string;
  lastMessage?: {
    text: string;
    timestamp: string;
    senderName: string;
  };
  otherParticipants: {
    name: string;
    avatarUrl?: string;
    dataAiHint?: string;
  }[];
  isUnread?: boolean; // For future use
}

export enum NotificationType {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
}

export interface NotificationData {
  id: string;
  userId: string; // The user who receives the notification
  title: string;
  message: string;
  type: NotificationType;
  createdAt: string;
  read: boolean;
  link?: string; // Optional link to navigate to, e.g., /rydz/tracking/some_ryd_id
}

export interface ScheduleItem {
  id: string;
  type: 'ryd' | 'event' | 'request';
  timestamp: string; // ISO string for serialization
  title: string;
  subtitle?: string;
  href: string;
}

// Added for route optimization types
export interface RouteWaypoint {
  id: string;
  address: string;
  position: { lat: number; lng: number };
  type: 'driver_start' | 'passenger_pickup' | 'event_destination';
  passengerId?: string;
  passengerName?: string;
  estimatedArrivalTime?: Date;
  estimatedDepartureTime?: Date;
  actualArrivalTime?: Date;
  actualDepartureTime?: Date;
}

export interface OptimizedRoute {
  waypoints: RouteWaypoint[];
  totalDistance: number; // in meters
  totalDuration: number; // in seconds
  optimizedOrder: number[]; // indices of original waypoints array
  polyline: string;
  bounds: google.maps.LatLngBounds;
}

export interface RouteOptimizationRequest {
  driverStartLocation: { address: string; position?: { lat: number; lng: number } };
  passengerPickups: Array<{
    id: string;
    address: string;
    position?: { lat: number; lng: number };
    passengerName: string;
  }>;
  eventDestination: { address: string; position?: { lat: number; lng: number } };
  departureTime: Date;
  bufferTimeMinutes?: number; // Time buffer for each pickup
}
