import express from 'express';
import cors from 'cors';
import { config } from './config';
import { db } from './db/client';
import quotesRouter from './routes/quotes';
import watchlistRouter from './routes/watchlist';
import marketRouter from './routes/market';

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/quotes', quotesRouter);
app.use('/api/watchlists', watchlistRouter);
app.use('/api/market', marketRouter);

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(config.port, () => {
  console.log(`TradeEdge backend running on port ${config.port} [${config.nodeEnv}]`);
  console.log('Price data: Yahoo Finance (live) with realistic mock fallback when offline.');
});

// Test DB connection (non-fatal)
db.query('SELECT 1').then(() => {
  console.log('PostgreSQL connected successfully.');
}).catch((err: Error) => {
  console.warn('PostgreSQL not available:', err.message, '— watchlist features will be unavailable.');
});

export default app;
