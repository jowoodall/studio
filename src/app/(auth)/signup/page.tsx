
import { SignupForm } from "@/components/auth/signup-form";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign Up',
  description: 'Create a new MyRydz account.',
};

export default function SignupPage() {
  return (
    <>
      <div className="flex flex-col space-y-2 text-center mb-6">
        <h1 className="font-headline text-2xl font-semibold tracking-tight">
          Join MyRydz
        </h1>
        <p className="text-sm text-muted-foreground">
          Create an account to start connecting and commuting.
        </p>
      </div>
      <SignupForm />
    </>
  );
}
