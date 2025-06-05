import { LoginForm } from "@/components/auth/login-form";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Login',
  description: 'Log in to your RydzConnect account.',
};

export default function LoginPage() {
  return (
    <>
      <div className="flex flex-col space-y-2 text-center mb-6">
        <h1 className="font-headline text-2xl font-semibold tracking-tight">
          Welcome Back!
        </h1>
        <p className="text-sm text-muted-foreground">
          Enter your credentials to access your account.
        </p>
      </div>
      <LoginForm />
    </>
  );
}
