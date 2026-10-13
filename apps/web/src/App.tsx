import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Toaster } from 'react-hot-toast'
import RequireAuth from './components/RequireAuth'
import AppShell from './components/AppShell'

// Auth pages
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import VerifyEmailPage from './pages/VerifyEmailPage'

// App pages
import DashboardPage from './pages/DashboardPage'
import BotsPage from './pages/BotsPage'
import BotDetailPage from './pages/BotDetailPage'
import BotConfigPage from './pages/BotConfigPage'
import CreateBotPage from './pages/wizard/CreateBotPage'
import SettingsPage from './pages/SettingsPage'
import BillingPage from './pages/BillingPage'
import IntegrationsPage from './pages/IntegrationsPage'
import DocsPage from './pages/DocsPage'
import SupportPage from './pages/SupportPage'
import WorkspaceSettingsPage from './pages/WorkspaceSettingsPage'

// Public
import HomePage from './pages/public/HomePage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/" element={<HomePage />} />

          {/* Auth */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />

          {/* Protected */}
          <Route element={<RequireAuth />}>
            <Route element={<AppShell />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/bots" element={<BotsPage />} />
              <Route path="/bots/new" element={<CreateBotPage />} />
              <Route path="/bots/:botId" element={<BotDetailPage />} />
              <Route path="/bots/:botId/config" element={<BotConfigPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/workspace" element={<WorkspaceSettingsPage />} />
              <Route path="/billing" element={<BillingPage />} />
              <Route path="/integrations" element={<IntegrationsPage />} />
              <Route path="/docs" element={<DocsPage />} />
              <Route path="/support" element={<SupportPage />} />
            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>

      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'var(--bg-raised)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
          },
          success: { iconTheme: { primary: 'var(--success)', secondary: 'var(--bg-raised)' } },
          error:   { iconTheme: { primary: 'var(--error)',   secondary: 'var(--bg-raised)' } },
        }}
      />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
