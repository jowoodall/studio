
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/icons/logo';
import Image from 'next/image';
import { ArrowRight, Users, ShieldCheck, MapPin } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex justify-between items-center">
          <Logo />
          <nav className="space-x-4">
            <Button variant="ghost" asChild>
              <Link href="/login">Log In</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Sign Up</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-grow">
        {/* Hero Section */}
        <section className="py-16 md:py-24 bg-gradient-to-br from-primary/10 via-background to-background">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="font-headline text-4xl sm:text-5xl md:text-6xl font-bold text-primary mb-6">
              Connect, Commute, Simplify with RydzConnect
            </h1>
            <p className="text-lg sm:text-xl text-foreground/80 max-w-2xl mx-auto mb-8">
              RydzConnect makes carpooling for school, events, and daily commutes easier and safer than ever. Join our community today!
            </p>
            <div className="space-x-4">
              <Button size="lg" asChild className="font-semibold">
                <Link href="/signup">
                  Get Started <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="font-semibold">
                <Link href="#features">Learn More</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Placeholder for Image/Illustration */}
        <section className="py-12">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="relative aspect-video max-w-4xl mx-auto rounded-xl overflow-hidden shadow-2xl">
              <Image
                src="https://placehold.co/1200x675.png"
                alt="RydzConnect in action"
                fill
                className="object-cover"
                data-ai-hint="community carpooling app"
              />
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-16 md:py-24">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="font-headline text-3xl sm:text-4xl font-bold text-center text-primary mb-12">
              Why RydzConnect?
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="flex flex-col items-center text-center p-6 bg-card rounded-lg shadow-lg">
                <div className="p-4 bg-primary/10 rounded-full mb-4">
                  <Users className="h-10 w-10 text-primary" />
                </div>
                <h3 className="font-headline text-xl font-semibold mb-2">Smart Carpool Matching</h3>
                <p className="text-foreground/70">
                  Our AI-powered system suggests the best carpool options based on location, time, and traffic.
                </p>
              </div>
              <div className="flex flex-col items-center text-center p-6 bg-card rounded-lg shadow-lg">
                <div className="p-4 bg-primary/10 rounded-full mb-4">
                  <ShieldCheck className="h-10 w-10 text-primary" />
                </div>
                <h3 className="font-headline text-xl font-semibold mb-2">Safety First</h3>
                <p className="text-foreground/70">
                  Features like driver ratings and parent approvals ensure peace of mind for everyone.
                </p>
              </div>
              <div className="flex flex-col items-center text-center p-6 bg-card rounded-lg shadow-lg">
                <div className="p-4 bg-primary/10 rounded-full mb-4">
                  <MapPin className="h-10 w-10 text-primary" />
                </div>
                <h3 className="font-headline text-xl font-semibold mb-2">Real-Time Tracking</h3>
                <p className="text-foreground/70">
                  Stay updated with live ryd tracking and notifications for a seamless experience.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-8 border-t">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center text-foreground/60">
          &copy; {new Date().getFullYear()} RydzConnect. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
