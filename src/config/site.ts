
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Car,
  ShieldCheck,
  Search,
  Bell,
  UserCircle,
  Settings,
  LogOut,
  GitFork,
  MapPin,
  DollarSign,
  MessageSquare,
  ClipboardList, 
  Home, // Added for My Locations
  Terminal, // Added for Test Logging
  UserCog, // For Manage Drivers
} from 'lucide-react';
import type { NavItem } from '@/types';
import { UserRole } from '@/types';

export const siteConfig = {
  name: 'MyRydz',
  description: 'Connecting communities for shared rydz. Simplify your carpooling needs with MyRydz.',
  url: 'https://myrydz.example.com',
  ogImage: 'https://myrydz.example.com/og.png',
  links: {
    github: 'https://github.com/your-repo/myrydz', // Replace with actual repo
  },
};

export const defaultUserRole = 'student'; // This would typically come from auth context

export const navMenuItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'My Rydz',
    icon: Car,
    href: '/rydz', // A general rydz page, could be a parent item
    collapsible: true,
    items: [
      { title: 'Request Ryd', href: '/rydz/request', icon: Car },
      { title: 'Upcoming Rydz', href: '/rydz/upcoming', icon: CalendarDays },
      { title: 'Ryd History', href: '/rydz/history', icon: Users }, // Re-using icon, can be more specific
    ],
  },
  {
    title: 'Groups',
    href: '/groups',
    icon: Users,
  },
  {
    title: 'Events',
    href: '/events',
    icon: CalendarDays,
  },
  {
    title: 'Driver Portal',
    href: '/driver/dashboard', // Example specific to drivers
    icon: DollarSign, // Using DollarSign as a placeholder for driver earnings/management
    roles: [UserRole.DRIVER],
    collapsible: true,
    items: [
        { title: 'My Schedule', href: '/driver/schedule', icon: CalendarDays },
        { title: 'Ratings', href: '/driver/ratings', icon: Users }, // Placeholder for ratings
    ]
  },
  {
    title: 'Notifications',
    href: '/notifications',
    icon: Bell,
  },
  {
    title: 'Messages',
    href: '/messages',
    icon: MessageSquare,
  },
  {
    title: 'Parental Controls',
    href: '/parent/approvals', // Example specific to parents
    icon: ShieldCheck,
    roles: [UserRole.PARENT], // Example role-based visibility
  },
  {
    title: 'Utilities',
    href: '/test-logging',
    icon: Terminal,
    allowedEmails: ['joey.woodall@gmail.com'],
  }
];

export const userAccountMenu: NavItem[] = [
  {
    title: 'Profile',
    href: '/profile',
    icon: UserCircle,
  },
  {
    title: 'My Family',
    href: '/family',
    icon: ClipboardList, 
    roles: [UserRole.PARENT, UserRole.STUDENT], 
  },
  {
    title: 'Driver Approvals',
    href: '/parent/approvals',
    icon: ShieldCheck,
    roles: [UserRole.PARENT],
  },
  {
    title: 'My Locations',
    href: '/profile/locations',
    icon: Home, // Using Home icon for locations, MapPin is also a good choice
  },
  {
    title: 'Settings',
    href: '/settings',
    icon: Settings,
  },
  {
    title: 'Log Out',
    href: '/', // Redirect to homepage after logout action
    icon: LogOut,
  },
];
