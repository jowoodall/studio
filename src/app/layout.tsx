
import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { siteConfig } from '@/config/site';

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  icons: {
    icon: '/logo.png', // Standard favicon
    apple: '/logo.png', // For Apple Touch Icon metadata
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        
        {/* Standard Favicon (also handled by metadata) */}
        <link rel="icon" href="/logo.png" sizes="any" />
        
        {/* Apple Touch Icon (iOS Home Screen Icon) */}
        {/* This direct link is often the most reliable. Ensure logo.png is in /public */}
        {/* For best results, use a square PNG, ideally 180x180 pixels. */}
        <link rel="apple-touch-icon" href="/logo.png" />
      </head>
      <body className="font-body antialiased min-h-screen bg-background text-foreground" suppressHydrationWarning={true}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
