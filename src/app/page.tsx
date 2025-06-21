import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Logo } from '@/components/icons/logo';
import { ArrowRight, Car, Users, MapPin } from 'lucide-react';

export default function LandingPage() {
  const features = [
    {
      icon: Car,
      title: 'Effortless Rydz',
      description: 'Request or offer rydz for school, sports, and community events with just a few clicks.',
    },
    {
      icon: Users,
      title: 'Trusted Groups',
      description: 'Create and join private carpool groups with parents and students you know and trust.',
    },
    {
      icon: MapPin,
      title: 'Real-Time Tracking',
      description: 'Gain peace of mind with live map tracking for all active rydz.',
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="container mx-auto flex h-20 items-center justify-between px-4 md:px-6">
        <Logo />
        <nav className="flex items-center gap-4">
          <Button variant="ghost" asChild>
            <Link href="/login">Log In</Link>
          </Button>
          <Button asChild>
            <Link href="/signup">
              Sign Up <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </nav>
      </header>
      <main className="flex-1">
        <section className="container mx-auto flex flex-col items-center justify-center space-y-6 px-4 py-20 text-center md:px-6 md:py-32">
          <h1 className="font-headline text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl text-primary">
            Smarter, Safer School Carpooling
          </h1>
          <p className="max-w-[700px] text-lg text-muted-foreground md:text-xl">
            RydzConnect simplifies coordinating rydz for your kids' events. Connect with trusted groups, manage schedules, and ensure everyone gets where they need to go, safely.
          </p>
          <Button size="lg" asChild>
            <Link href="/dashboard">
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </section>

        <section className="bg-muted/50 py-16">
          <div className="container mx-auto px-4 md:px-6">
            <h2 className="mb-12 text-center font-headline text-3xl font-bold">
              How It Works
            </h2>
            <div className="grid gap-8 md:grid-cols-3">
              {features.map((feature, index) => (
                <div key={index} className="flex flex-col items-center text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <feature.icon className="h-8 w-8" />
                  </div>
                  <h3 className="mb-2 text-xl font-bold">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="container mx-auto border-t py-6 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} RydzConnect. All rights reserved.</p>
      </footer>
    </div>
  );
}
