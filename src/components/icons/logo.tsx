
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
}

export function Logo({ className, iconOnly = false, ...props }: LogoProps) {
  const size = iconOnly ? 28 : 40; // h-7 vs h-10 approx

  return (
    <div className={cn("flex items-center gap-2", className)} {...props}>
      <Image
        src="/logo.png" // Assumes the logo is in public/logo.png
        alt="MyRydz Logo"
        width={size * 2.5} // Assuming the logo content is wider than it is tall, adjust as needed
        height={size}
        className="object-contain" // Ensures the logo scales nicely within the dimensions
        priority // Preload logo as it's likely LCP
      />
      {/* The text "MyRydz" is part of the image, so no separate span is needed. */}
      {/* If iconOnly was meant to show a version *without* the text, a different image asset would be ideal. */}
      {/* For now, iconOnly just makes the whole logo smaller. */}
    </div>
  );
}
