
'use client';

import { Logo } from "@/components/icons/logo";
import Link from "next/link";
import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

  const layoutContent = (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-primary/10 via-background to-background p-4">
      <div className="mb-8">
        <Link href="/">
          <Logo size={120} />
        </Link>
      </div>
      <div className="w-full max-w-md bg-card p-8 rounded-xl shadow-2xl">
        {children}
      </div>
       <p className="mt-8 text-center text-sm text-muted-foreground">
          <Link href="/" className="hover:text-primary underline underline-offset-4">
            Back to homepage
          </Link>
        </p>
    </div>
  );

  if (!recaptchaSiteKey || recaptchaSiteKey === "YOUR_RECAPTCHA_SITE_KEY_HERE") {
    console.warn("reCAPTCHA Site Key is not configured. The security check on the signup form will be disabled.");
    return layoutContent;
  }

  return (
    <GoogleReCaptchaProvider reCaptchaKey={recaptchaSiteKey}>
      {layoutContent}
    </GoogleReCaptchaProvider>
  );
}
