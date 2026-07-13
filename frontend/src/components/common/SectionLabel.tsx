import type { ReactNode } from 'react';
import clsx from 'clsx';

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={clsx('section-label mb-2', className)}>{children}</h2>;
}
