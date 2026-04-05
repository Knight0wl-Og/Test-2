import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { TopMovers } from './pages/TopMovers';
import { Scanner } from './pages/Scanner';
import { Research } from './pages/Research';
import { Options } from './pages/Options';
import { AICopilot } from './pages/AICopilot';
import { Alerts } from './pages/Alerts';
import { Portfolio } from './pages/Portfolio';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/top10" element={<TopMovers />} />
            <Route path="/scanner" element={<Scanner />} />
            <Route path="/research" element={<Research />} />
            <Route path="/options" element={<Options />} />
            <Route path="/copilot" element={<AICopilot />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/portfolio" element={<Portfolio />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
