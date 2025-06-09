
import { GitFork } from 'lucide-react'; // Using GitFork as a placeholder visual

interface LogoProps extends React.SVGProps<SVGSVGElement> {
  iconOnly?: boolean;
}

export function Logo({ className, iconOnly = false, ...props }: LogoProps) {
  return (
    <div className="flex items-center gap-2">
      <GitFork className={cn("h-6 w-6 text-primary", className)} {...props} />
      {!iconOnly && (
        <span className="font-headline text-xl font-semibold text-primary">
          MyRydz
        </span>
      )}
    </div>
  );
}

// Helper for cn if not globally available or for isolation
const cn = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(' ');
