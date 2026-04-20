import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProLayout } from './components/layout/ProLayout';
import { ChartWorkspace } from './components/chart/ChartWorkspace';
import { NewsPanel } from './components/news/NewsPanel';
import { SymbolBar } from './components/layout/SymbolBar';

// Pages
import { Dashboard } from './pages/Dashboard';
import { ChartPage } from './pages/ChartPage';
import { WatchlistPage } from './pages/WatchlistPage';
import { NewsPage } from './pages/NewsPage';
import { MorePage } from './pages/MorePage';
import { TopMovers } from './pages/TopMovers';
import { Scanner } from './pages/Scanner';
import { Research } from './pages/Research';
import { Options } from './pages/Options';
import { AICopilot } from './pages/AICopilot';
import { Alerts } from './pages/Alerts';
import { Portfolio } from './pages/Portfolio';
import { Earnings } from './pages/Earnings';
import { EarningsPredictor } from './pages/EarningsPredictor';
import { EarningsVisualizer } from './pages/EarningsVisualizer';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

/**
 * Desktop chart workspace — wraps ChartWorkspace + NewsPanel in the full layout.
 * On mobile this route is inaccessible (BottomNav's Chart tab goes to /chart instead).
 */
function DesktopChartView() {
  return (
    <div className="flex flex-col h-full min-h-0">
      <ChartWorkspace className="flex-1 min-h-0" />
      <NewsPanel />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ProLayout isChartView>
          <Routes>
            {/* Desktop chart workspace + mobile chart page on same root route */}
            <Route path="/" element={
              <>
                {/* Desktop: chart workspace (lg:block) */}
                <div className="hidden lg:flex flex-col h-full">
                  <DesktopChartView />
                </div>
                {/* Mobile: full-screen chart page (lg:hidden) */}
                <div className="flex lg:hidden flex-col h-full">
                  <ChartPage />
                </div>
              </>
            } />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/chart" element={<ChartPage />} />
            <Route path="/watchlist" element={<WatchlistPage />} />
            <Route path="/news" element={<NewsPage />} />
            <Route path="/more" element={<MorePage />} />
            <Route path="/top10" element={<TopMovers />} />
            <Route path="/scanner" element={<Scanner />} />
            <Route path="/research" element={<Research />} />
            <Route path="/options" element={<Options />} />
            <Route path="/copilot" element={<AICopilot />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/earnings" element={<Earnings />} />
            <Route path="/earnings-predictor" element={<EarningsPredictor />} />
            <Route path="/earnings-visualizer" element={<EarningsVisualizer />} />
          </Routes>
        </ProLayout>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
