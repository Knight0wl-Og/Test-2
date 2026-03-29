import express from 'express';
import cors from 'cors';
import { config } from './config';
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
});

export default app;
