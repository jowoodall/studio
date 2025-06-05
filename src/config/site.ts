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
  MessageSquare
} from 'lucide-react';
import type { NavItem } from '@/types';

export const siteConfig = {
  name: 'RydzConnect',
  description: 'Connecting communities for shared rides. Simplify your carpooling needs with RydzConnect.',
  url: 'https://rydzconnect.example.com',
  ogImage: 'https://rydzconnect.example.com/og.png',
  links: {
    github: 'https://github.com/your-repo/rydzconnect', // Replace with actual repo
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
    title: 'My Rides',
    icon: Car,
    href: '/rides', // A general rides page, could be a parent item
    collapsible: true,
    items: [
      { title: 'Request Ride', href: '/rides/request', icon: Car },
      { title: 'Upcoming Rides', href: '/rides/upcoming', icon: CalendarDays },
      { title: 'Ride History', href: '/rides/history', icon: Users }, // Re-using icon, can be more specific
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
    title: 'Settings',
    href: '/settings',
    icon: Settings,
  },
  {
    title: 'Log Out',
    href: '/logout', // This would typically trigger a logout action
    icon: LogOut,
  },
];
