
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
}

export function Logo({ className, iconOnly = false, ...props }: LogoProps) {
  // Increased sizes
  const containerHeightClass = iconOnly ? "h-8" : "h-12"; // 32px : 48px
  const containerWidthClass = iconOnly ? "w-[80px]" : "w-[120px]"; // 80px : 120px

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
        src={`/logo.png?v=${Date.now()}`} 
        alt="MyRydz Logo"
        fill 
        sizes="120px" // Updated sizes prop based on max CSS width of container
        className={cn(
          "object-contain" 
        )}
        priority
      />
    </div>
  );
}
