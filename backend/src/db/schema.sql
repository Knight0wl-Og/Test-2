CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS watchlist_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  color VARCHAR(20) DEFAULT '#3b82f6',
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS watchlist_symbols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES watchlist_groups(id) ON DELETE CASCADE,
  symbol VARCHAR(20) NOT NULL,
  position INTEGER DEFAULT 0,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, symbol)
);

CREATE TABLE IF NOT EXISTS user_preferences (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default watchlist groups
INSERT INTO watchlist_groups (name, color, position) VALUES
  ('Indices', '#6366f1', 0),
  ('AI Plays', '#8b5cf6', 1),
  ('Dividend Kings', '#22c55e', 2),
  ('Earnings This Week', '#f59e0b', 3),
  ('Prof G · Investing Simplified', '#f97316', 4),
  ('Minority Mindset', '#10b981', 5)
ON CONFLICT (name) DO NOTHING;

-- Seed some default symbols
INSERT INTO watchlist_symbols (group_id, symbol, position)
SELECT id, unnest(ARRAY['SPY', 'QQQ', 'DIA', 'IWM', 'VIX']), generate_series(0, 4)
FROM watchlist_groups WHERE name = 'Indices'
ON CONFLICT (group_id, symbol) DO NOTHING;

INSERT INTO watchlist_symbols (group_id, symbol, position)
SELECT id, unnest(ARRAY['NVDA', 'MSFT', 'GOOGL', 'META', 'PLTR']), generate_series(0, 4)
FROM watchlist_groups WHERE name = 'AI Plays'
ON CONFLICT (group_id, symbol) DO NOTHING;

INSERT INTO watchlist_symbols (group_id, symbol, position)
SELECT id, unnest(ARRAY['VOO', 'SCHD', 'JEPI', 'VYM', 'O', 'VTI']), generate_series(0, 5)
FROM watchlist_groups WHERE name = 'Prof G · Investing Simplified'
ON CONFLICT (group_id, symbol) DO NOTHING;

INSERT INTO watchlist_symbols (group_id, symbol, position)
SELECT id, unnest(ARRAY['VOO', 'VTI', 'VNQ', 'SCHD', 'BRK.B', 'MSFT']), generate_series(0, 5)
FROM watchlist_groups WHERE name = 'Minority Mindset'
ON CONFLICT (group_id, symbol) DO NOTHING;
