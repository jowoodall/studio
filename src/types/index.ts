
import type React from 'react';
import type { Timestamp } from 'firebase/firestore'; // Added Timestamp

export enum UserRole {
  STUDENT = 'student',
  PARENT = 'parent',
  DRIVER = 'driver', // Though not explicitly used everywhere yet
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
  items?: NavItem[]; // For nested navigation
  collapsible?: boolean;
};

// Added UserProfileData interface here
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
  joinedGroupIds?: string[]; // Added for tracking groups a user is part of
  createdAt?: Timestamp;
}

export interface GroupData {
  id: string; // Firestore document ID
  name: string;
  description: string;
  imageUrl?: string;
  dataAiHint?: string;
  createdBy: string; // User UID
  createdAt: Timestamp;
  memberIds: string[]; // Array of User UIDs
  adminIds: string[]; // Array of User UIDs (subset of memberIds)
  // associatedEventIds?: string[]; // Optional: if groups link to events
}
