import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ title = 'Something went wrong', message, onRetry }: ErrorStateProps) {
  return (
    <div className="bg-red-900/30 border border-red-700/40 rounded-lg p-4 text-center">
      <AlertTriangle className="w-5 h-5 text-red-400 mx-auto mb-2" />
      <p className="text-sm text-red-300 font-medium mb-1">{title}</p>
      {message && <p className="text-xs text-text-muted mb-2">{message}</p>}
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 mt-1 px-3 py-1.5 bg-red-900/40 hover:bg-red-900/60 border border-red-700/40 rounded-lg text-xs text-red-300 font-medium transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          Retry
        </button>
      )}
    </div>
  );
}
