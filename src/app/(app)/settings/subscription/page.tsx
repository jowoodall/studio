
"use client";

import React from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Star, Building2, ArrowLeft } from "lucide-react";
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

const plans = [
  {
    name: 'Free',
    price: '$0',
    frequency: '/ month',
    description: 'Perfect for getting started and coordinating with a small group.',
    features: [
      'Unlimited events and carpools',
      'Basic driver approval system',
      'Driver ratings',
      'Standard event management',
    ],
    isCurrent: true,
  },
  {
    name: 'Premium',
    price: '$3',
    frequency: '/ month',
    description: 'Unlock advanced features for the ultimate coordination experience.',
    features: [
      'All Free features, plus:',
      'Route optimization',
      'Real-time ride tracking',
      'Calendar integration (Google/Outlook)',
      'Driving reports',
      'Up to 5 family members',
    ],
    isCurrent: false,
    isPopular: true,
  },
  {
    name: 'Organization',
    price: '$10+',
    frequency: '/ family / year',
    description: 'For schools, sports clubs, and other large groups.',
    features: [
      'All Premium features for all families',
      'Custom integration support',
      'Centralized billing & management',
      'Priority support & analytics',
    ],
    isCurrent: false,
  },
];

export default function SubscriptionPage() {
    const { userProfile } = useAuth();
    // In a real app, you would determine the user's current plan dynamically
    const currentPlanName = 'Free'; 

    return (
        <>
            <PageHeader
                title="Subscription & Billing"
                description="Manage your plan to get the most out of MyRydz."
                actions={
                  <Button variant="outline" asChild>
                    <Link href="/settings">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Settings
                    </Link>
                  </Button>
                }
            />

            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                {plans.map((plan) => {
                    const isCurrent = plan.name === currentPlanName;
                    return (
                        <Card key={plan.name} className={cn("flex flex-col shadow-xl", isCurrent && "border-2 border-primary", plan.isPopular && "relative")}>
                            {plan.isPopular && (
                                <div className="absolute top-0 -translate-y-1/2 w-full flex justify-center">
                                    <div className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                                        Most Popular
                                    </div>
                                </div>
                            )}
                            <CardHeader className="pt-8">
                                <CardTitle className="font-headline text-xl">{plan.name}</CardTitle>
                                <div className="flex items-baseline">
                                    <span className="text-4xl font-bold">{plan.price}</span>
                                    <span className="text-muted-foreground ml-1">{plan.frequency}</span>
                                </div>
                                <CardDescription>{plan.description}</CardDescription>
                            </CardHeader>
                            <CardContent className="flex-grow">
                                <ul className="space-y-3 text-sm">
                                    {plan.features.map((feature) => (
                                        <li key={feature} className="flex items-start">
                                            <CheckCircle2 className="h-4 w-4 text-green-500 mr-2 mt-0.5 shrink-0" />
                                            <span>{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                            <CardContent>
                                <Button className="w-full" disabled={isCurrent}>
                                    {isCurrent ? "Current Plan" : "Upgrade"}
                                </Button>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
             <p className="text-xs text-muted-foreground text-center mt-8">
                Payments are securely processed by Stripe. We do not store your credit card information.
            </p>
        </>
    );
}
