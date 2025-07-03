
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Forgot Password',
  description: 'Reset your MyRydz account password.',
};

export default function ForgotPasswordPage() {
  return (
    <>
      <div className="flex flex-col space-y-2 text-center mb-6">
        <h1 className="font-headline text-2xl font-semibold tracking-tight">
          Forgot Your Password?
        </h1>
        <p className="text-sm text-muted-foreground">
          No problem. Enter your email and we'll send you a reset link.
        </p>
      </div>
      <ForgotPasswordForm />
    </>
  );
}
