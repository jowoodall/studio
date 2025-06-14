
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
}

export function Logo({ className, iconOnly = false, ...props }: LogoProps) {
  const containerHeightClass = iconOnly ? "h-7" : "h-10"; // Tailwind classes for height (28px or 40px)
  const containerWidthClass = iconOnly ? "w-[70px]" : "w-[100px]"; // Tailwind classes for width (70px or 100px)

  return (
    <div
      className={cn(
        "relative flex items-center justify-center", // Added justify-center and relative
        containerHeightClass,
        containerWidthClass,
        className
      )}
      {...props}
    >
      <Image
        src="/logo.png" // Assumes public/logo.png.
        alt="MyRydz Logo"
        fill // Makes the image fill the parent div
        className={cn(
          "object-contain" // Ensures aspect ratio is maintained
        )}
        priority
      />
    </div>
  );
}
