import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  message?: string;
}

export function EmptyState({ icon: Icon = Inbox, title, message }: EmptyStateProps) {
  return (
    <div className="bg-bg-card border border-border-dim rounded-lg p-6 text-center">
      <Icon className="w-6 h-6 text-text-muted mx-auto mb-2" />
      <p className="text-sm text-white font-medium mb-1">{title}</p>
      {message && <p className="text-xs text-text-muted">{message}</p>}
    </div>
  );
}
