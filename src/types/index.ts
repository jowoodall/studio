
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
  id: string; // Firestore document ID
  name: string;
  eventTimestamp: Timestamp; // Combined date and time
  location: string;
  description?: string;
  eventType: string; // e.g., 'school', 'sports'
  createdBy: string; // User UID of the event creator
  createdAt: Timestamp; // Firestore server timestamp
  associatedGroupIds: string[]; // Array of Group UIDs
}

export type EventDriverStatus = "driving" | "not_driving" | "pending_response" | "full_car";

export interface EventDriverStateData {
  id: string; // Composite key: `${eventId}_${driverId}`
  eventId: string;
  driverId: string;
  status: EventDriverStatus;
  seatsAvailable?: number; // Relevant if status is 'driving'
  updatedAt: Timestamp;
}
