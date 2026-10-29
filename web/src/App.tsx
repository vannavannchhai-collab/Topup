import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AdminPage } from './pages/Admin';
import { AssistantPage } from './pages/Assistant';
import { AuthPage } from './pages/Auth';
import { HelpPage } from './pages/Help';
import { HomePage } from './pages/Home';
import { OrdersPage } from './pages/Orders';
import { ShopPage } from './pages/Shop';
import { WalletPage } from './pages/Wallet';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/shop" element={<ShopPage />} />
        <Route path="/assistant" element={<AssistantPage />} />
        <Route path="/wallet" element={<WalletPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/help" element={<HelpPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route
          path="*"
          element={
            <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
              <p className="font-display text-6xl font-bold text-white/10">404</p>
              <p className="mt-2 text-sm text-white/50">This page drifted out of orbit.</p>
              <a href="/" className="mt-4 rounded-xl bg-white/10 px-4 py-2 text-xs text-white transition hover:bg-white/20">
                Back to NOVA
              </a>
            </div>
          }
        />
      </Routes>
    </Layout>
  );
}
