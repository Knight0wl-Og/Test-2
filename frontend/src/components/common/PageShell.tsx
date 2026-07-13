import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';

interface PageShellProps {
  icon?: LucideIcon;
  /** Tailwind color classes for the icon chip, e.g. 'text-gold bg-gold/10' — matches features.ts colors */
  iconColor?: string;
  title: string;
  subtitle?: string;
  /** Right-aligned header slot for buttons/tabs */
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/**
 * Standard page wrapper: consistent padding, background, and header row
 * (icon chip + title + subtitle + right-aligned actions) across all pages.
 */
export function PageShell({
  icon: Icon,
  iconColor = 'text-accent bg-accent/10',
  title,
  subtitle,
  actions,
  className,
  children,
}: PageShellProps) {
  return (
    <div className={clsx('p-4 bg-bg-primary min-h-full', className)}>
      <div className="flex items-center gap-2.5 mb-4">
        {Icon && (
          <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', iconColor)}>
            <Icon className="w-4 h-4" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-base font-bold text-white leading-tight">{title}</h1>
          {subtitle && <p className="text-[11px] text-text-muted leading-snug">{subtitle}</p>}
        </div>
        {actions && <div className="ml-auto flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
