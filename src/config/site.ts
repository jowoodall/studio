
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
} from 'lucide-react';
import type { NavItem } from '@/types';

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
    title: 'Find Carpool',
    href: '/find-carpool',
    icon: Search,
    label: 'AI Powered',
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
    title: 'Parental Controls',
    href: '/parent/approvals', // Example specific to parents
    icon: ShieldCheck,
    roles: ['parent'], // Example role-based visibility
  },
  {
    title: 'Driver Portal',
    href: '/driver/dashboard', // Example specific to drivers
    icon: DollarSign, // Using DollarSign as a placeholder for driver earnings/management
    roles: ['driver'],
    collapsible: true,
    items: [
        { title: 'My Schedule', href: '/driver/schedule', icon: CalendarDays },
        { title: 'Ratings', href: '/driver/ratings', icon: Users }, // Placeholder for ratings
    ]
  },
  {
    title: 'Map View',
    href: '/map',
    icon: MapPin,
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
  }
];

export const userAccountMenu: NavItem[] = [
  {
    title: 'Profile',
    href: '/profile',
    icon: UserCircle,
  },
  {
    title: 'My Students',
    href: '/parent/my-students',
    icon: ClipboardList, 
    roles: ['parent'], 
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

