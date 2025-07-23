
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
}

export function Logo({ className, iconOnly = false, ...props }: LogoProps) {
  const containerHeightClass = iconOnly ? "h-8" : "h-12";
  const containerWidthClass = iconOnly ? "w-[80px]" : "w-[120px]";

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
        sizes="256px"
        className={cn(
          "object-contain"
        )}
        priority
      />
    </div>
  );
}
