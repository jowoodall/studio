
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
}

export function Logo({ className, iconOnly = false, size, ...props }: LogoProps) {
  const containerHeightClass = size ? `h-[${size}px]` : (iconOnly ? "h-8" : "h-12");
  const containerWidthClass = size ? `w-[${size}px]` : (iconOnly ? "w-[80px]" : "w-[120px]");


  return (
    <div
      className={cn(
        "relative flex items-center justify-center",
        className
      )}
      style={{
        height: size ? `${size}px` : (iconOnly ? '32px' : '48px'),
        width: size ? `${size}px` : (iconOnly ? '80px' : '120px'),
      }}
      {...props}
    >
      <Image
        src={`/logo.png?v=${Date.now()}`}
        alt="MyRydz Logo"
        fill
        sizes={size ? `${size}px` : "120px"}
        className={cn(
          "object-contain"
        )}
        priority
      />
    </div>
  );
}
