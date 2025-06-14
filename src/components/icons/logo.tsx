
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
}

export function Logo({ className, iconOnly = false, ...props }: LogoProps) {
  // Increased sizes
  const containerHeightClass = iconOnly ? "h-8" : "h-12"; // Was h-7 : h-10. Now 32px : 48px
  const containerWidthClass = iconOnly ? "w-[80px]" : "w-[120px]"; // Was w-[70px] : w-[100px]

  return (
    <div
      className={cn(
        "relative flex items-center justify-center", 
        containerHeightClass,
        containerWidthClass,
        className
      )}
      {...props}
    >
      <Image
        src="/logo.png" 
        alt="MyRydz Logo"
        fill 
        className={cn(
          "object-contain" 
        )}
        priority
      />
    </div>
  );
}
