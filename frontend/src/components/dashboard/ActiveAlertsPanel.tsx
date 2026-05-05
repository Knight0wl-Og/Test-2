import { Bell, BellOff } from 'lucide-react';
import { useWatchlistStore } from '../../store/watchlistStore';
import { useNavigate } from 'react-router-dom';

// Pull triggered alerts from alertsService localStorage format
interface StoredAlert {
  id: string;
  symbol: string;
  condition: 'above' | 'below';
  price: number;
  triggered?: boolean;
  triggeredAt?: string;
}

function loadTriggered(): StoredAlert[] {
  try {
    const raw = localStorage.getItem('tradeedge_alerts');
    if (!raw) return [];
    const all: StoredAlert[] = JSON.parse(raw);
    return all.filter((a) => a.triggered);
  } catch {
    return [];
  }
}

export function ActiveAlertsPanel() {
  const navigate = useNavigate();
  const selectSymbol = useWatchlistStore((s) => s.selectSymbol);
  const triggered = loadTriggered();

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Bell className="w-3 h-3 text-amber-400" />
          <span className="text-[10px] font-bold tracking-widest text-gray-400">ACTIVE ALERTS</span>
        </div>
        {triggered.length > 0 && (
          <span className="text-[9px] bg-amber-400/20 text-amber-400 px-1.5 py-0.5 rounded-full font-semibold">
            {triggered.length}
          </span>
        )}
      </div>

      {triggered.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-1.5 text-center">
          <BellOff className="w-5 h-5 text-gray-600" />
          <p className="text-[11px] text-gray-600">No triggered alerts</p>
          <button
            onClick={() => navigate('/alerts')}
            className="text-[10px] text-accent hover:text-white transition-colors mt-1"
          >
            Manage alerts →
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-1.5 min-h-0">
          {triggered.map((a) => (
            <button
              key={a.id}
              onClick={() => { selectSymbol(a.symbol); navigate('/'); }}
              className="w-full flex items-center justify-between bg-amber-400/5 border border-amber-400/20 rounded-lg px-2.5 py-2 hover:bg-amber-400/10 transition-colors text-left"
            >
              <div>
                <p className="text-xs font-semibold text-white">{a.symbol}</p>
                <p className="text-[10px] text-gray-400">
                  {a.condition === 'above' ? '▲ Above' : '▼ Below'} ${a.price.toFixed(2)}
                </p>
              </div>
              <span className="text-[9px] text-amber-400 font-semibold">TRIGGERED</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
