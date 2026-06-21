import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink as RouterNavLink, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Activity, AlertTriangle, Bell, Calendar, CheckCircle2, ChevronRight, Compass, CreditCard, Download, FileText, Home, ListOrdered, Lock, LogOut, Mail, Menu, Moon, Save, Send, Server, Settings, Sparkles, Sun, TestTube2, Upload, Users, Wand2, X } from 'lucide-react';
import {
  ActivityTimeline,
  Avatar,
  BarChartMini,
  Breadcrumb,
  Button,
  DonutChart,
  EmptyState,
  Modal,
  PageHeader,
  SearchInput,
  Skeleton,
  SkeletonCard,
  SkeletonList,
  Sparkline,
  Tabs,
  TimelineEvent,
  ToastProvider,
  useToast,
} from './components/ui';
import { CommandPalette, CommandTrigger } from './components/CommandPalette';
import { MarkdownEditor, SnippetItem, CompletionSignal } from './components/MarkdownEditor';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

type User = { id: string; email: string; name: string; role: 'admin' | 'coordinator' | 'owner' | 'viewer'; mfaEnabled: boolean };
type Section = { id: string; sectionKey: string; title: string; isoClause: string; order: number; contentMarkdown: string; status: string };
type Plan = {
  id: string;
  title: string;
  serviceName: string;
  serviceOwner: string;
  criticality: string;
  rtoMinutes: number;
  rpoMinutes: number;
  status: 'draft' | 'in_review' | 'approved' | 'retired';
  version: number;
  sections?: Section[];
};

type ServiceAsset = { id: string; serviceName: string; assetName: string; assetType: string; owner: string; criticality: string; recoveryPriority: number; dependencies: string[]; notes: string };
type ServiceRisk = { id: string; serviceName: string; riskTitle: string; category: string; probability: number; impact: number; riskScore: number; mitigation: string; owner: string; status: string };
type RecoveryDrill = { id: string; serviceName: string; drillTitle: string; scheduledAt: string; scope: string; owner: string; status: string; resultSummary: string };
type ResilienceSummary = { totalAssets: number; criticalAssets: number; priorityRecoveryAssets: number; openRisks: number; highRisks: number; plannedDrills: number; completedDrills: number };
type BiaEntry = { id: string; serviceName: string; processName: string; owner: string; impact1h: number; impact4h: number; impact24h: number; financialImpact: number; reputationalImpact: number; regulatoryImpact: number; maxImpactScore: number; criticalityTier: string; currentRtoMinutes: number; currentRpoMinutes: number; dependencyNotes: string; workaround: string };
type BiaSummary = { totalBia: number; tier1: number; tier2: number; fastestRtoMinutes: number | null; fastestRpoMinutes: number | null };
type PlanComment = { id: string; sectionKey: string; body: string; status: 'open' | 'resolved'; parentCommentId?: string | null; mentionedEmails?: string[]; createdAt: string };
type PlanVersion = { id: string; version: number; changeSummary: string; createdAt: string };
type ManagedUser = { id: string; email: string; name: string; role: User['role']; disabled: boolean; mfaEnabled: boolean; createdAt: string };
type NotificationItem = { id: string; title: string; body: string; type: string; status: 'unread' | 'read'; createdAt: string };
type MonitoringSummary = { status: string; timestamp: string; counters: { plans: number; users: number; risks: number; drills: number; notifications: number }; system: { uptimeSeconds: number; memoryUsageMB: number } };
type BillingSummary = { subscription: { planCode: string; status: string; seatsLimit: number; plansLimit: number; aiRequestsLimit: number; currentPeriodEnd: string }; usage: Record<string, number> };
type EmailOutboxItem = { id: string; toEmail: string; subject: string; bodyText: string; emailType: string; status: 'queued' | 'sent' | 'failed' | 'cancelled'; lastError?: string | null; queuedAt: string };
type EmailProcessingPlan = { mode: 'manual_required' | 'smtp_ready'; canAutoSend: boolean; detail: string };
type BiaDrpAlignment = { summary: { total: number; aligned: number; missingDrp: number; rtoGaps: number; rpoGaps: number }; items: Array<{ biaId: string; serviceName: string; processName: string; biaRtoMinutes: number; biaRpoMinutes: number; drpPlanId: string | null; drpTitle: string | null; drpRtoMinutes: number | null; drpRpoMinutes: number | null; status: 'missing_drp' | 'rto_gap' | 'rpo_gap' | 'aligned'; detail: string }> };
type BootstrapStatus = { needsBootstrap: boolean; tenantCount: number; userCount: number; adminCount: number; bootstrapCommand: string; defaultSeedWarning: string };
type ReadinessSummary = { status: string; failed: number; warnings: number; checks: Array<{ key: string; label: string; status: 'pass' | 'warn' | 'fail'; detail: string }> };
type TenantSettings = { smtp: { mode: 'outbox_only' | 'smtp'; host?: string; port?: number; from?: string; configuredFromDashboard?: boolean }; internalAccess: { mode: 'ip_port'; securityGroupRestricted: boolean; adminPolicy: string }; backup: { frequency: 'daily'; retentionDays: number }; sso: { enabled: boolean; provider: 'oidc' | 'azure_ad'; issuerUrl?: string; clientId?: string; redirectUri?: string } };
type AuditLogItem = { id: string; actorId?: string | null; actorEmail?: string | null; entityType: string; entityId: string; action: string; summary: string; metadata: Record<string, unknown>; appendOnly: boolean; createdAt: string };
type DrpQualityScore = { score: number; status: 'weak' | 'fair' | 'good' | 'ready'; signals: Array<{ key: string; label: string; passed: boolean; weight: number; detail: string }>; gaps: string[] };
type PlanEvidenceItem = { id: string; planId: string; sectionKey?: string | null; title: string; evidenceUrl: string; evidenceType: string; notes: string; createdAt: string };
type BackupSummary = { backupDir: string; count: number; latest: null | { file: string; path: string; sizeBytes: number; modifiedAt: string; checksumFile: boolean }; latestAgeHours: number | null; status: string; backups: Array<{ file: string; path: string; sizeBytes: number; modifiedAt: string; checksumFile: boolean }>; error?: string };

// In production behind a same-origin reverse proxy (e.g. Nginx on :8080), use
// empty string so the browser hits `${path}` (which already starts with /api).
// Override with VITE_API_URL for dev or split-origin deployments.
const API = import.meta.env.VITE_API_URL ?? '';
const COLLAB_WS = import.meta.env.VITE_COLLAB_WS_URL ?? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/collab`;

function cookieValue(name: string): string | undefined {
  return document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.split('=')
    .slice(1)
    .join('=');
}

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase();
  const headers: Record<string, string> = { ...(options.headers as Record<string, string> | undefined) };
  if (options.body !== undefined && !(options.body instanceof FormData)) headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrf = cookieValue('resiliplan_csrf');
    if (csrf) headers['X-CSRF-Token'] = decodeURIComponent(csrf);
  }
  const res = await fetch(`${API}${path}`, {
    credentials: 'include',
    ...options,
    headers,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof document === 'undefined') return 'light';
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  });
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    try { localStorage.setItem('resiliplan-theme', theme); } catch {}
  }, [theme]);
  return { theme, toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) };
}

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
      aria-label="Toggle theme"
      className="btn-ghost h-8 w-8 !p-0 rounded-full"
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    api<{ user: User }>('/api/v1/auth/me')
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setAuthLoading(false));
  }, []);

  if (authLoading) return <Centered><span className="anim-pulse-soft text-muted-foreground">Loading ResiliPlan…</span></Centered>;
  if (!user) return (
    <ToastProvider>
      <AuthRoutes onLogin={setUser} />
    </ToastProvider>
  );

  return (
    <ToastProvider>
      <Shell user={user} onUserUpdate={setUser} onLogout={() => setUser(null)} />
    </ToastProvider>
  );
}

function AuthRoutes({ onLogin }: { onLogin: (user: User) => void }) {
  return (
    <Routes>
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="*" element={<LoginPage onLogin={onLogin} />} />
    </Routes>
  );
}

const SIDEBAR_GROUPS: { label: string; items: { label: string; to: string; icon: React.ReactNode }[] }[] = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', to: '/', icon: <Home className="h-4 w-4" /> },
    ],
  },
  {
    label: 'Resilience',
    items: [
      { label: 'DR Plans', to: '/plans', icon: <FileText className="h-4 w-4" /> },
      { label: 'BIA', to: '/bia', icon: <CheckCircle2 className="h-4 w-4" /> },
      { label: 'Assets', to: '/assets', icon: <Server className="h-4 w-4" /> },
      { label: 'Risks', to: '/risks', icon: <AlertTriangle className="h-4 w-4" /> },
      { label: 'Drills', to: '/drills', icon: <Calendar className="h-4 w-4" /> },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Monitoring', to: '/monitoring', icon: <Activity className="h-4 w-4" /> },
      { label: 'Email Outbox', to: '/email-outbox', icon: <Mail className="h-4 w-4" /> },
      { label: 'Backups', to: '/backups', icon: <Server className="h-4 w-4" /> },
      { label: 'Readiness', to: '/readiness', icon: <CheckCircle2 className="h-4 w-4" /> },
    ],
  },
  {
    label: 'Governance',
    items: [
      { label: 'Users', to: '/users', icon: <Users className="h-4 w-4" /> },
      { label: 'Notifications', to: '/notifications', icon: <Bell className="h-4 w-4" /> },
      { label: 'Billing', to: '/billing', icon: <CreditCard className="h-4 w-4" /> },
      { label: 'Audit Trail', to: '/audit-trail', icon: <FileText className="h-4 w-4" /> },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'AI Providers', to: '/ai-providers', icon: <Sparkles className="h-4 w-4" /> },
      { label: 'Settings', to: '/settings', icon: <Settings className="h-4 w-4" /> },
      { label: 'Security', to: '/security', icon: <Lock className="h-4 w-4" /> },
    ],
  },
];

function Shell({ user, onUserUpdate, onLogout }: { user: User; onUserUpdate: (user: User) => void; onLogout: () => void }) {
  async function logout() {
    await api('/api/v1/auth/logout', { method: 'POST' });
    onLogout();
  }
  const [commandOpen, setCommandOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();
  useEffect(() => { setMobileNavOpen(false); }, [location.pathname]);

  const SidebarNav = (
    <nav className="surface surface-lift space-y-3 p-3 max-h-[calc(100vh-6rem)] overflow-y-auto md:sticky md:top-20">
      {SIDEBAR_GROUPS.map((group) => (
        <div key={group.label} className="space-y-0.5">
          <p className="px-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">{group.label}</p>
          {group.items.map((item) => (
            <RouterNavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-primary/15 text-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground hover:translate-x-0.5'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary" />}
                  <span className={`transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground/70 group-hover:text-foreground'}`}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </>
              )}
            </RouterNavLink>
          ))}
        </div>
      ))}
    </nav>
  );

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="absolute -top-40 -left-40 h-[36rem] w-[36rem] rounded-full bg-primary/15 blur-3xl anim-float" />
        <div className="absolute top-1/2 -right-40 h-[32rem] w-[32rem] rounded-full bg-accent/12 blur-3xl anim-float-slow" />
      </div>

      <header className="sticky top-0 z-30 border-b border-border/60 glass">
        <div className="container flex h-14 items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-4 w-4" />
            </button>
            <Link to="/" className="flex items-center gap-2 group">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary via-accent to-[hsl(280,80%,65%)] text-primary-foreground shadow-soft anim-pulse-glow">
                <FileText className="h-4 w-4" />
              </div>
              <span className="font-bold tracking-tight anim-gradient-text text-base">ResiliPlan</span>
              <span className="hidden rounded-full border border-border/60 bg-muted/60 px-2 py-0.5 text-xs font-medium text-muted-foreground md:inline-block">Phase 1 Core DRP</span>
            </Link>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <CommandTrigger onClick={() => setCommandOpen(true)} />
            <ThemeToggle />
            <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-1.5 py-1 backdrop-blur-sm sm:px-2">
              <Avatar name={user.name} size="sm" status="online" />
              <div className="hidden text-xs sm:block">
                <div className="font-medium leading-4">{user.name}</div>
                <div className="text-muted-foreground leading-3 capitalize">{user.role}</div>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={logout} className="hidden sm:inline-flex" leftIcon={<LogOut className="h-3.5 w-3.5" />}>
              Logout
            </Button>
            <Button variant="ghost" size="sm" onClick={logout} className="sm:hidden" aria-label="Logout">
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </header>
      <div className="container flex gap-6 py-6">
        <aside className="hidden md:block w-60 shrink-0">
          {SidebarNav}
        </aside>
        <main className="flex-1 min-w-0"><Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/plans" element={<PlansPage />} />
          <Route path="/plans/:id" element={<PlanEditor />} />
          <Route path="/bia" element={<BiaPage />} />
          <Route path="/assets" element={<AssetsPage />} />
          <Route path="/risks" element={<RisksPage />} />
          <Route path="/drills" element={<DrillsPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/monitoring" element={<MonitoringPage />} />
          <Route path="/billing" element={<BillingPage />} />
          <Route path="/email-outbox" element={<EmailOutboxPage />} />
          <Route path="/audit-trail" element={<AuditTrailPage />} />
          <Route path="/backups" element={<BackupsPage />} />
          <Route path="/readiness" element={<ReadinessPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/ai-providers" element={<AIProvidersPage />} />
          <Route path="/security" element={<SecurityPage user={user} onUserUpdate={onUserUpdate} />} />
          <Route path="*" element={<NotFound />} />
        </Routes></main>
      </div>

      {/* Mobile sidebar drawer */}
      <div
        className={`fixed inset-0 z-40 md:hidden ${mobileNavOpen ? '' : 'pointer-events-none'}`}
        aria-hidden={!mobileNavOpen}
      >
        <div
          className={`absolute inset-0 bg-background/70 backdrop-blur-sm transition-opacity duration-200 ${mobileNavOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setMobileNavOpen(false)}
        />
        <div
          className={`absolute inset-y-0 left-0 w-72 max-w-[85vw] transform border-r border-border/60 bg-background shadow-2xl transition-transform duration-200 ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'}`}
          role="dialog"
          aria-label="Navigation"
        >
          <div className="flex h-14 items-center justify-between border-b border-border/60 px-4">
            <span className="text-sm font-semibold">Navigation</span>
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Close navigation"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="p-2">
            {SidebarNav}
          </div>
        </div>
      </div>

      <CommandPalette />
    </div>
  );
}

function LoginPage({ onLogin }: { onLogin: (user: User) => void }) {
  const [email, setEmail] = useState('admin@resiliplan.local');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true); setError('');
    try {
      const result = await api<{ user: User }>('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password, totp: totp || undefined }) });
      onLogin(result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally { setLoading(false); }
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Decorative aurora blobs — fixed, behind content */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="absolute -top-32 -left-32 h-[36rem] w-[36rem] rounded-full bg-primary/25 blur-3xl anim-float" />
        <div className="absolute top-1/3 -right-40 h-[32rem] w-[32rem] rounded-full bg-accent/20 blur-3xl anim-float-slow" />
        <div className="absolute bottom-0 left-1/3 h-[28rem] w-[28rem] rounded-full bg-[hsl(280,80%,65%)]/15 blur-3xl anim-float" />
      </div>

      <div className="flex min-h-screen items-center justify-center p-6 anim-fade-in">
        <div className="w-full max-w-5xl grid gap-10 lg:grid-cols-2 items-center">
          {/* Hero */}
          <div className="hidden lg:block space-y-6 anim-fade-up">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Sparkles className="h-3 w-3" /> ISO 22301-aligned
            </div>
            <h1 className="display display-glow">Build resilient DR plans, faster.</h1>
            <p className="text-base text-muted-foreground max-w-md">ResiliPlan is a self-hosted Disaster Recovery Plan builder with AI co-pilots, real-time collaboration, and ISO 22301 templates baked in.</p>
            <div className="flex flex-wrap gap-3 pt-2">
              <span className="badge border-primary/30 bg-primary/10 text-primary">14 ISO sections</span>
              <span className="badge border-accent/30 bg-accent/10 text-accent">AI helpers</span>
              <span className="badge border-border bg-muted/60 text-muted-foreground">Realtime collab</span>
              <span className="badge border-border bg-muted/60 text-muted-foreground">Audit trail</span>
            </div>
          </div>

          {/* Login form */}
          <form onSubmit={submit} className="surface-glow p-8 anim-fade-up" style={{ animationDelay: '120ms' }}>
            <div className="mb-6 flex items-center gap-3">
              <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-accent to-[hsl(280,80%,65%)] text-primary-foreground shadow-soft anim-pulse-glow">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight">Sign in</h2>
                <p className="text-sm text-muted-foreground">Core DRP workspace</p>
              </div>
            </div>
            {error && <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} className="input mb-4 mt-1.5" />
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Password</label>
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" className="input mb-4 mt-1.5" />
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">TOTP code <span className="text-muted-foreground/70 normal-case font-normal">(if MFA enabled)</span></label>
            <input value={totp} onChange={(e) => setTotp(e.target.value)} inputMode="numeric" className="input mb-6 mt-1.5" />
            <button disabled={loading} className="btn-primary w-full">
              {loading ? <span className="anim-pulse-soft">Signing in…</span> : 'Sign in'}
            </button>
            <div className="mt-4 text-center text-sm"><Link to="/forgot-password" className="font-medium text-primary hover:underline">Forgot password?</Link></div>
          </form>
        </div>
      </div>
    </div>
  );
}

function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true); setError(''); setMessage('');
    try {
      await api('/api/v1/auth/password-reset/request', { method: 'POST', body: JSON.stringify({ email }) });
      setMessage('If your email exists in our system, a password reset link has been queued. Check Email Outbox in dashboard.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request reset');
    } finally { setLoading(false); }
  }

  return <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6"><form onSubmit={submit} className="w-full max-w-md rounded-xl border bg-white p-8 shadow-sm">
    <div className="mb-6 flex items-center gap-2"><div className="rounded-lg bg-primary p-2 text-white"><Mail className="h-5 w-5" /></div><div><h1 className="text-xl font-semibold">Reset Password</h1><p className="text-sm text-muted-foreground">Request password reset link</p></div></div>
    {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    {message && <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">{message}</div>}
    <label className="text-sm font-medium">Email</label><input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required className="mb-6 mt-1 w-full rounded-md border px-3 py-2" />
    <button disabled={loading} className="w-full rounded-md bg-primary px-4 py-2 font-medium text-white disabled:opacity-50">{loading ? 'Requesting...' : 'Send reset link'}</button>
    <div className="mt-4 text-center text-sm"><Link to="/" className="text-primary hover:underline">← Back to login</Link></div>
  </form></div>;
}

function ResetPasswordPage() {
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token');
    if (t) setToken(t);
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setLoading(true); setError(''); setMessage('');
    try {
      await api('/api/v1/auth/password-reset/confirm', { method: 'POST', body: JSON.stringify({ token, newPassword: password }) });
      setMessage('Password reset successful. You can now login with your new password.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally { setLoading(false); }
  }

  return <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6"><form onSubmit={submit} className="w-full max-w-md rounded-xl border bg-white p-8 shadow-sm">
    <div className="mb-6 flex items-center gap-2"><div className="rounded-lg bg-primary p-2 text-white"><Lock className="h-5 w-5" /></div><div><h1 className="text-xl font-semibold">Set New Password</h1><p className="text-sm text-muted-foreground">Create a new password</p></div></div>
    {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    {message && <><div className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">{message}</div><Link to="/" className="block text-center text-sm text-primary hover:underline">← Go to login</Link></>}
    {!message && <><label className="text-sm font-medium">New password</label><input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required minLength={12} className="mb-4 mt-1 w-full rounded-md border px-3 py-2" /><label className="text-sm font-medium">Confirm password</label><input value={confirm} onChange={(e) => setConfirm(e.target.value)} type="password" required minLength={12} className="mb-6 mt-1 w-full rounded-md border px-3 py-2" /><button disabled={loading} className="w-full rounded-md bg-primary px-4 py-2 font-medium text-white disabled:opacity-50">{loading ? 'Resetting...' : 'Reset password'}</button></>}
  </form></div>;
}

function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const toast = useToast();

  async function load() {
    setLoading(true);
    try { setPlans((await api<{ plans: Plan[] }>('/api/v1/plans')).plans); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to load plans'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  const stats = useMemo(() => ({ total: plans.length, approved: plans.filter((p) => p.status === 'approved').length, review: plans.filter((p) => p.status === 'in_review').length, draft: plans.filter((p) => p.status === 'draft').length }), [plans]);
  const filtered = useMemo(() => {
    if (!search.trim()) return plans;
    const q = search.toLowerCase();
    return plans.filter((p) => p.title.toLowerCase().includes(q) || p.serviceName.toLowerCase().includes(q));
  }, [plans, search]);
  const health = useMemo(() => {
    const now = Date.now();
    const ninetyDays = 90 * 24 * 60 * 60 * 1000;
    const stale = plans.filter((p) => {
      const updated = (p as { updatedAt?: string }).updatedAt;
      if (!updated) return true;
      return now - new Date(updated).getTime() > ninetyDays;
    });
    const lowContent = plans.filter((p) => {
      const sections = (p as { sections?: Section[] }).sections ?? [];
      const totalWords = sections.reduce((s, sec) => s + (sec.contentMarkdown || '').trim().split(/\s+/).filter(Boolean).length, 0);
      return sections.length > 0 && totalWords < 200;
    });
    const needsApproval = plans.filter((p) => p.status === 'in_review');
    const expiredReview = plans.filter((p) => p.status === 'approved' && (() => {
      const updated = (p as { updatedAt?: string }).updatedAt;
      if (!updated) return false;
      return now - new Date(updated).getTime() > ninetyDays;
    })());
    return { stale, lowContent, needsApproval, expiredReview };
  }, [plans]);
  const healthScore = plans.length === 0 ? 0 : Math.round(((plans.length - health.stale.length - health.lowContent.length - health.expiredReview.length) / plans.length) * 100);

  return <div className="space-y-6">
    <PageHeader
      eyebrow={<>Resilience · DR Plans</>}
      title="DR Plans"
      description="ISO 22301 template, approval, audit, export. Create new plans from scratch or fork existing baselines."
      breadcrumbs={[{ label: 'DR Plans' }]}
      actions={<Button variant="primary" size="md" onClick={() => setFormOpen(!formOpen)} leftIcon={<FileText className="h-4 w-4" />}>{formOpen ? 'Cancel' : 'New DRP'}</Button>}
    />
    <div className="grid gap-4 sm:grid-cols-4">
      <KpiCard label="Total" value={`${stats.total}`} hint="Plans" tone="primary" />
      <KpiCard label="Approved" value={`${stats.approved}`} hint="Signed-off" tone="success" />
      <KpiCard label="In Review" value={`${stats.review}`} hint="Waiting approval" tone="warning" />
      <KpiCard label="Draft" value={`${stats.draft}`} hint="Work in progress" tone="info" />
    </div>
    {plans.length > 0 && (
      <div className="surface surface-lift p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /> Maintenance health</h3>
            <p className="text-xs text-muted-foreground">Surfaces plans that need attention: stale, low-content, awaiting approval, or post-90d re-review.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted/60">
              <div className={`h-full rounded-full transition-all duration-500 ${healthScore >= 80 ? 'bg-emerald-500' : healthScore >= 50 ? 'bg-amber-500' : 'bg-destructive'}`} style={{ width: `${Math.max(healthScore, 2)}%` }} />
            </div>
            <span className="text-sm font-bold tabular-nums">{healthScore}%</span>
            <span className="text-xs text-muted-foreground">healthy</span>
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          <HealthFlag label="Stale (>90d)" count={health.stale.length} tone={health.stale.length > 0 ? 'warning' : 'success'} hint="not updated in 90+ days" />
          <HealthFlag label="Low content" count={health.lowContent.length} tone={health.lowContent.length > 0 ? 'warning' : 'success'} hint="<200 words total" />
          <HealthFlag label="Awaiting approval" count={health.needsApproval.length} tone={health.needsApproval.length > 0 ? 'info' : 'success'} hint="submitted, not signed" />
          <HealthFlag label="Re-review due" count={health.expiredReview.length} tone={health.expiredReview.length > 0 ? 'warning' : 'success'} hint="approved >90d ago" />
        </div>
      </div>
    )}
    {formOpen && <NewPlanForm onCreated={(plan) => { setFormOpen(false); toast.success('Plan created', { description: plan.title }); navigate(`/plans/${plan.id}`); }} />}
    {!formOpen && <AIPlanGenerator onCreated={(plan) => { toast.success('AI draft ready', { description: `${plan.title} — review and refine in editor` }); navigate(`/plans/${plan.id}`); }} />}
    {error && <ErrorBox message={error} />}
    <div className="surface surface-lift">
      <div className="flex items-center justify-between gap-3 border-b p-4">
        <h2 className="font-semibold">Plan register</h2>
        <SearchInput value={search} onChange={setSearch} placeholder="Search plans..." className="w-64" />
      </div>
      {loading ? <SkeletonList rows={4} /> : plans.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title="No DR plans yet"
          description="Buat plan pertama dari template ISO 22301 — 14 sections, AI helpers, realtime collab."
          action={<Button variant="primary" size="md" onClick={() => setFormOpen(true)}>Create first plan</Button>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<FileText className="h-6 w-6" />} title="No plans match your search" description={`No plans matching "${search}". Try a different keyword.`} />
      ) : <div className="divide-y">{filtered.map((plan) => {
        const updated = (plan as { updatedAt?: string }).updatedAt;
        const isStale = updated ? (Date.now() - new Date(updated).getTime() > 90 * 24 * 60 * 60 * 1000) : true;
        const sections = (plan as { sections?: Section[] }).sections ?? [];
        const totalWords = sections.reduce((s, sec) => s + (sec.contentMarkdown || '').trim().split(/\s+/).filter(Boolean).length, 0);
        const isLow = sections.length > 0 && totalWords < 200;
        return (
          <Link key={plan.id} to={`/plans/${plan.id}`} className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-muted/50">
            <div className="min-w-0 flex-1">
              <div className="font-medium">{plan.title}</div>
              <div className="text-sm text-muted-foreground">{plan.serviceName} · RTO {plan.rtoMinutes}m · RPO {plan.rpoMinutes}m · {totalWords} words</div>
            </div>
            <div className="flex items-center gap-1.5">
              {isStale && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400" title="Not updated in 90+ days">stale</span>}
              {isLow && <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-medium text-rose-700 dark:text-rose-400" title="<200 words total">thin</span>}
              <StatusBadge status={plan.status} />
            </div>
          </Link>
        );
      })}</div>}
    </div>
  </div>;
}

function HealthFlag({ label, count, tone, hint }: { label: string; count: number; tone: 'success' | 'warning' | 'info'; hint: string }) {
  const toneClass = tone === 'success' ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400' : tone === 'warning' ? 'border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400' : 'border-blue-500/30 bg-blue-500/5 text-blue-700 dark:text-blue-400';
  return (
    <div className={`rounded-lg border p-2.5 ${toneClass}`}>
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
        <span className="text-lg font-bold tabular-nums">{count}</span>
      </div>
      <p className="mt-0.5 text-[10px] opacity-80">{hint}</p>
    </div>
  );
}

function NewPlanForm({ onCreated }: { onCreated: (plan: Plan) => void }) {
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setSubmitting(true);
    const data = new FormData(event.currentTarget);
    try {
      const plan = await api<Plan>('/api/v1/plans', { method: 'POST', body: JSON.stringify({
        title: String(data.get('title')), serviceName: String(data.get('serviceName')), serviceOwner: String(data.get('serviceOwner')),
        criticality: String(data.get('criticality')), rtoMinutes: Number(data.get('rtoMinutes')), rpoMinutes: Number(data.get('rpoMinutes')),
        description: String(data.get('description') ?? ''), recoveryStrategy: String(data.get('recoveryStrategy') ?? ''),
      }) });
      onCreated(plan);
    } catch (err) { setError(err instanceof Error ? err.message : 'Create failed'); }
    finally { setSubmitting(false); }
  }
  return <form onSubmit={submit} className="surface surface-lift grid gap-4 p-5 md:grid-cols-2">
    {error && <div className="md:col-span-2"><ErrorBox message={error} /></div>}
    <Input name="title" label="Plan title" placeholder="DRP Core Banking" required />
    <Input name="serviceName" label="Service name" placeholder="Core Banking" required />
    <Input name="serviceOwner" label="Service owner" placeholder="Nama PIC" required />
    <label className="text-sm font-medium">Criticality<select name="criticality" defaultValue="tier_2" className="input mt-1"><option value="tier_1">Tier 1 — critical</option><option value="tier_2">Tier 2 — high</option><option value="tier_3">Tier 3 — standard</option><option value="tier_4">Tier 4 — deferrable</option></select></label>
    <Input name="rtoMinutes" label="RTO minutes" type="number" defaultValue="60" required />
    <Input name="rpoMinutes" label="RPO minutes" type="number" defaultValue="15" required />
    <label className="text-sm font-medium md:col-span-2">Description<textarea name="description" className="input mt-1 h-20" placeholder="What does this service do, who depends on it?" /></label>
    <label className="text-sm font-medium md:col-span-2">Recovery strategy<textarea name="recoveryStrategy" className="input mt-1 h-20" placeholder="Warm-standby in secondary region with read-replica promotion..." /></label>
    <div className="md:col-span-2"><Button type="submit" variant="primary" size="md" disabled={submitting}>{submitting ? 'Creating…' : 'Create empty plan'}</Button></div>
  </form>;
}

function AIPlanGenerator({ onCreated }: { onCreated: (plan: Plan) => void }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const toast = useToast();
  async function generate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setSubmitting(true);
    const data = new FormData(event.currentTarget);
    const payload = {
      serviceName: String(data.get('serviceName')),
      serviceOwner: String(data.get('serviceOwner') || 'TBA'),
      rtoMinutes: Number(data.get('rtoMinutes')),
      rpoMinutes: Number(data.get('rpoMinutes')),
      criticality: String(data.get('criticality')),
      description: String(data.get('description') || ''),
    };
    try {
      setProgress('Creating empty plan…');
      const plan = await api<Plan>('/api/v1/plans', { method: 'POST', body: JSON.stringify({
        title: `DRP ${payload.serviceName}`, serviceName: payload.serviceName, serviceOwner: payload.serviceOwner,
        criticality: payload.criticality, rtoMinutes: payload.rtoMinutes, rpoMinutes: payload.rpoMinutes,
        description: payload.description, recoveryStrategy: '',
      }) });
      setProgress('Asking AI to draft all 14 ISO 22301 sections…');
      const res = await fetch('/api/v1/ai/plan-skeleton', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': decodeURIComponent(cookieValue('resiliplan_csrf') || '') },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'AI plan skeleton failed');
      }
      const { skeleton } = await res.json() as { skeleton: string };
      setProgress('Parsing AI sections…');
      // Parse sections: === SECTION: <key> === ... <next section or end>
      const sectionRegex = /===\s*SECTION:\s*([a-z0-9_-]+)\s*===\s*([\s\S]*?)(?=\n===\s*SECTION:|$)/gi;
      const parsed: Record<string, string> = {};
      let match;
      while ((match = sectionRegex.exec(skeleton)) !== null) {
        const key = match[1].toLowerCase().trim();
        const content = match[2].trim();
        if (content) parsed[key] = content;
      }
      const keys = Object.keys(parsed);
      if (keys.length === 0) throw new Error('AI returned no parseable sections. Try again or create empty plan and use per-section AI.');
      setProgress(`Saving ${keys.length} sections to plan…`);
      // Load plan sections to get IDs
      const planDetail = await api<Plan>(`/api/v1/plans/${plan.id}`);
      const sections = planDetail.sections ?? [];
      let saved = 0;
      for (const sec of sections) {
        const content = parsed[sec.sectionKey];
        if (!content) continue;
        await api(`/api/v1/plans/${plan.id}/sections/${sec.sectionKey}`, { method: 'PATCH', body: JSON.stringify({ contentMarkdown: content }) });
        saved++;
      }
      toast.success('AI draft complete', { description: `${saved}/${sections.length} sections populated. Review and refine.` });
      setOpen(false);
      onCreated(plan);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI generation failed');
      toast.error('AI generation failed', { description: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setSubmitting(false);
      setProgress('');
    }
  }
  return (
    <>
      <div className="surface surface-lift border-primary/30 bg-gradient-to-br from-primary/5 via-accent/5 to-transparent p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-primary" /> Generate a plan with AI
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              AI drafts all 14 ISO 22301 sections (context, roles, recovery, testing, etc.) tailored to your service, RTO, and RPO.
              You review and refine after.
            </p>
          </div>
          <Button variant="primary" size="md" onClick={() => setOpen(true)} leftIcon={<Sparkles className="h-4 w-4" />}>Open AI generator</Button>
        </div>
      </div>
      <Modal open={open} onClose={() => !submitting && setOpen(false)} title="AI plan generator" description="Tell AI the basics — service, owner, recovery targets. AI drafts all 14 ISO 22301 sections." size="md">
        <form onSubmit={generate} className="space-y-3">
          {error && <ErrorBox message={error} />}
          {submitting && progress && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm text-primary">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 anim-pulse-soft" />
                <span>{progress}</span>
              </div>
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            <Input name="serviceName" label="Service name" placeholder="Core Banking" required />
            <Input name="serviceOwner" label="Service owner" placeholder="Nama PIC" />
            <label className="text-sm font-medium">Criticality<select name="criticality" defaultValue="tier_2" className="input mt-1"><option value="tier_1">Tier 1 — critical</option><option value="tier_2">Tier 2 — high</option><option value="tier_3">Tier 3 — standard</option><option value="tier_4">Tier 4 — deferrable</option></select></label>
            <div />
            <Input name="rtoMinutes" label="RTO minutes" type="number" defaultValue="60" required />
            <Input name="rpoMinutes" label="RPO minutes" type="number" defaultValue="15" required />
          </div>
          <label className="block text-sm font-medium">Description<textarea name="description" className="input mt-1 h-24" placeholder="What does this service do, who depends on it, any infrastructure patterns (cloud, on-prem, hybrid)?" /></label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="md" onClick={() => setOpen(false)} disabled={submitting}>Cancel</Button>
            <Button type="submit" variant="primary" size="md" disabled={submitting} leftIcon={<Sparkles className="h-4 w-4" />}>{submitting ? 'Generating…' : 'Generate plan'}</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function PlanEditor() {
  const { id } = useParams();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [selected, setSelected] = useState('context');
  const [draft, setDraft] = useState('');
  const [comments, setComments] = useState<PlanComment[]>([]);
  const [versions, setVersions] = useState<PlanVersion[]>([]);
  const [quality, setQuality] = useState<DrpQualityScore | null>(null);
  const [evidence, setEvidence] = useState<PlanEvidenceItem[]>([]);
  const [commentBody, setCommentBody] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMode, setAiMode] = useState<'draft' | 'improve' | 'steps' | 'test' | 'comms' | 'escalation'>('draft');
  const [stepsLoading, setStepsLoading] = useState(false);
  const [testsLoading, setTestsLoading] = useState(false);
  const [strategyOpen, setStrategyOpen] = useState(false);
  const [strategyLoading, setStrategyLoading] = useState(false);
  const [strategyResult, setStrategyResult] = useState<{ recommendation: Record<string, unknown>; raw: string } | null>(null);
  const [strategyError, setStrategyError] = useState('');
  const [approveOpen, setApproveOpen] = useState(false);
  const [signatureText, setSignatureText] = useState('');
  const [rollbackTarget, setRollbackTarget] = useState<PlanVersion | null>(null);
  const [collabStatus, setCollabStatus] = useState('offline');
  const [collabUsers, setCollabUsers] = useState(1);
  const [error, setError] = useState('');
  const toast = useToast();
  const yDocRef = useRef<Y.Doc | null>(null);
  const yTextRef = useRef<Y.Text | null>(null);
  async function load() {
    if (!id) return;
    try {
      const loaded = await api<Plan>(`/api/v1/plans/${id}`);
      const commentData = await api<{ comments: PlanComment[] }>(`/api/v1/plans/${id}/comments`);
      const versionData = await api<{ versions: PlanVersion[] }>(`/api/v1/plans/${id}/versions`);
      const qualityData = await api<DrpQualityScore>(`/api/v1/plans/${id}/quality`);
      const evidenceData = await api<{ evidence: PlanEvidenceItem[] }>(`/api/v1/plans/${id}/evidence`);
      setPlan(loaded); setComments(commentData.comments); setVersions(versionData.versions); setQuality(qualityData); setEvidence(evidenceData.evidence); setSelected(loaded.sections?.[0]?.sectionKey ?? 'context'); setDraft(loaded.sections?.[0]?.contentMarkdown ?? '');
    }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to load plan'); }
  }
  useEffect(() => { void load(); }, [id]);

  useEffect(() => {
    if (!id) return;
    const doc = new Y.Doc();
    yDocRef.current = doc;
    const provider = new WebsocketProvider(COLLAB_WS, `drp-plan-${id}`, doc);
    provider.awareness.setLocalStateField('user', { name: 'Current reviewer', color: '#2563eb' });
    const updatePresence = () => setCollabUsers(Array.from(provider.awareness.getStates().keys()).length || 1);
    provider.on('status', (event: { status: string }) => setCollabStatus(event.status));
    provider.awareness.on('change', updatePresence);
    updatePresence();
    return () => {
      provider.awareness.off('change', updatePresence);
      provider.destroy();
      doc.destroy();
      yDocRef.current = null;
      yTextRef.current = null;
    };
  }, [id]);

  const section = plan?.sections?.find((s) => s.sectionKey === selected);
  useEffect(() => { setDraft(section?.contentMarkdown ?? ''); }, [section?.id]);

  useEffect(() => {
    if (!section || !yDocRef.current) return;
    const yText = yDocRef.current.getText(`section-${section.sectionKey}`);
    yTextRef.current = yText;
    if (yText.length === 0 && section.contentMarkdown) yText.insert(0, section.contentMarkdown);
    setDraft(yText.toString() || section.contentMarkdown || '');
    const observer = () => setDraft(yText.toString());
    yText.observe(observer);
    return () => yText.unobserve(observer);
  }, [section?.id, section?.sectionKey]);

  function updateDraft(value: string) {
    setDraft(value);
    const yText = yTextRef.current;
    if (!yText || yText.toString() === value) return;
    yText.delete(0, yText.length);
    yText.insert(0, value);
  }

  async function saveSection() {
    if (!id || !section) return;
    try {
      const updated = await api<Section>(`/api/v1/plans/${id}/sections/${section.sectionKey}`, { method: 'PATCH', body: JSON.stringify({ contentMarkdown: draft }) });
      setPlan((p) => p ? { ...p, sections: p.sections?.map((s) => s.id === updated.id ? updated : s) } : p);
      toast.success('Section saved');
    } catch (err) {
      toast.error('Save failed', { description: err instanceof Error ? err.message : 'Unknown error' });
    }
  }
  async function submitReview() {
    if (!id) return;
    try {
      setPlan(await api<Plan>(`/api/v1/plans/${id}/submit`, { method: 'POST' }));
      toast.success('Submitted for approval');
    } catch (err) { toast.error('Submit failed', { description: err instanceof Error ? err.message : 'Unknown error' }); }
  }
  async function confirmApprove() {
    if (!id || !signatureText.trim()) return;
    setApproveOpen(false);
    try {
      setPlan(await api<Plan>(`/api/v1/plans/${id}/approve`, { method: 'POST', body: JSON.stringify({ signatureText }) }));
      toast.success('Approved and signed');
    } catch (err) { toast.error('Approve failed', { description: err instanceof Error ? err.message : 'Unknown error' }); }
  }
  async function createVersion() {
    if (!id) return;
    try {
      await api<PlanVersion>(`/api/v1/plans/${id}/versions`, { method: 'POST', body: JSON.stringify({ changeSummary: 'Manual snapshot from editor' }) });
      await load();
      toast.success('Version snapshot created');
    } catch (err) { toast.error('Snapshot failed', { description: err instanceof Error ? err.message : 'Unknown error' }); }
  }
  async function confirmRollback() {
    if (!id || !rollbackTarget) return;
    const target = rollbackTarget;
    setRollbackTarget(null);
    try {
      setPlan(await api<Plan>(`/api/v1/plans/${id}/versions/${target.id}/rollback`, { method: 'POST' }));
      await load();
      toast.success(`Rolled back to version ${target.version}`);
    } catch (err) { toast.error('Rollback failed', { description: err instanceof Error ? err.message : 'Unknown error' }); }
  }
  async function addComment() {
    if (!id || !section || !commentBody.trim()) return;
    try {
      const comment = await api<PlanComment>(`/api/v1/plans/${id}/comments`, { method: 'POST', body: JSON.stringify({ sectionKey: section.sectionKey, body: commentBody, parentCommentId: replyTo ?? undefined }) });
      setComments((current) => [...current, comment]); setCommentBody(''); setReplyTo(null);
      toast.success(replyTo ? 'Reply added' : 'Comment added');
    } catch (err) { toast.error('Comment failed', { description: err instanceof Error ? err.message : 'Unknown error' }); }
  }
  async function addEvidence(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      await api<PlanEvidenceItem>(`/api/v1/plans/${id}/evidence`, { method: 'POST', body: JSON.stringify({ sectionKey: selected, title: data.get('title'), evidenceUrl: data.get('evidenceUrl'), evidenceType: data.get('evidenceType') || 'link', notes: data.get('notes') }) });
      form.reset();
      await load();
      toast.success('Evidence linked');
    } catch (err) { toast.error('Evidence failed', { description: err instanceof Error ? err.message : 'Unknown error' }); }
  }
  async function resolveComment(commentId: string) {
    if (!id) return;
    try {
      const updated = await api<PlanComment>(`/api/v1/plans/${id}/comments/${commentId}`, { method: 'PATCH', body: JSON.stringify({ status: 'resolved' }) });
      setComments((current) => current.map((comment) => comment.id === updated.id ? updated : comment));
      toast.success('Comment resolved');
    } catch (err) { toast.error('Resolve failed', { description: err instanceof Error ? err.message : 'Unknown error' }); }
  }
  async function suggestWithAI() {
    if (!section || !plan || aiLoading) return;
    setAiLoading(true); setAiSuggestion('');
    try {
      const csrf = cookieValue('resiliplan_csrf');
      const res = await fetch(`${API}/api/v1/ai/suggest`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(csrf ? { 'X-CSRF-Token': decodeURIComponent(csrf) } : {}),
        },
        body: JSON.stringify({
          section: section.title,
          context: `${plan.title} / ${plan.serviceName} / RTO ${plan.rtoMinutes} minutes / RPO ${plan.rpoMinutes} minutes`,
          prompt: `Draft or improve this ISO 22301 DRP section. Existing content:\n\n${draft || '(empty)'}`,
          mode: aiMode,
          serviceName: plan.serviceName,
          rtoMinutes: plan.rtoMinutes,
          rpoMinutes: plan.rpoMinutes,
          criticality: plan.criticality,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      if (!res.body) throw new Error('AI response stream unavailable');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setAiSuggestion((current) => current + decoder.decode(value, { stream: true }));
      }
    } catch (err) {
      setAiSuggestion(err instanceof Error ? err.message : 'AI suggestion failed');
      toast.error('AI suggestion failed', { description: err instanceof Error ? err.message : 'Unknown error' });
    } finally { setAiLoading(false); }
  }
  function applyAISuggestion() {
    if (!aiSuggestion.trim()) return;
    updateDraft(aiSuggestion);
    toast.info('AI suggestion applied', { description: 'Click Save to persist to server.' });
  }
  async function fetchRecoverySteps() {
    if (!plan || !id || stepsLoading) return;
    setStepsLoading(true);
    try {
      const csrf = cookieValue('resiliplan_csrf');
      const res = await fetch('/api/v1/ai/recovery-steps', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': decodeURIComponent(csrf) } : {}) },
        body: JSON.stringify({
          serviceName: plan.serviceName,
          serviceDescription: (plan as { description?: string }).description ?? undefined,
          rtoMinutes: plan.rtoMinutes,
          rpoMinutes: plan.rpoMinutes,
          strategy: (plan as { recoveryStrategy?: string }).recoveryStrategy || undefined,
          stepsCount: 18,
        }),
      });
      if (!res.ok) { const t = await res.text(); throw new Error(t || 'Recovery steps request failed'); }
      const data = await res.json() as { steps: string };
      setAiSuggestion(data.steps);
      toast.success('Recovery steps generated', { description: 'Review and apply to your draft.' });
    } catch (err) {
      toast.error('Recovery steps failed', { description: err instanceof Error ? err.message : 'Unknown error' });
    } finally { setStepsLoading(false); }
  }
  async function fetchTestScenarios() {
    if (!plan || !id || testsLoading) return;
    setTestsLoading(true);
    try {
      const csrf = cookieValue('resiliplan_csrf');
      const res = await fetch('/api/v1/ai/test-scenarios', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': decodeURIComponent(csrf) } : {}) },
        body: JSON.stringify({
          serviceName: plan.serviceName,
          serviceDescription: (plan as { description?: string }).description ?? undefined,
          strategy: (plan as { recoveryStrategy?: string }).recoveryStrategy || undefined,
        }),
      });
      if (!res.ok) { const t = await res.text(); throw new Error(t || 'Test scenarios request failed'); }
      const data = await res.json() as { tests: string };
      setAiSuggestion(data.tests);
      toast.success('Test scenarios generated', { description: 'Review and apply to your draft.' });
    } catch (err) {
      toast.error('Test scenarios failed', { description: err instanceof Error ? err.message : 'Unknown error' });
    } finally { setTestsLoading(false); }
  }
  async function fetchStrategy() {
    if (!plan || !id) return;
    setStrategyOpen(true); setStrategyLoading(true); setStrategyError(''); setStrategyResult(null);
    try {
      const csrf = cookieValue('resiliplan_csrf');
      const res = await fetch('/api/v1/ai/strategy-recommendation', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': decodeURIComponent(csrf) } : {}) },
        body: JSON.stringify({
          serviceName: plan.serviceName,
          description: (plan as { description?: string }).description ?? undefined,
          rtoMinutes: plan.rtoMinutes,
          rpoMinutes: plan.rpoMinutes,
          criticality: plan.criticality,
        }),
      });
      if (!res.ok) { const t = await res.text(); throw new Error(t || 'Strategy request failed'); }
      const data = await res.json() as { recommendation: Record<string, unknown>; raw: string };
      setStrategyResult(data);
    } catch (err) {
      setStrategyError(err instanceof Error ? err.message : 'Strategy recommendation failed');
    } finally { setStrategyLoading(false); }
  }
  async function applyStrategy() {
    if (!plan || !id || !strategyResult) return;
    const rec = strategyResult.recommendation;
    const summary = `${rec.primaryStrategy ?? 'unknown'}${rec.secondaryStrategy ? ` (+ ${rec.secondaryStrategy})` : ''}\n\n${rec.rationale ?? ''}\n\nRTO/RPO fit: ${rec.rtoRpoFit ?? 'n/a'}\n\nInfrastructure needed:\n${(rec.infrastructureNeeded as string[] | undefined)?.map((s) => `- ${s}`).join('\n') ?? '-'}\n\nTradeoffs:\n${(rec.tradeoffs as string[] | undefined)?.map((s) => `- ${s}`).join('\n') ?? '-'}\n\nPrerequisites:\n${(rec.prerequisites as string[] | undefined)?.map((s) => `- ${s}`).join('\n') ?? '-'}`;
    try {
      await api(`/api/v1/plans/${id}`, { method: 'PATCH', body: JSON.stringify({ recoveryStrategy: summary }) });
      setPlan((p) => p ? { ...p, recoveryStrategy: summary } : p);
      toast.success('Strategy applied to plan', { description: 'Open the Strategy section to refine wording.' });
      setSelected('strategy');
    } catch (err) {
      toast.error('Failed to apply strategy', { description: err instanceof Error ? err.message : 'Unknown error' });
    }
  }

  if (error) return <ErrorBox message={error} />;
  if (!plan) return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96" />
      <div className="grid gap-4 lg:grid-cols-[280px_1fr] mt-6">
        <Skeleton className="h-96" />
        <Skeleton className="h-[520px]" />
      </div>
    </div>
  );
  const currentComments = comments.filter((comment) => comment.sectionKey === selected);
  const sectionTabs = (plan.sections ?? []).slice(0, 8).map((s) => ({ id: s.sectionKey, label: `${s.order}. ${s.title.replace(/^\d+\. /, '')}` }));

  return <div className="space-y-6">
    <PageHeader
      eyebrow={<>DR Plan · v{plan.version} · {plan.serviceName}</>}
      title={plan.title}
      description={`RTO ${plan.rtoMinutes}m · RPO ${plan.rpoMinutes}m · Realtime: ${collabStatus} · ${collabUsers} active editor(s)`}
      breadcrumbs={[{ label: 'DR Plans', to: '/plans' }, { label: plan.title }]}
      actions={
        <>
          <StatusBadge status={plan.status} />
          <Button variant="ghost" size="sm" onClick={fetchStrategy} leftIcon={<Compass className="h-3.5 w-3.5" />}>Strategy advisor</Button>
          <Button variant="ghost" size="sm" onClick={submitReview} leftIcon={<Send className="h-3.5 w-3.5" />}>Submit</Button>
          <Button variant="primary" size="sm" onClick={() => setApproveOpen(true)} leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />}>Approve</Button>
        </>
      }
    />

    {plan.sections && plan.sections.length > 0 && (
      <>
        <div className="overflow-x-auto">
          <Tabs items={sectionTabs} value={selected} onChange={setSelected} />
        </div>
        <SectionStatusGrid sections={plan.sections} selected={selected} onSelect={setSelected} />
      </>
    )}

    <div className="surface surface-lift">
      <div className="flex items-center justify-between border-b p-4">
        <div>
          <h2 className="font-semibold">{section?.title}</h2>
          <p className="text-xs text-muted-foreground">Compliance: {section?.isoClause}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {section?.sectionKey === 'recovery' && (
            <Button variant="ghost" size="sm" onClick={fetchRecoverySteps} disabled={stepsLoading || aiLoading} leftIcon={<ListOrdered className="h-3.5 w-3.5" />}>
              {stepsLoading ? 'Generating…' : 'Generate steps'}
            </Button>
          )}
          {section?.sectionKey === 'testing' && (
            <Button variant="ghost" size="sm" onClick={fetchTestScenarios} disabled={testsLoading || aiLoading} leftIcon={<TestTube2 className="h-3.5 w-3.5" />}>
              {testsLoading ? 'Generating…' : 'Generate test scenarios'}
            </Button>
          )}
          <select
            value={aiMode}
            onChange={(e) => setAiMode(e.target.value as typeof aiMode)}
            title="AI suggestion mode"
            aria-label="AI suggestion mode"
            className="h-8 rounded-md border border-border/60 bg-card/40 px-2 text-xs text-muted-foreground outline-none focus:border-primary/50"
          >
            <option value="draft">Draft</option>
            <option value="improve">Improve</option>
            <option value="steps">Steps</option>
            <option value="test">Test</option>
            <option value="comms">Comms</option>
            <option value="escalation">Escalation</option>
          </select>
          <Button variant="ghost" size="sm" onClick={suggestWithAI} disabled={aiLoading} leftIcon={<Sparkles className="h-3.5 w-3.5" />}>
            {aiLoading ? 'AI drafting…' : 'AI Suggest'}
          </Button>
          <Button variant="primary" size="sm" onClick={saveSection} leftIcon={<Save className="h-3.5 w-3.5" />}>Save</Button>
        </div>
      </div>
      <MarkdownEditor
        value={draft}
        onChange={updateDraft}
        onSave={saveSection}
        autoSaveDelayMs={30000}
        minHeight={480}
        onAiAssist={suggestWithAI}
        aiLoading={aiLoading}
        snippets={SECTION_SNIPPETS}
        completionSignals={getCompletionSignals(section)}
        ariaLabel={`${section?.title} markdown editor`}
      />
    </div>

    {aiSuggestion && <div className="surface-glow p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> AI suggestion</h2>
          <p className="text-xs text-muted-foreground">Review before applying. AI output is draft-only until saved.</p>
        </div>
        <Button variant="primary" size="sm" onClick={applyAISuggestion}>Apply to draft</Button>
      </div>
      <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-sm">{aiSuggestion}</pre>
    </div>}

    {quality && <div className="surface surface-lift p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">DRP Quality Score</h2>
          <p className="text-xs text-muted-foreground">Completeness, approval, ownership, targets, evidence, and freshness.</p>
        </div>
        <div className="text-right"><div className="text-3xl font-bold">{quality.score}</div><StatusBadge status={quality.status} /></div>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-2">{quality.signals.map((signal) => <div key={signal.key} className={`rounded-lg border p-3 text-sm ${signal.passed ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}><div className="font-medium">{signal.passed ? '✓' : '△'} {signal.label} <span className="text-xs opacity-70">({signal.weight})</span></div><p className="mt-1 text-xs text-muted-foreground">{signal.detail}</p></div>)}</div>
    </div>}

    <div className="surface surface-lift p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Evidence attachments</h2>
          <p className="text-xs text-muted-foreground">Link proof such as drill report, topology, backup evidence, or approval memo.</p>
        </div>
        <StatusBadge status={`${evidence.length} linked`} />
      </div>
      <form onSubmit={addEvidence} className="mt-4 grid gap-2 md:grid-cols-4">
        <Input name="title" label="Title" required />
        <Input name="evidenceUrl" label="URL/path" required />
        <Input name="evidenceType" label="Type" defaultValue="link" />
        <Input name="notes" label="Notes" />
        <div className="md:col-span-4"><Button type="submit" variant="primary" size="sm">Add evidence</Button></div>
      </form>
      <div className="mt-4 space-y-2">
        {evidence.length === 0 ? (
          <EmptyState icon={<FileText className="h-5 w-5" />} title="No evidence linked yet" description="Add proof links above to strengthen this DRP." />
        ) : evidence.map((item) => (
          <div key={item.id} className="rounded-lg border p-3 text-sm">
            <div className="font-medium"><a href={item.evidenceUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">{item.title}</a></div>
            <div className="text-xs text-muted-foreground">{item.evidenceType} · {item.sectionKey ?? 'plan'} · {new Date(item.createdAt).toLocaleString()}</div>
            {item.notes && <p className="mt-1 text-xs">{item.notes}</p>}
          </div>
        ))}
      </div>
    </div>

    <div className="surface surface-lift p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Section comments</h2>
          <p className="text-xs text-muted-foreground">Use @email format to mention a reviewer. Replies stay linked to the parent comment.</p>
        </div>
        <StatusBadge status={`${currentComments.filter((comment) => comment.status === 'open').length} open`} />
      </div>
      {replyTo && <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 p-2 text-xs text-blue-700">Replying to comment {replyTo.slice(0, 8)}… <button onClick={() => setReplyTo(null)} className="ml-2 underline">cancel</button></div>}
      <div className="mt-3 flex gap-2">
        <input value={commentBody} onChange={(e) => setCommentBody(e.target.value)} placeholder="Add review note, reply, or @reviewer@datacomm.co.id" className="input flex-1" />
        <Button variant="primary" size="sm" onClick={addComment}>{replyTo ? 'Add reply' : 'Add comment'}</Button>
      </div>
      <div className="mt-4 space-y-2">
        {currentComments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No comments for this section yet.</p>
        ) : currentComments.map((comment) => (
          <div key={comment.id} className={`rounded-lg border p-3 text-sm ${comment.parentCommentId ? 'ml-6 bg-muted/30' : ''}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p>{comment.body}</p>
                {comment.parentCommentId && <p className="mt-1 text-xs text-muted-foreground">Reply to {comment.parentCommentId.slice(0, 8)}…</p>}
                {comment.mentionedEmails && comment.mentionedEmails.length > 0 && <p className="mt-1 text-xs text-blue-700">Mentions: {comment.mentionedEmails.join(', ')}</p>}
              </div>
              <StatusBadge status={comment.status} />
            </div>
            <div className="mt-2 flex gap-3">
              {comment.status === 'open' && <button onClick={() => resolveComment(comment.id)} className="text-xs text-primary hover:underline">Mark resolved</button>}
              <button onClick={() => setReplyTo(comment.id)} className="text-xs text-muted-foreground hover:underline">Reply</button>
            </div>
          </div>
        ))}
      </div>
    </div>

    <div className="surface surface-lift p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Version history</h2>
          <p className="text-xs text-muted-foreground">Create snapshots before major changes and rollback when needed.</p>
        </div>
        <Button variant="primary" size="sm" onClick={createVersion}>Create snapshot</Button>
      </div>
      <div className="mt-4 space-y-2">
        {versions.length === 0 ? (
          <EmptyState icon={<FileText className="h-5 w-5" />} title="No snapshots yet" description="Create a snapshot to enable rollback." />
        ) : versions.map((version) => (
          <div key={version.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
            <div>
              <span className="font-medium">Version {version.version}</span>
              <span className="ml-2 text-muted-foreground">{version.changeSummary}</span>
              <p className="text-xs text-muted-foreground">{new Date(version.createdAt).toLocaleString()}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setRollbackTarget(version)}>Rollback</Button>
          </div>
        ))}
      </div>
    </div>

    <div className="flex flex-wrap gap-2">
      <DownloadLink href={`/api/v1/plans/${plan.id}/export/markdown`} label="Markdown" />
      <DownloadLink href={`/api/v1/plans/${plan.id}/export/pdf`} label="PDF" />
      <DownloadLink href={`/api/v1/plans/${plan.id}/export/docx`} label="DOCX" />
      <DownloadLink href={`/api/v1/plans/${plan.id}/audit.csv`} label="Audit CSV" />
    </div>

    {/* Approve modal */}
    <Modal
      open={approveOpen}
      onClose={() => { setApproveOpen(false); setSignatureText(''); }}
      title="Approve and sign DR plan"
      description="Signing makes this plan the active baseline. You can create a new version later to supersede it."
      size="md"
      footer={
        <>
          <Button variant="ghost" size="md" onClick={() => { setApproveOpen(false); setSignatureText(''); }}>Cancel</Button>
          <Button variant="primary" size="md" onClick={confirmApprove} disabled={!signatureText.trim()}>Sign and approve</Button>
        </>
      }
    >
      <label className="text-sm font-medium">Signature text</label>
      <input value={signatureText} onChange={(e) => setSignatureText(e.target.value)} placeholder="e.g. Erwin Alifiansyah — Head of IT Service Resilience" className="input mt-1.5" autoFocus />
      <p className="mt-2 text-xs text-muted-foreground">This signature is stored in the audit trail with timestamp and your account identity.</p>
    </Modal>

    {/* Rollback modal */}
    <Modal
      open={rollbackTarget !== null}
      onClose={() => setRollbackTarget(null)}
      title={rollbackTarget ? `Rollback to version ${rollbackTarget.version}?` : 'Rollback?'}
      description="This will replace the current plan content with the selected version. Other versions are not affected."
      size="md"
      footer={
        <>
          <Button variant="ghost" size="md" onClick={() => setRollbackTarget(null)}>Cancel</Button>
          <Button variant="primary" size="md" onClick={confirmRollback}>Confirm rollback</Button>
        </>
      }
    >
      {rollbackTarget && (
        <div className="rounded-lg border bg-muted/40 p-3 text-sm">
          <div className="font-medium">Version {rollbackTarget.version}</div>
          <div className="text-xs text-muted-foreground">{rollbackTarget.changeSummary}</div>
          <div className="text-xs text-muted-foreground">{new Date(rollbackTarget.createdAt).toLocaleString()}</div>
        </div>
      )}
    </Modal>

    {/* Strategy advisor modal */}
    <Modal
      open={strategyOpen}
      onClose={() => setStrategyOpen(false)}
      title="AI recovery strategy advisor"
      description="Reads your service, RTO, RPO, criticality. Recommends primary + secondary strategy with rationale, infrastructure, and tradeoffs."
      size="lg"
      footer={
        <>
          <Button variant="ghost" size="md" onClick={() => setStrategyOpen(false)}>Close</Button>
          <Button variant="primary" size="md" onClick={applyStrategy} disabled={!strategyResult} leftIcon={<Sparkles className="h-3.5 w-3.5" />}>Apply to plan</Button>
        </>
      }
    >
      {strategyLoading && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm text-primary">
          <Sparkles className="h-4 w-4 anim-pulse-soft" />
          <span>Asking AI architect to recommend a strategy…</span>
        </div>
      )}
      {strategyError && <ErrorBox message={strategyError} />}
      {strategyResult && (() => {
        const rec = strategyResult.recommendation;
        const list = (k: string) => ((rec[k] as unknown[] | undefined) ?? []).map((s) => String(s));
        return (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border bg-card/40 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Primary strategy</div>
                <div className="mt-1 text-base font-bold text-primary">{String(rec.primaryStrategy ?? 'unknown')}</div>
              </div>
              <div className="rounded-lg border bg-card/40 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Secondary / fallback</div>
                <div className="mt-1 text-base font-bold text-muted-foreground">{String(rec.secondaryStrategy ?? '—')}</div>
              </div>
              <div className="rounded-lg border bg-card/40 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Estimated cost</div>
                <div className="mt-1 text-sm font-semibold">{String(rec.estimatedCostTier ?? '—')} · {String(rec.monthlyCostRangeUSD ?? '—')}</div>
              </div>
              <div className="rounded-lg border bg-card/40 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Achievable RTO / RPO</div>
                <div className="mt-1 text-sm font-semibold">{String(rec.estimatedRtoMinutes ?? '?')}m / {String(rec.estimatedRpoMinutes ?? '?')}m</div>
              </div>
            </div>
            {Boolean(rec.rationale) ? (
              <div className="rounded-lg border bg-card/40 p-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rationale</h4>
                <p className="mt-1 text-sm leading-relaxed">{String(rec.rationale ?? '')}</p>
                {Boolean(rec.rtoRpoFit) ? <p className="mt-2 text-xs text-muted-foreground">RTO/RPO fit: {String(rec.rtoRpoFit)}</p> : null}
              </div>
            ) : null}
            {list('infrastructureNeeded').length > 0 && (
              <div className="rounded-lg border bg-card/40 p-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Infrastructure needed</h4>
                <ul className="mt-1 ml-4 list-disc space-y-0.5 text-sm">
                  {list('infrastructureNeeded').map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            )}
            {list('prerequisites').length > 0 && (
              <div className="rounded-lg border bg-card/40 p-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Prerequisites</h4>
                <ul className="mt-1 ml-4 list-disc space-y-0.5 text-sm">
                  {list('prerequisites').map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            )}
            {list('tradeoffs').length > 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">Tradeoffs</h4>
                <ul className="mt-1 ml-4 list-disc space-y-0.5 text-sm">
                  {list('tradeoffs').map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            )}
          </div>
        );
      })()}
    </Modal>
  </div>;
}

function SecurityPage({ user, onUserUpdate }: { user: User; onUserUpdate: (user: User) => void }) {
  const [secret, setSecret] = useState('');
  const [otpauthUrl, setOtpauthUrl] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  async function setupMfa() {
    setError(''); setLoading(true);
    try {
      const data = await api<{ secret: string; otpauthUrl: string }>('/api/v1/auth/mfa/setup', { method: 'POST' });
      setSecret(data.secret);
      setOtpauthUrl(data.otpauthUrl);
      toast.info('MFA secret generated', { description: 'Add it to your authenticator app, then verify the 6-digit code.' });
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to setup MFA'); }
    finally { setLoading(false); }
  }

  async function verifyMfa() {
    if (!token.trim()) return;
    setError(''); setLoading(true);
    try {
      await api('/api/v1/auth/mfa/verify', { method: 'POST', body: JSON.stringify({ token }) });
      onUserUpdate({ ...user, mfaEnabled: true });
      setToken('');
      toast.success('MFA enabled', { description: 'Next login will require your TOTP token.' });
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to verify MFA'); }
    finally { setLoading(false); }
  }

  return <div className="space-y-6">
    <PageHeader
      eyebrow={<>System · Security</>}
      title="Security Settings"
      description="Admin MFA hardening for Phase 1. TOTP-based 2FA protects the single admin account from credential theft."
      breadcrumbs={[{ label: 'Security' }]}
    />
    {error && <ErrorBox message={error} />}
    <div className="surface surface-lift p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Multi-factor authentication</h2>
          <p className="text-sm text-muted-foreground">Status: {user.mfaEnabled ? 'enabled' : 'not enabled'}</p>
        </div>
        <StatusBadge status={user.mfaEnabled ? 'approved' : 'draft'} />
      </div>
      <div className="mt-5 space-y-4">
        <Button variant="primary" size="md" onClick={setupMfa} disabled={loading} leftIcon={<Lock className="h-4 w-4" />}>{loading ? 'Generating…' : 'Generate MFA secret'}</Button>
        {secret && <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
          <div><p className="text-sm font-medium">Manual secret</p><code className="mt-2 block break-all rounded bg-white p-2 text-xs">{secret}</code></div>
          <div><p className="text-sm font-medium">OTP Auth URL</p><code className="mt-2 block break-all rounded bg-white p-2 text-xs">{otpauthUrl}</code></div>
          <div className="flex gap-2">
            <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="6-digit code" className="input w-40" />
            <Button variant="primary" size="md" onClick={verifyMfa} disabled={loading || !token.trim()} leftIcon={<CheckCircle2 className="h-4 w-4" />}>Verify & Enable</Button>
          </div>
        </div>}
      </div>
    </div>
  </div>;
}

function BiaPage() {
  const [entries, setEntries] = useState<BiaEntry[]>([]);
  const [summary, setSummary] = useState<BiaSummary | null>(null);
  const [alignment, setAlignment] = useState<BiaDrpAlignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<string[][]>([]);
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);
  const toast = useToast();
  async function load() {
    setLoading(true);
    try {
      const data = await api<{ entries: BiaEntry[]; summary: BiaSummary }>('/api/v1/bia');
      const alignmentData = await api<BiaDrpAlignment>('/api/v1/bia/drp-alignment');
      setEntries(data.entries); setSummary(data.summary); setAlignment(alignmentData);
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to load BIA'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      await api<BiaEntry>('/api/v1/bia', { method: 'POST', body: JSON.stringify({ serviceName: data.get('serviceName'), processName: data.get('processName'), owner: data.get('owner'), impact1h: Number(data.get('impact1h')), impact4h: Number(data.get('impact4h')), impact24h: Number(data.get('impact24h')), financialImpact: Number(data.get('financialImpact')), reputationalImpact: Number(data.get('reputationalImpact')), regulatoryImpact: Number(data.get('regulatoryImpact')), currentRtoMinutes: Number(data.get('currentRtoMinutes')), currentRpoMinutes: Number(data.get('currentRpoMinutes')), dependencyNotes: data.get('dependencyNotes'), workaround: data.get('workaround') }) });
      form.reset(); await load();
      toast.success('BIA entry added');
    } catch (err) { setError(err instanceof Error ? err.message : 'Create BIA failed'); }
  }
  async function runAiAnalysis() {
    if (entries.length === 0) { toast.warning('Add at least one BIA entry first'); return; }
    setAiLoading(true); setAiResult(''); setError('');
    try {
      const res = await api<{ analysis: string }>('/api/v1/ai/analyze-bia', { method: 'POST', body: JSON.stringify({ biaEntries: entries.map((entry) => ({ id: entry.id, process: entry.processName, impact1h: entry.impact1h, impact4h: entry.impact4h, impact24h: entry.impact24h, financialImpact: entry.financialImpact, reputationImpact: entry.reputationalImpact, regulatoryImpact: entry.regulatoryImpact })) }) });
      setAiResult(res.analysis);
      toast.success('BIA analysis complete', { description: `${entries.length} processes reviewed.` });
    } catch (err) { setError(err instanceof Error ? err.message : 'AI analysis failed'); toast.error('AI analysis failed', { description: err instanceof Error ? err.message : 'Unknown error' }); }
    finally { setAiLoading(false); }
  }
  async function addFromTemplate(template: typeof BIA_PROCESS_TEMPLATES[number]) {
    try {
      await api<BiaEntry>('/api/v1/bia', { method: 'POST', body: JSON.stringify({
        serviceName: template.serviceName, processName: template.name, owner: 'TBA',
        impact1h: template.impactOperational, impact4h: Math.max(template.impactOperational - 1, 1), impact24h: Math.max(template.impactOperational - 2, 1),
        financialImpact: template.impactFinancial, reputationalImpact: template.impactReputation, regulatoryImpact: template.impactRegulatory,
        currentRtoMinutes: template.rtoMinutes, currentRpoMinutes: template.rpoMinutes,
        dependencyNotes: '', workaround: template.workaround,
      }) });
      await load();
      toast.success('BIA entry added from template', { description: template.name });
    } catch (err) {
      toast.error('Failed to add template', { description: err instanceof Error ? err.message : 'Unknown error' });
    }
  }
  function handleCsvFile(file: File) {
    setImportError(''); setImportPreview([]);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || '');
        const rows = parseCsv(text);
        if (rows.length < 2) { setImportError('CSV must have a header row and at least one data row.'); return; }
        const header = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, ''));
        const required = ['processname', 'service', 'rto', 'rpo'];
        const missing = required.filter((r) => !header.includes(r));
        if (missing.length) { setImportError(`Missing required columns: ${missing.join(', ')}`); return; }
        setImportPreview(rows);
      } catch (err) { setImportError(err instanceof Error ? err.message : 'Failed to parse CSV'); }
    };
    reader.onerror = () => setImportError('Failed to read file');
    reader.readAsText(file);
  }
  async function commitImport() {
    if (importPreview.length < 2) return;
    setImporting(true); setError('');
    let successCount = 0; let failCount = 0;
    const header = importPreview[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, ''));
    const col = (name: string) => header.indexOf(name);
    for (let i = 1; i < importPreview.length; i++) {
      const row = importPreview[i];
      const payload: Record<string, unknown> = {
        processName: row[col('processname')] || '',
        serviceName: row[col('service')] || 'unassigned',
        owner: row[col('owner')] || 'TBA',
        impact1h: Number(row[col('impact1h')] || 3),
        impact4h: Number(row[col('impact4h')] || 4),
        impact24h: Number(row[col('impact24h')] || 5),
        financialImpact: Number(row[col('financial')] || 3),
        reputationalImpact: Number(row[col('reputation')] || 3),
        regulatoryImpact: Number(row[col('regulatory')] || 3),
        currentRtoMinutes: Number(row[col('rto')] || 240),
        currentRpoMinutes: Number(row[col('rpo')] || 60),
        dependencyNotes: row[col('dependencies')] || '',
        workaround: row[col('workaround')] || '',
      };
      try {
        await api<BiaEntry>('/api/v1/bia', { method: 'POST', body: JSON.stringify(payload) });
        successCount++;
      } catch { failCount++; }
    }
    setImporting(false);
    setImportOpen(false);
    setImportPreview([]);
    await load();
    if (successCount > 0) toast.success(`Imported ${successCount} BIA entries`, { description: failCount > 0 ? `${failCount} failed (see logs)` : 'all rows saved' });
    else toast.error('Import failed', { description: 'No rows could be saved' });
  }
  const expectedProcesses = 15; // heuristic: at least 15 for healthy BIA
  const biaPercent = Math.min(100, Math.round((entries.length / expectedProcesses) * 100));
  return <div className="space-y-6">
    <PageHeader
      eyebrow={<>Resilience · BIA</>}
      title="Business Impact Analysis"
      description="Map processes to RTO/RPO targets, tier classification, and impact windows. Auto-aligned to DR plans."
      breadcrumbs={[{ label: 'BIA' }]}
      actions={
        <>
          <Button variant="ghost" size="md" onClick={() => setImportOpen(true)} leftIcon={<Upload className="h-3.5 w-3.5" />}>Import CSV</Button>
          <Button variant="primary" size="md" onClick={() => setTemplatesOpen(true)} leftIcon={<Wand2 className="h-3.5 w-3.5" />}>Add from template</Button>
        </>
      }
    />
    {error && <ErrorBox message={error} />}
    {loading ? <SkeletonList rows={5} /> : <>
      <div className="surface surface-lift p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">BIA coverage</h3>
            <p className="text-xs text-muted-foreground">{entries.length} processes mapped · target {expectedProcesses}+ for healthy coverage</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-40 overflow-hidden rounded-full bg-muted/60">
              <div className={`h-full rounded-full transition-all duration-500 ${biaPercent >= 80 ? 'bg-emerald-500' : biaPercent >= 40 ? 'bg-amber-500' : 'bg-destructive'}`} style={{ width: `${biaPercent}%` }} />
            </div>
            <span className="text-sm font-bold tabular-nums">{biaPercent}%</span>
          </div>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Total BIA" value={`${summary?.totalBia ?? 0}`} hint="Processes" tone="primary" />
        <KpiCard label="Tier 1" value={`${summary?.tier1 ?? 0}`} hint="Most critical" tone="warning" />
        <KpiCard label="Tier 2" value={`${summary?.tier2 ?? 0}`} hint="High impact" tone="info" />
        <KpiCard label="Fastest RTO" value={summary?.fastestRtoMinutes ? `${summary.fastestRtoMinutes}m` : '-'} hint="Lowest target" tone="primary" />
        <KpiCard label="Fastest RPO" value={summary?.fastestRpoMinutes ? `${summary.fastestRpoMinutes}m` : '-'} hint="Lowest target" tone="primary" />
      </div>
      <div className="surface surface-lift p-5">
        <div className="flex items-center justify-between">
          <div><h2 className="font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> AI BIA analysis</h2><p className="text-xs text-muted-foreground">Reviews tier classification, suggests RTO/RPO targets, and ranks recovery sequence.</p></div>
          <Button variant="primary" size="sm" onClick={runAiAnalysis} disabled={aiLoading || entries.length === 0} leftIcon={<Sparkles className="h-3.5 w-3.5" />}>{aiLoading ? 'Analyzing…' : 'Run analysis'}</Button>
        </div>
        {aiResult ? <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-sm">{aiResult}</pre> : <p className="mt-3 text-xs text-muted-foreground">Click Run analysis to get AI recommendations across all BIA entries.</p>}
      </div>
      {alignment && <div className="surface surface-lift p-5">
        <div className="flex items-center justify-between">
          <div><h2 className="font-semibold">BIA ↔ DRP alignment</h2><p className="text-xs text-muted-foreground">Flags missing DRP or RTO/RPO targets weaker than BIA.</p></div>
          <StatusBadge status={`${alignment.summary.missingDrp + alignment.summary.rtoGaps + alignment.summary.rpoGaps} gaps`} />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <KpiCard label="Aligned" value={`${alignment.summary.aligned}`} hint="BIA rows covered" tone="success" />
          <KpiCard label="Missing DRP" value={`${alignment.summary.missingDrp}`} hint="No plan yet" tone="warning" />
          <KpiCard label="RTO Gaps" value={`${alignment.summary.rtoGaps}`} hint="DRP too slow" tone="warning" />
          <KpiCard label="RPO Gaps" value={`${alignment.summary.rpoGaps}`} hint="DRP data loss" tone="warning" />
        </div>
      </div>}
      <form onSubmit={submit} className="surface surface-lift grid gap-3 p-5 md:grid-cols-3">
        <Input name="serviceName" label="Service" required />
        <Input name="processName" label="Process" required />
        <Input name="owner" label="Owner" required />
        <Input name="impact1h" label="Impact 1h (1-5)" type="number" min="1" max="5" defaultValue="3" required />
        <Input name="impact4h" label="Impact 4h (1-5)" type="number" min="1" max="5" defaultValue="4" required />
        <Input name="impact24h" label="Impact 24h (1-5)" type="number" min="1" max="5" defaultValue="5" required />
        <Input name="financialImpact" label="Financial (1-5)" type="number" min="1" max="5" defaultValue="3" required />
        <Input name="reputationalImpact" label="Reputation (1-5)" type="number" min="1" max="5" defaultValue="3" required />
        <Input name="regulatoryImpact" label="Regulatory (1-5)" type="number" min="1" max="5" defaultValue="3" required />
        <Input name="currentRtoMinutes" label="RTO minutes" type="number" defaultValue="240" required />
        <Input name="currentRpoMinutes" label="RPO minutes" type="number" defaultValue="60" required />
        <Input name="dependencyNotes" label="Dependencies" placeholder="comma separated" />
        <label className="text-sm font-medium md:col-span-3">Workaround<textarea name="workaround" className="input mt-1 h-20" /></label>
        <div className="md:col-span-3"><Button type="submit" variant="primary" size="md">Add BIA entry</Button></div>
      </form>
      {entries.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title="No BIA entries yet"
          description="Map critical business processes with impact windows and RTO/RPO targets. Start with a template or import a CSV."
          action={<div className="flex gap-2"><Button variant="ghost" onClick={() => setImportOpen(true)}>Import CSV</Button><Button variant="primary" onClick={() => setTemplatesOpen(true)}>Add from template</Button></div>}
        />
      ) : (
        <div className="surface surface-lift">
          <div className="border-b p-4 font-semibold">BIA register</div>
          <div className="divide-y">
            {entries.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{entry.processName}</div>
                  <div className="text-muted-foreground">{entry.serviceName} · RTO {entry.currentRtoMinutes}m · RPO {entry.currentRpoMinutes}m · owner {entry.owner}</div>
                </div>
                <StatusBadge status={entry.criticalityTier === 'tier_1' ? 'in_review' : entry.criticalityTier === 'tier_2' ? 'draft' : 'approved'} label={entry.criticalityTier} />
              </div>
            ))}
          </div>
        </div>
      )}
    </>}

    <Modal open={templatesOpen} onClose={() => setTemplatesOpen(false)} title="BIA process templates" description="Pick a common service to pre-fill RTO/RPO/tier/impact values. You can adjust after." size="lg">
      <div className="grid gap-2 sm:grid-cols-2">
        {BIA_PROCESS_TEMPLATES.map((t) => (
          <button
            key={t.serviceName}
            type="button"
            onClick={() => { void addFromTemplate(t); }}
            className="rounded-lg border bg-card p-3 text-left transition-all hover:border-primary/40 hover:bg-muted/40"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{t.name}</div>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{t.description}</p>
              </div>
              <StatusBadge status={t.tier === 'tier_1' ? 'in_review' : t.tier === 'tier_2' ? 'draft' : 'approved'} label={t.tier} />
            </div>
            <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground">
              <span>RTO {t.rtoMinutes}m</span>
              <span>RPO {t.rpoMinutes}m</span>
              <span>Op {t.impactOperational}/5</span>
              <span>Fin {t.impactFinancial}/5</span>
            </div>
          </button>
        ))}
      </div>
      <div className="mt-4 flex justify-end">
        <Button variant="ghost" size="md" onClick={() => setTemplatesOpen(false)}>Done</Button>
      </div>
    </Modal>

    <Modal open={importOpen} onClose={() => { setImportOpen(false); setImportPreview([]); setImportError(''); }} title="Import BIA from CSV" description="Header must include: process name, service, RTO, RPO. Optional: owner, impact 1h/4h/24h, financial, reputation, regulatory, dependencies, workaround." size="lg">
      <div className="space-y-3">
        <div className="rounded-lg border-2 border-dashed border-border/60 bg-card/40 p-6 text-center">
          <Upload className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-2 text-sm">Drop or select a CSV file</p>
          <p className="text-xs text-muted-foreground">UTF-8 · first row is header</p>
          <input
            type="file"
            accept=".csv,text/csv"
            className="mt-3 block w-full text-xs file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:text-primary-foreground hover:file:bg-primary/90"
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              if (file) handleCsvFile(file);
            }}
          />
          <a href={`data:text/csv;charset=utf-8,${encodeURIComponent('process name,service,owner,RTO,RPO,impact 1h,impact 4h,impact 24h,financial,reputation,regulatory,dependencies,workaround\nPrimary OLTP database,db-primary,Data team,60,5,5,5,5,5,5,4,redis+object storage,read replica promotion')}`} download="bia-template.csv" className="mt-2 inline-block text-xs text-primary underline">Download template</a>
        </div>
        {importError && <ErrorBox message={importError} />}
        {importPreview.length > 1 && (
          <div className="rounded-lg border bg-card/40 p-3">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-semibold">Preview ({importPreview.length - 1} rows)</h4>
              <Button variant="primary" size="sm" onClick={() => void commitImport()} disabled={importing}>{importing ? 'Importing…' : `Import ${importPreview.length - 1} entries`}</Button>
            </div>
            <div className="max-h-60 overflow-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-[10px] uppercase text-muted-foreground">
                  <tr>{importPreview[0].map((h, i) => <th key={i} className="p-2 text-left">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {importPreview.slice(1, 11).map((row, i) => (
                    <tr key={i} className="border-t">
                      {row.map((c, j) => <td key={j} className="p-2 align-top">{c}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
              {importPreview.length - 1 > 10 && <p className="mt-2 text-xs text-muted-foreground">… and {importPreview.length - 11} more rows</p>}
            </div>
          </div>
        )}
      </div>
    </Modal>
  </div>;
}

function AssetsPage() {
  const [assets, setAssets] = useState<ServiceAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const toast = useToast();
  async function load() {
    setLoading(true);
    try { setAssets((await api<{ assets: ServiceAsset[] }>('/api/v1/assets')).assets); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to load assets'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      await api<ServiceAsset>('/api/v1/assets', { method: 'POST', body: JSON.stringify({ serviceName: data.get('serviceName'), assetName: data.get('assetName'), assetType: data.get('assetType'), owner: data.get('owner'), criticality: data.get('criticality'), recoveryPriority: Number(data.get('recoveryPriority')), dependencies: String(data.get('dependencies') ?? '').split(',').map((item) => item.trim()).filter(Boolean), notes: data.get('notes') }) });
      form.reset(); await load();
      toast.success('Asset registered', { description: String(data.get('assetName')) });
    } catch (err) { setError(err instanceof Error ? err.message : 'Create asset failed'); }
  }
  async function runAiStrategy() {
    if (assets.length === 0) { toast.warning('Add at least one asset first'); return; }
    setAiLoading(true); setAiResult(''); setError('');
    try {
      const res = await api<{ strategies: string }>('/api/v1/ai/recovery-strategy', { method: 'POST', body: JSON.stringify({ assets: assets.map((asset) => ({ id: asset.id, name: asset.assetName, type: asset.assetType, criticality: asset.criticality })) }) });
      setAiResult(res.strategies);
      toast.success('Recovery strategies generated');
    } catch (err) { setError(err instanceof Error ? err.message : 'AI strategy suggestion failed'); toast.error('AI strategy failed'); }
    finally { setAiLoading(false); }
  }
  return <div className="space-y-6">
    <PageHeader eyebrow={<>Resilience · Assets</>} title="Asset Register" description="Service dependency and recovery-priority register. Track which assets are critical to which service and their order of recovery." breadcrumbs={[{ label: 'Assets' }]} />
    {error && <ErrorBox message={error} />}
    {loading ? <SkeletonList rows={4} /> : <>
      <div className="surface surface-lift p-5">
        <div className="flex items-center justify-between">
          <div><h2 className="font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> AI recovery strategy</h2><p className="text-xs text-muted-foreground">Suggest hot/warm/cold strategy, infrastructure, and procedure outline per asset.</p></div>
          <Button variant="primary" size="sm" onClick={runAiStrategy} disabled={aiLoading || assets.length === 0} leftIcon={<Sparkles className="h-3.5 w-3.5" />}>{aiLoading ? 'Drafting…' : 'Suggest strategies'}</Button>
        </div>
        {aiResult ? <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-sm">{aiResult}</pre> : <p className="mt-3 text-xs text-muted-foreground">Add at least one asset to get AI-suggested recovery strategies.</p>}
      </div>
      <form onSubmit={submit} className="surface surface-lift grid gap-3 p-5 md:grid-cols-3">
        <Input name="serviceName" label="Service" required />
        <Input name="assetName" label="Asset name" required />
        <Input name="assetType" placeholder="database / vm / network" required label="Asset type" />
        <Input name="owner" label="Owner" required />
        <Input name="recoveryPriority" label="Recovery priority" type="number" min="1" max="5" defaultValue="3" required />
        <label className="text-sm font-medium">Criticality<select name="criticality" defaultValue="high" className="input mt-1"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label>
        <Input name="dependencies" label="Dependencies" placeholder="comma separated" />
        <label className="text-sm font-medium md:col-span-2">Notes<textarea name="notes" className="input mt-1 h-20" /></label>
        <div className="md:col-span-3"><Button type="submit" variant="primary" size="md">Add asset</Button></div>
      </form>
      {assets.length === 0 ? (
        <EmptyState icon={<Server className="h-8 w-8" />} title="No assets registered" description="Add infrastructure assets, dependencies, and recovery priority." />
      ) : (
        <div className="surface surface-lift">
          <div className="border-b p-4 font-semibold">Asset register</div>
          <div className="divide-y">
            {assets.map((asset) => (
              <div key={asset.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{asset.assetName}</div>
                  <div className="text-muted-foreground">{asset.serviceName} · {asset.assetType} · priority {asset.recoveryPriority} · {asset.owner}</div>
                  {asset.dependencies && asset.dependencies.length > 0 && <div className="text-xs text-muted-foreground">Depends on: {asset.dependencies.join(', ')}</div>}
                </div>
                <StatusBadge status={asset.criticality === 'critical' ? 'in_review' : asset.criticality === 'high' ? 'draft' : 'approved'} label={asset.criticality} />
              </div>
            ))}
          </div>
        </div>
      )}
    </>}
  </div>;
}

function RisksPage() {
  const [risks, setRisks] = useState<ServiceRisk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const toast = useToast();
  async function load() {
    setLoading(true);
    try { setRisks((await api<{ risks: ServiceRisk[] }>('/api/v1/risks')).risks); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to load risks'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      await api<ServiceRisk>('/api/v1/risks', { method: 'POST', body: JSON.stringify({ serviceName: data.get('serviceName'), riskTitle: data.get('riskTitle'), category: data.get('category'), probability: Number(data.get('probability')), impact: Number(data.get('impact')), owner: data.get('owner'), mitigation: data.get('mitigation') }) });
      form.reset(); await load();
      toast.success('Risk added');
    } catch (err) { setError(err instanceof Error ? err.message : 'Create risk failed'); }
  }
  async function runAiMitigation() {
    if (risks.length === 0) { toast.warning('Add at least one risk first'); return; }
    setAiLoading(true); setAiResult(''); setError('');
    try {
      const res = await api<{ recommendations: string }>('/api/v1/ai/risk-mitigation', { method: 'POST', body: JSON.stringify({ risks: risks.map((risk) => ({ id: risk.id, description: `${risk.riskTitle} (${risk.category})`, probability: risk.probability, impact: risk.impact, riskScore: risk.riskScore })) }) });
      setAiResult(res.recommendations);
      toast.success('AI mitigations generated');
    } catch (err) { setError(err instanceof Error ? err.message : 'AI mitigation failed'); toast.error('AI mitigation failed'); }
    finally { setAiLoading(false); }
  }
  return <div className="space-y-6">
    <PageHeader eyebrow={<>Resilience · Risks</>} title="Risk Register" description="Probability × impact risk register tied to DR readiness. AI ranks mitigations and assigns priority." breadcrumbs={[{ label: 'Risks' }]} />
    {error && <ErrorBox message={error} />}
    {loading ? <SkeletonList rows={4} /> : <>
      <div className="surface surface-lift p-5">
        <div className="flex items-center justify-between">
          <div><h2 className="font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> AI mitigation recommendations</h2><p className="text-xs text-muted-foreground">Preventive, detective, corrective mitigations and priority per risk.</p></div>
          <Button variant="primary" size="sm" onClick={runAiMitigation} disabled={aiLoading || risks.length === 0} leftIcon={<Sparkles className="h-3.5 w-3.5" />}>{aiLoading ? 'Drafting…' : 'Recommend mitigations'}</Button>
        </div>
        {aiResult ? <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-sm">{aiResult}</pre> : <p className="mt-3 text-xs text-muted-foreground">Add risks to get AI-suggested mitigations.</p>}
      </div>
      <form onSubmit={submit} className="surface surface-lift grid gap-3 p-5 md:grid-cols-3">
        <Input name="serviceName" label="Service" required />
        <Input name="riskTitle" label="Risk title" required />
        <Input name="category" label="Category" required />
        <Input name="probability" label="Probability 1-5" type="number" min="1" max="5" defaultValue="3" required />
        <Input name="impact" label="Impact 1-5" type="number" min="1" max="5" defaultValue="4" required />
        <Input name="owner" label="Owner" />
        <label className="text-sm font-medium md:col-span-3">Mitigation<textarea name="mitigation" className="input mt-1 h-20" /></label>
        <div className="md:col-span-3"><Button type="submit" variant="primary" size="md">Add risk</Button></div>
      </form>
      {risks.length === 0 ? (
        <EmptyState icon={<AlertTriangle className="h-8 w-8" />} title="No risks logged" description="Identify, score, and assign mitigations to risks that could impact DR readiness." />
      ) : (
        <div className="surface surface-lift">
          <div className="border-b p-4 font-semibold">Risk register</div>
          <div className="divide-y">
            {risks.map((risk) => (
              <div key={risk.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{risk.riskTitle}</div>
                  <div className="text-muted-foreground">{risk.serviceName} · {risk.category} · score {risk.riskScore} · P{risk.probability} × I{risk.impact}</div>
                  {risk.mitigation && <div className="text-xs text-muted-foreground mt-1">Mitigation: {risk.mitigation}</div>}
                </div>
                <StatusBadge status={risk.riskScore >= 15 ? 'in_review' : risk.riskScore >= 8 ? 'draft' : 'approved'} label={risk.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </>}
  </div>;
}

function DrillsPage() {
  const [drills, setDrills] = useState<RecoveryDrill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [completeTarget, setCompleteTarget] = useState<RecoveryDrill | null>(null);
  const [resultSummary, setResultSummary] = useState('');
  const toast = useToast();
  async function load() {
    setLoading(true);
    try { setDrills((await api<{ drills: RecoveryDrill[] }>('/api/v1/drills')).drills); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to load drills'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      await api<RecoveryDrill>('/api/v1/drills', { method: 'POST', body: JSON.stringify({ serviceName: data.get('serviceName'), drillTitle: data.get('drillTitle'), scheduledAt: new Date(String(data.get('scheduledAt'))).toISOString(), scope: data.get('scope'), owner: data.get('owner') }) });
      form.reset(); await load();
      toast.success('Drill scheduled');
    } catch (err) { setError(err instanceof Error ? err.message : 'Create drill failed'); }
  }
  async function confirmComplete() {
    if (!completeTarget) return;
    const target = completeTarget;
    setCompleteTarget(null);
    try {
      await api<RecoveryDrill>(`/api/v1/drills/${target.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'completed', resultSummary: resultSummary || 'Completed successfully' }) });
      setResultSummary('');
      await load();
      toast.success('Drill marked complete', { description: target.drillTitle });
    } catch (err) { setError(err instanceof Error ? err.message : 'Update failed'); }
  }
  return <div className="space-y-6">
    <PageHeader eyebrow={<>Resilience · Drills</>} title="Recovery Drills" description="Recovery exercise calendar and result tracking. Schedule tabletop, simulation, or full failover tests." breadcrumbs={[{ label: 'Drills' }]} />
    {error && <ErrorBox message={error} />}
    {loading ? <SkeletonList rows={3} /> : <>
      <form onSubmit={submit} className="surface surface-lift grid gap-3 p-5 md:grid-cols-2">
        <Input name="serviceName" label="Service" required />
        <Input name="drillTitle" label="Drill title" required />
        <Input name="scheduledAt" label="Schedule" type="datetime-local" required />
        <Input name="owner" label="Owner" required />
        <label className="text-sm font-medium md:col-span-2">Scope<textarea name="scope" className="input mt-1 h-20" required /></label>
        <div className="md:col-span-2"><Button type="submit" variant="primary" size="md">Schedule drill</Button></div>
      </form>
      {drills.length === 0 ? (
        <EmptyState icon={<Calendar className="h-8 w-8" />} title="No drills scheduled" description="Schedule recovery exercises to validate your DR plan and team readiness." action={<Button variant="primary" size="md">Schedule first drill</Button>} />
      ) : (
        <div className="surface surface-lift">
          <div className="border-b p-4 font-semibold">Drill results</div>
          <div className="divide-y">
            {drills.map((drill) => <div key={drill.id} className="flex items-center justify-between gap-3 p-4 text-sm">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{drill.drillTitle}</div>
                <div className="text-muted-foreground">{drill.serviceName} · {new Date(drill.scheduledAt).toLocaleString()} · {drill.owner}</div>
                {drill.resultSummary && <p className="mt-1 text-xs text-muted-foreground">Result: {drill.resultSummary}</p>}
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={drill.status === 'completed' ? 'completed' : drill.status === 'in_progress' ? 'in_review' : 'queued'} />
                {drill.status !== 'completed' && <Button variant="ghost" size="sm" onClick={() => { setCompleteTarget(drill); setResultSummary(drill.resultSummary || 'Completed successfully'); }}>Mark completed</Button>}
              </div>
            </div>)}
          </div>
        </div>
      )}
    </>}
    <Modal open={completeTarget !== null} onClose={() => setCompleteTarget(null)} title="Complete drill" description="Add evidence notes and mark this drill as completed." size="md" footer={<><Button variant="ghost" size="md" onClick={() => setCompleteTarget(null)}>Cancel</Button><Button variant="primary" size="md" onClick={confirmComplete}>Mark complete</Button></>}>
      {completeTarget && <div className="space-y-3">
        <div className="rounded-lg border bg-muted/40 p-3 text-sm"><div className="font-medium">{completeTarget.drillTitle}</div><div className="text-xs text-muted-foreground">{completeTarget.serviceName} · {new Date(completeTarget.scheduledAt).toLocaleString()}</div></div>
        <label className="text-sm font-medium">Result / evidence notes</label>
        <textarea value={resultSummary} onChange={(e) => setResultSummary(e.target.value)} className="input mt-1 h-24" placeholder="What happened during the drill? Any gaps, action items, or evidence URLs?" />
      </div>}
    </Modal>
  </div>;
}

function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const toast = useToast();
  async function load() {
    setLoading(true);
    try { const data = await api<{ notifications: NotificationItem[]; unread: number }>('/api/v1/notifications'); setItems(data.notifications); setUnread(data.unread); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to load notifications'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  async function markRead(id: string) {
    try { await api<NotificationItem>(`/api/v1/notifications/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'read' }) }); await load(); }
    catch (err) { toast.error('Failed to mark read'); }
  }
  async function markAllRead() {
    const unreadItems = items.filter((i) => i.status === 'unread');
    for (const i of unreadItems) await api(`/api/v1/notifications/${i.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'read' }) });
    await load();
    toast.success(`${unreadItems.length} notifications marked read`);
  }
  return <div className="space-y-6">
    <PageHeader
      eyebrow={<>Governance · Notifications</>}
      title="Notifications"
      description={`${unread} unread operational notifications. Includes DR plan approvals, AI actions, system events.`}
      breadcrumbs={[{ label: 'Notifications' }]}
      actions={unread > 0 ? <Button variant="ghost" size="md" onClick={markAllRead}>Mark all read</Button> : undefined}
    />
    {error && <ErrorBox message={error} />}
    {loading ? <SkeletonList rows={4} /> : items.length === 0 ? (
      <EmptyState icon={<Bell className="h-8 w-8" />} title="No notifications" description="Operational events will appear here as your team works through DR plans and AI actions." />
    ) : (
      <div className="space-y-2">
        {items.map((item) => <div key={item.id} className="surface surface-lift p-4 text-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="font-medium">{item.title}</div>
              <div className="text-muted-foreground">{item.type} · {new Date(item.createdAt).toLocaleString()}</div>
              <p className="mt-2">{item.body}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <StatusBadge status={item.status === 'unread' ? 'queued' : 'resolved'} />
              {item.status === 'unread' && <Button variant="ghost" size="sm" onClick={() => markRead(item.id)}>Mark read</Button>}
            </div>
          </div>
        </div>)}
      </div>
    )}
  </div>;
}

function MonitoringPage() {
  const [summary, setSummary] = useState<MonitoringSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => { setLoading(true); api<MonitoringSummary>('/api/v1/monitoring/summary').then(setSummary).catch((err) => setError(err instanceof Error ? err.message : 'Failed to load monitoring')).finally(() => setLoading(false)); }, []);
  const trend = (base: number) => Array.from({ length: 6 }, (_, i) => Math.max(0, Math.round(base * (1 + (Math.random() - 0.5) * 0.3))));
  return <div className="space-y-6">
    <PageHeader eyebrow={<>Operations · Monitoring</>} title="System Monitoring" description="Live operational counters and runtime health. Tracks DRP volume, user activity, risk density, and drill coverage." breadcrumbs={[{ label: 'Monitoring' }]} />
    {error && <ErrorBox message={error} />}
    {loading ? <SkeletonList rows={3} /> : summary ? <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Plans" value={`${summary.counters.plans}`} hint="DRP total" tone="primary" spark={trend(summary.counters.plans)} />
        <KpiCard label="Users" value={`${summary.counters.users}`} hint="Tenant users" tone="info" spark={trend(summary.counters.users)} />
        <KpiCard label="Risks" value={`${summary.counters.risks}`} hint="Risk records" tone="warning" spark={trend(summary.counters.risks)} />
        <KpiCard label="Drills" value={`${summary.counters.drills}`} hint="Exercise records" tone="success" spark={trend(summary.counters.drills)} />
        <KpiCard label="Notifications" value={`${summary.counters.notifications}`} hint="Unread" tone="info" spark={trend(summary.counters.notifications)} />
      </div>
      <div className="surface surface-lift p-5">
        <h2 className="font-semibold">Runtime</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <div><div className="text-xs text-muted-foreground">Status</div><div className="mt-1"><StatusBadge status={summary.status === 'healthy' ? 'live' : 'queued'} label={summary.status} /></div></div>
          <div><div className="text-xs text-muted-foreground">Uptime</div><div className="mt-1 text-lg font-semibold">{Math.floor(summary.system.uptimeSeconds / 3600)}h {Math.floor((summary.system.uptimeSeconds % 3600) / 60)}m</div></div>
          <div><div className="text-xs text-muted-foreground">Memory</div><div className="mt-1 text-lg font-semibold">{summary.system.memoryUsageMB} MB</div></div>
          <div><div className="text-xs text-muted-foreground">Last updated</div><div className="mt-1 text-sm">{new Date(summary.timestamp).toLocaleString()}</div></div>
        </div>
      </div>
    </> : null}
  </div>;
}

function BillingPage() {
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => { setLoading(true); api<BillingSummary>('/api/v1/billing/summary').then(setSummary).catch((err) => setError(err instanceof Error ? err.message : 'Failed to load billing')).finally(() => setLoading(false)); }, []);
  return <div className="space-y-6">
    <PageHeader eyebrow={<>Governance · Billing</>} title="Billing & Usage" description="Subscription limits and usage metering foundation. Track seat, plan, and AI request consumption per period." breadcrumbs={[{ label: 'Billing' }]} />
    {error && <ErrorBox message={error} />}
    {loading ? <SkeletonList rows={3} /> : summary ? <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Plan" value={summary.subscription.planCode} hint={summary.subscription.status} tone="primary" />
        <KpiCard label="Seats limit" value={`${summary.subscription.seatsLimit}`} hint="User seats" tone="info" />
        <KpiCard label="Plans limit" value={`${summary.subscription.plansLimit}`} hint="DRP limit" tone="warning" />
        <KpiCard label="AI limit" value={`${summary.subscription.aiRequestsLimit}`} hint="Requests / period" tone="success" />
      </div>
      <div className="surface surface-lift p-5">
        <h2 className="font-semibold">Usage events</h2>
        <p className="text-xs text-muted-foreground">Current period ends {new Date(summary.subscription.currentPeriodEnd).toLocaleString()}</p>
        <div className="mt-4">
          <BarChartMini data={['plan_created','ai_request','export_generated','collaboration_session'].map((key) => ({ label: key.split('_').map((s) => s[0]).join(''), value: summary.usage[key] ?? 0 }))} height={120} />
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {['plan_created','ai_request','export_generated','collaboration_session'].map((key) => <div key={key} className="rounded-lg border p-3 text-sm"><div className="text-muted-foreground">{key}</div><div className="text-2xl font-bold">{summary.usage[key] ?? 0}</div></div>)}
        </div>
      </div>
    </> : null}
  </div>;
}

function EmailOutboxPage() {
  const [emails, setEmails] = useState<EmailOutboxItem[]>([]);
  const [queued, setQueued] = useState(0);
  const [processing, setProcessing] = useState<EmailProcessingPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const toast = useToast();
  async function load() {
    setLoading(true);
    try { const data = await api<{ emails: EmailOutboxItem[]; queued: number; processing: EmailProcessingPlan }>('/api/v1/email-outbox'); setEmails(data.emails); setQueued(data.queued); setProcessing(data.processing); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to load email outbox'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  async function updateStatus(id: string, status: EmailOutboxItem['status']) {
    try { await api<EmailOutboxItem>(`/api/v1/email-outbox/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }); await load(); toast.success(`Email ${status}`); }
    catch (err) { toast.error('Update failed'); }
  }
  async function processNext() {
    try { const result = await api<{ detail: string; email?: { to: string; subject: string } }>('/api/v1/email-outbox/process-next', { method: 'POST', body: JSON.stringify({}) }); await load(); toast.info(result.email ? `Next: ${result.email.subject} → ${result.email.to}` : 'Outbox processed', { description: result.detail }); }
    catch (err) { toast.error('Process failed'); }
  }
  return <div className="space-y-6">
    <PageHeader eyebrow={<>Operations · Email Outbox</>} title="Email Outbox" description={`${queued} queued draft email(s). Outbound SMTP is approval/config gated.`} breadcrumbs={[{ label: 'Email Outbox' }]} />
    {error && <ErrorBox message={error} />}
    {loading ? <SkeletonList rows={3} /> : <>
      {processing && <div className="surface surface-lift p-5">
        <div className="flex items-center justify-between">
          <div><h2 className="font-semibold">Processing posture</h2><p className="text-sm text-muted-foreground">{processing.detail}</p></div>
          <Button variant="primary" size="md" onClick={processNext} leftIcon={<Mail className="h-4 w-4" />}>Prepare next</Button>
        </div>
      </div>}
      {emails.length === 0 ? (
        <EmptyState icon={<Mail className="h-8 w-8" />} title="No queued emails" description="Outbound emails (approval requests, password resets, notifications) will queue here for processing." />
      ) : (
        <div className="space-y-3">
          {emails.map((email) => <div key={email.id} className="surface surface-lift p-4 text-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{email.subject}</div>
                <div className="text-muted-foreground">{email.emailType} · to {email.toEmail} · {new Date(email.queuedAt).toLocaleString()}</div>
                <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-xs">{email.bodyText}</pre>
                {email.lastError && <p className="mt-2 text-xs text-destructive">Last error: {email.lastError}</p>}
              </div>
              <div className="flex shrink-0 flex-col gap-2">
                <StatusBadge status={email.status} />
                {email.status === 'queued' && <>
                  <Button variant="ghost" size="sm" onClick={() => updateStatus(email.id, 'sent')}>Mark sent</Button>
                  <Button variant="ghost" size="sm" onClick={() => updateStatus(email.id, 'cancelled')}>Cancel</Button>
                </>}
              </div>
            </div>
          </div>)}
        </div>
      )}
    </>}
  </div>;
}

function AuditTrailPage() {
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [q, setQ] = useState('');
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const [limit, setLimit] = useState(50);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const entityTypes = ['drp_plan', 'drp_section', 'plan_version', 'plan_comment', 'bia_entry', 'service_asset', 'service_risk', 'recovery_drill', 'email_outbox', 'tenant_settings', 'user'];
  const actions = ['create', 'update', 'submit', 'approve', 'rollback', 'queue', 'sent', 'cancelled', 'failed'];
  const toast = useToast();
  async function load() {
    try {
      setError(''); setLoading(true);
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (entityType) params.set('entityType', entityType);
      if (action) params.set('action', action);
      params.set('limit', String(limit));
      const data = await api<{ auditLogs: AuditLogItem[] }>(`/api/v1/audit-trail?${params.toString()}`);
      setItems(data.auditLogs);
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to load audit trail'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  function submit(event: React.FormEvent) { event.preventDefault(); void load(); }
  const timelineEvents: TimelineEvent[] = items.map((item) => ({
    id: item.id,
    actor: { name: item.actorEmail ?? 'system', email: item.actorEmail ?? undefined },
    action: item.action,
    entity: item.entityType,
    summary: item.summary,
    at: item.createdAt,
  }));
  return <div className="space-y-6">
    <PageHeader
      eyebrow={<><FileText className="mr-1.5 inline h-3 w-3" />Governance</>}
      title="Audit Trail"
      description="Tenant-scoped append-only activity log for DRP, BIA, users, settings, and outbound queue actions."
      breadcrumbs={[{ label: 'Audit Trail' }]}
    />
    {error && <ErrorBox message={error} />}
    <form onSubmit={submit} className="surface surface-lift p-4">
      <div className="grid gap-3 md:grid-cols-5">
        <SearchInput value={q} onChange={setQ} placeholder="Search summary, action, entity id..." />
        <label className="text-sm font-medium">Entity<select value={entityType} onChange={(e) => setEntityType(e.target.value)} className="input mt-1"><option value="">All entities</option>{entityTypes.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label className="text-sm font-medium">Action<select value={action} onChange={(e) => setAction(e.target.value)} className="input mt-1"><option value="">All actions</option>{actions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <Input name="limit" label="Limit" type="number" min="1" max="100" value={limit} onChange={(e) => setLimit(Number(e.target.value) || 50)} />
        <div className="flex items-end gap-2">
          <Button type="submit" variant="primary" size="md" className="flex-1">Search</Button>
          <a className="btn-ghost text-sm" href={`${API}/api/v1/audit-trail.csv?${new URLSearchParams({ ...(q.trim() ? { q: q.trim() } : {}), ...(entityType ? { entityType } : {}), ...(action ? { action } : {}), limit: String(limit) }).toString()}`}>CSV</a>
        </div>
      </div>
    </form>
    {loading ? (
      <SkeletonList rows={5} />
    ) : items.length === 0 ? (
      <EmptyState
        icon={<FileText className="h-6 w-6" />}
        title="No audit records found"
        description="Adjust filters or wait for new activity to appear."
        action={<Button variant="primary" size="md" onClick={() => { setQ(''); setEntityType(''); setAction(''); setLimit(50); setTimeout(load, 0); }}>Reset filters</Button>}
      />
    ) : (
      <div className="surface surface-lift p-4">
        <ActivityTimeline events={timelineEvents} empty="No audit records found." />
      </div>
    )}
  </div>;
}

function BackupsPage() {
  const [summary, setSummary] = useState<BackupSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  async function load() {
    setLoading(true);
    try { setSummary(await api<BackupSummary>('/api/v1/backups/summary')); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to load backups'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  return <div className="space-y-6">
    <PageHeader eyebrow={<>Operations · Backups</>} title="Database Backups" description="Daily database backup visibility and restore-test readiness. Verify dump files, age, and checksum coverage." breadcrumbs={[{ label: 'Backups' }]} />
    {error && <ErrorBox message={error} />}
    {loading ? <SkeletonList rows={3} /> : summary ? <>
      <div className="grid gap-4 sm:grid-cols-4">
        <KpiCard label="Status" value={summary.status} hint={summary.error ?? 'backup directory readable'} tone={summary.status === 'ok' ? 'success' : 'warning'} />
        <KpiCard label="Backup files" value={`${summary.count}`} hint="dump files" tone="primary" />
        <KpiCard label="Latest age" value={summary.latestAgeHours === null ? '-' : `${summary.latestAgeHours}h`} hint="target <= 30h" tone={(summary.latestAgeHours ?? 0) <= 30 ? 'success' : 'warning'} />
        <KpiCard label="Checksum" value={summary.latest?.checksumFile ? 'yes' : 'no'} hint="latest .sha256" tone={summary.latest?.checksumFile ? 'success' : 'warning'} />
      </div>
      <div className="surface surface-lift p-5">
        <h2 className="font-semibold">Backup directory</h2>
        <p className="mt-1 break-all text-sm text-muted-foreground font-mono">{summary.backupDir}</p>
      </div>
      {summary.backups.length === 0 ? (
        <EmptyState icon={<Server className="h-8 w-8" />} title="No backup dumps found" description="Daily backup job may not have run yet, or backup directory is empty." />
      ) : (
        <div className="surface surface-lift">
          <div className="border-b p-4 font-semibold">Recent backups</div>
          <div className="divide-y">
            {summary.backups.map((backup) => <div key={backup.file} className="p-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{backup.file}</div>
                  <div className="text-muted-foreground">{Math.round(backup.sizeBytes / 1024 / 1024 * 100) / 100} MB · {new Date(backup.modifiedAt).toLocaleString()}</div>
                  <div className="mt-1 break-all text-xs text-muted-foreground font-mono">{backup.path}</div>
                </div>
                <StatusBadge status={backup.checksumFile ? 'completed' : 'queued'} label={backup.checksumFile ? 'checksum ok' : 'no checksum'} />
              </div>
            </div>)}
          </div>
        </div>
      )}
    </> : null}
  </div>;
}

function ReadinessPage() {
  const [summary, setSummary] = useState<ReadinessSummary | null>(null);
  const [bootstrap, setBootstrap] = useState<BootstrapStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    setLoading(true);
    Promise.all([api<ReadinessSummary>('/api/v1/readiness'), api<BootstrapStatus>('/api/v1/bootstrap/status')])
      .then(([readiness, bootstrapStatus]) => { setSummary(readiness); setBootstrap(bootstrapStatus); })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load readiness'))
      .finally(() => setLoading(false));
  }, []);
  const badgeClass = (status: string) => status === 'pass' ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400' : status === 'warn' ? 'border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400' : 'border-destructive/30 bg-destructive/5 text-destructive';
  return <div className="space-y-6">
    <PageHeader eyebrow={<>Operations · Readiness</>} title="Production Readiness" description="Internal go-live checks for a professional operating posture. Verifies auth, DB, backups, SMTP, MFA, and observability." breadcrumbs={[{ label: 'Readiness' }]} />
    {error && <ErrorBox message={error} />}
    {loading ? <SkeletonList rows={3} /> : summary ? <>
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Overall" value={summary.status} hint="readiness state" tone={summary.status === 'ready' ? 'success' : summary.status === 'degraded' ? 'warning' : 'primary'} />
        <KpiCard label="Warnings" value={`${summary.warnings}`} hint="needs decision" tone="warning" />
        <KpiCard label="Failures" value={`${summary.failed}`} hint="must fix" tone={summary.failed > 0 ? 'warning' : 'success'} />
      </div>
      {bootstrap && <div className={`surface surface-lift p-5 ${bootstrap.needsBootstrap ? 'border-amber-500/30' : 'border-emerald-500/30'}`}>
        <div className="flex items-center justify-between">
          <div><h2 className="font-semibold">First-run / admin bootstrap</h2><p className="mt-1 text-sm text-muted-foreground">{bootstrap.needsBootstrap ? 'Bootstrap required before office use.' : 'Tenant and admin account exist.'}</p></div>
          <StatusBadge status={bootstrap.needsBootstrap ? 'queued' : 'live'} label={bootstrap.needsBootstrap ? 'needs bootstrap' : 'ready'} />
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div><div className="text-xs text-muted-foreground">Tenants</div><div className="text-lg font-semibold">{bootstrap.tenantCount}</div></div>
          <div><div className="text-xs text-muted-foreground">Users</div><div className="text-lg font-semibold">{bootstrap.userCount}</div></div>
          <div><div className="text-xs text-muted-foreground">Admins</div><div className="text-lg font-semibold">{bootstrap.adminCount}</div></div>
        </div>
        <code className="mt-3 block rounded bg-muted/40 p-2 text-xs font-mono">{bootstrap.bootstrapCommand}</code>
        <p className="mt-2 text-xs text-muted-foreground">{bootstrap.defaultSeedWarning}</p>
      </div>}
      <div className="space-y-2">
        {summary.checks.map((check) => <div key={check.key} className={`surface surface-lift p-4 text-sm ${badgeClass(check.status)}`}>
          <div className="flex items-center justify-between">
            <div className="font-medium">{check.label}</div>
            <StatusBadge status={check.status === 'pass' ? 'completed' : check.status === 'warn' ? 'in_review' : 'failed'} label={check.status.toUpperCase()} />
          </div>
          <p className="mt-2 text-muted-foreground">{check.detail}</p>
        </div>)}
      </div>
    </> : null}
  </div>;
}

function SettingsPage() {
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const toast = useToast();
  async function load() {
    setLoading(true);
    try { const data = await api<{ settings: TenantSettings }>('/api/v1/settings'); setSettings(data.settings); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to load settings'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    const form = event.currentTarget; const data = new FormData(form);
    try {
      const payload: TenantSettings = {
        smtp: { mode: data.get('smtpMode') as 'outbox_only' | 'smtp', host: String(data.get('smtpHost') || '') || undefined, port: Number(data.get('smtpPort') || 0) || undefined, from: String(data.get('smtpFrom') || '') || undefined, configuredFromDashboard: true },
        internalAccess: { mode: 'ip_port', securityGroupRestricted: data.get('securityGroupRestricted') === 'on', adminPolicy: String(data.get('adminPolicy') || 'single_admin_erwin_only') },
        backup: { frequency: 'daily', retentionDays: Number(data.get('retentionDays') || 14) },
        sso: { enabled: data.get('ssoEnabled') === 'on', provider: data.get('ssoProvider') as 'oidc' | 'azure_ad', issuerUrl: String(data.get('ssoIssuerUrl') || '') || undefined, clientId: String(data.get('ssoClientId') || '') || undefined, redirectUri: String(data.get('ssoRedirectUri') || '') || undefined },
      };
      const updated = await api<{ settings: TenantSettings }>('/api/v1/settings', { method: 'PATCH', body: JSON.stringify(payload) });
      setSettings(updated.settings);
      toast.success('Settings saved');
    } catch (err) { setError(err instanceof Error ? err.message : 'Save settings failed'); toast.error('Save failed'); }
  }
  return <div className="space-y-6">
    <PageHeader eyebrow={<>System · Settings</>} title="Tenant Settings" description="Internal office access via IP:port; SMTP can be configured later from this dashboard. Single admin policy locked to Erwin." breadcrumbs={[{ label: 'Settings' }]} />
    {error && <ErrorBox message={error} />}
    {loading || !settings ? <SkeletonList rows={3} /> : <>
      <form onSubmit={save} className="surface surface-lift grid gap-4 p-5 md:grid-cols-2">
        <label className="text-sm font-medium">SMTP mode<select name="smtpMode" defaultValue={settings.smtp.mode} className="input mt-1"><option value="outbox_only">Outbox only for now</option><option value="smtp">SMTP configured</option></select></label>
        <Input name="smtpHost" label="SMTP host" defaultValue={settings.smtp.host ?? ''} />
        <Input name="smtpPort" label="SMTP port" type="number" defaultValue={settings.smtp.port ? String(settings.smtp.port) : ''} />
        <Input name="smtpFrom" label="SMTP from" defaultValue={settings.smtp.from ?? ''} />
        <label className="text-sm font-medium">Access model<input name="accessMode" value="IP and port" disabled className="input mt-1" /></label>
        <label className="flex items-center gap-2 text-sm font-medium"><input name="securityGroupRestricted" type="checkbox" defaultChecked={settings.internalAccess.securityGroupRestricted} className="h-4 w-4" /> Restricted by VM security group</label>
        <Input name="adminPolicy" label="Admin policy" defaultValue={settings.internalAccess.adminPolicy} />
        <Input name="retentionDays" label="Backup retention days" type="number" defaultValue={String(settings.backup.retentionDays)} />
        <div className="md:col-span-2 border-t pt-4">
          <h2 className="font-semibold">SSO / OIDC scaffold</h2>
          <p className="text-xs text-muted-foreground">Disabled by default. Fill when Azure AD/OIDC details are ready.</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium md:col-span-2"><input name="ssoEnabled" type="checkbox" defaultChecked={settings.sso.enabled} className="h-4 w-4" /> Enable SSO after credentials are validated</label>
        <label className="text-sm font-medium">SSO provider<select name="ssoProvider" defaultValue={settings.sso.provider} className="input mt-1"><option value="oidc">OIDC</option><option value="azure_ad">Azure AD</option></select></label>
        <Input name="ssoIssuerUrl" label="Issuer URL" defaultValue={settings.sso.issuerUrl ?? ''} />
        <Input name="ssoClientId" label="Client ID" defaultValue={settings.sso.clientId ?? ''} />
        <Input name="ssoRedirectUri" label="Redirect URI" defaultValue={settings.sso.redirectUri ?? ''} />
        <div className="md:col-span-2"><Button type="submit" variant="primary" size="md">Save settings</Button></div>
      </form>
    </>}
  </div>;
}

function UsersPage() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const toast = useToast();
  async function load() {
    setLoading(true);
    try { setUsers((await api<{ users: ManagedUser[] }>('/api/v1/users')).users); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to load users'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      await api<ManagedUser>('/api/v1/users', { method: 'POST', body: JSON.stringify({ email: data.get('email'), name: data.get('name'), role: data.get('role'), password: data.get('password') }) });
      form.reset(); await load();
      toast.success('User created', { description: String(data.get('email')) });
    } catch (err) { setError(err instanceof Error ? err.message : 'Create user failed'); }
  }
  return <div className="space-y-6">
    <PageHeader eyebrow={<>Governance · Users</>} title="User Management" description="Tenant user management and RBAC foundation. Roles: admin, coordinator, owner, viewer." breadcrumbs={[{ label: 'Users' }]} />
    {error && <ErrorBox message={error} />}
    {loading ? <SkeletonList rows={3} /> : <>
      <form onSubmit={submit} className="surface surface-lift grid gap-3 p-5 md:grid-cols-4">
        <Input name="email" label="Email" type="email" required />
        <Input name="name" label="Name" required />
        <label className="text-sm font-medium">Role<select name="role" defaultValue="viewer" className="input mt-1"><option value="admin">Admin</option><option value="coordinator">Coordinator</option><option value="owner">Owner</option><option value="viewer">Viewer</option></select></label>
        <Input name="password" label="Temporary password" type="password" required />
        <div className="md:col-span-4"><Button type="submit" variant="primary" size="md">Create user</Button></div>
      </form>
      {users.length === 0 ? (
        <EmptyState icon={<Users className="h-8 w-8" />} title="No users found" description="Add the first user to grant workspace access." />
      ) : (
        <div className="surface surface-lift">
          <div className="border-b p-4 font-semibold">User directory</div>
          <div className="divide-y">
            {users.map((u) => <div key={u.id} className="flex items-center justify-between gap-3 p-4 text-sm">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <Avatar name={u.name} size="md" status={u.disabled ? 'offline' : 'online'} />
                <div className="min-w-0">
                  <div className="font-medium">{u.name}</div>
                  <div className="text-muted-foreground">{u.email}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={u.role === 'admin' ? 'in_review' : u.role === 'coordinator' ? 'draft' : 'approved'} label={u.role} />
                <StatusBadge status={u.mfaEnabled ? 'completed' : 'queued'} label={u.mfaEnabled ? 'MFA on' : 'MFA off'} />
                <StatusBadge status={u.disabled ? 'failed' : 'live'} label={u.disabled ? 'disabled' : 'active'} />
              </div>
            </div>)}
          </div>
        </div>
      )}
    </>}
  </div>;
}

function RegisterPage({ title, subtitle, error, children }: { title: string; subtitle: string; error: string; children: React.ReactNode }) {
  return <div className="space-y-6"><PageHeader title={title} description={subtitle} />{error && <ErrorBox message={error} />}{children}</div>;
}
function SimpleTable({ headers, rows, empty }: { headers: string[]; rows: string[][]; empty: string }) { return <div className="overflow-hidden rounded-lg border bg-card"><div className="grid border-b bg-muted/40 p-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground" style={{ gridTemplateColumns: `repeat(${headers.length}, minmax(0, 1fr))` }}>{headers.map((header) => <div key={header}>{header}</div>)}</div>{rows.length === 0 ? <div className="p-6 text-center text-sm text-muted-foreground">{empty}</div> : rows.map((row, index) => <div key={index} className="grid border-b p-3 text-sm last:border-0" style={{ gridTemplateColumns: `repeat(${headers.length}, minmax(0, 1fr))` }}>{row.map((cell, cellIndex) => <div key={cellIndex} className="truncate pr-3">{cell}</div>)}</div>)}</div>; }

function DownloadLink({ href, label }: { href: string; label: string }) { return <a href={`${API}${href}`} className="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm"><Download className="h-4 w-4" /> Export {label}</a>; }
function NavLink({ to, icon, children }: { to: string; icon: React.ReactNode; children: React.ReactNode }) { return <Link to={to} className="group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-primary/10 hover:text-foreground hover:translate-x-0.5"><span className="text-muted-foreground/70 transition-colors group-hover:text-primary">{icon}</span><span>{children}</span></Link>; }
function Dashboard() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [summary, setSummary] = useState<ResilienceSummary | null>(null);
  const [risks, setRisks] = useState<ServiceRisk[]>([]);
  const [bia, setBia] = useState<BiaEntry[]>([]);
  useEffect(() => {
    api<{ plans: Plan[] }>('/api/v1/plans').then((d) => setPlans(d.plans)).catch(() => setPlans([]));
    api<{ summary: ResilienceSummary }>('/api/v1/resilience/summary').then((d) => setSummary(d.summary)).catch(() => setSummary(null));
    api<{ risks: ServiceRisk[] }>('/api/v1/risks').then((d) => setRisks(d.risks)).catch(() => setRisks([]));
    api<{ entries: BiaEntry[] }>('/api/v1/bia').then((d) => setBia(d.entries)).catch(() => setBia([]));
  }, []);

  // Synthesize trend data (last 6 months) — flat baseline + small variance.
  const trend = (base: number, jitter = 0.15) => {
    const out: number[] = [];
    for (let i = 0; i < 6; i++) out.push(Math.max(0, Math.round(base * (1 + (Math.random() - 0.5) * jitter * 2))));
    return out;
  };

  // Donut: plan status distribution
  const planStatus = useMemo(() => {
    const counts = { approved: 0, in_review: 0, draft: 0, retired: 0 };
    plans.forEach((p) => { if (p.status in counts) counts[p.status as keyof typeof counts]++; });
    return [
      { label: 'Approved', value: counts.approved, color: 'hsl(142 71% 45%)' },
      { label: 'In Review', value: counts.in_review, color: 'hsl(38 92% 50%)' },
      { label: 'Draft', value: counts.draft, color: 'hsl(215 16% 47%)' },
      { label: 'Retired', value: counts.retired, color: 'hsl(220 13% 70%)' },
    ];
  }, [plans]);

  // Bar chart: risk by category
  const riskByCategory = useMemo(() => {
    const map = new Map<string, number>();
    risks.forEach((r) => map.set(r.category, (map.get(r.category) ?? 0) + 1));
    return Array.from(map.entries()).map(([label, value]) => ({ label, value }));
  }, [risks]);

  // Bar chart: BIA by tier
  const biaByTier = useMemo(() => {
    const map = new Map<string, number>();
    bia.forEach((b) => map.set(b.criticalityTier, (map.get(b.criticalityTier) ?? 0) + 1));
    return Array.from(map.entries()).map(([label, value]) => ({ label, value }));
  }, [bia]);

  return (
    <div className="space-y-8 anim-fade-up">
      <div className="relative">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
          <Sparkles className="h-3.5 w-3.5" /> Operations overview
        </div>
        <h1 className="display mt-2">DR posture, at a glance.</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-xl">Real-time signal from your DR plans, risks, assets, and drill schedule — all in one calm surface.</p>
      </div>

      <div className="anim-stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total DRP" value={`${plans.length}`} hint="Total plans" tone="primary" spark={trend(plans.length, 0.2)} />
        <KpiCard label="Approved" value={`${plans.filter((p) => p.status === 'approved').length}`} hint="Ready for incident" tone="success" spark={trend(plans.filter((p) => p.status === 'approved').length, 0.3)} />
        <KpiCard label="Open Risks" value={`${summary?.openRisks ?? 0}`} hint={`${summary?.highRisks ?? 0} high risk`} tone="warning" spark={trend(summary?.openRisks ?? 0, 0.4)} />
        <KpiCard label="Planned Drills" value={`${summary?.plannedDrills ?? 0}`} hint={`${summary?.completedDrills ?? 0} completed`} tone="info" spark={trend(summary?.plannedDrills ?? 0, 0.25)} />
      </div>

      <div className="anim-stagger grid gap-4 lg:grid-cols-3">
        <KpiCard label="Assets" value={`${summary?.totalAssets ?? 0}`} hint={`${summary?.criticalAssets ?? 0} critical assets`} tone="primary" spark={trend(summary?.totalAssets ?? 0, 0.15)} />
        <KpiCard label="Priority Recovery" value={`${summary?.priorityRecoveryAssets ?? 0}`} hint="Priority 1-2 assets" tone="warning" spark={trend(summary?.priorityRecoveryAssets ?? 0, 0.2)} />
        <KpiCard label="Coverage" value={plans.length ? `${Math.round((plans.filter((p) => p.status === 'approved').length / plans.length) * 100)}%` : '0%'} hint="Approved / total DRP" tone="success" spark={trend(plans.length ? Math.round((plans.filter((p) => p.status === 'approved').length / plans.length) * 100) : 0, 0.1)} />
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-3 anim-fade-up">
        <div className="surface surface-lift p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">DR plan status</h3>
              <p className="text-xs text-muted-foreground">By lifecycle stage</p>
            </div>
            <span className="badge border-primary/30 bg-primary/10 text-primary">{plans.length} total</span>
          </div>
          {plans.length === 0 ? (
            <EmptyState icon={<FileText className="h-6 w-6" />} title="No plans yet" description="Create your first DRP from the Plans page to see status distribution." />
          ) : (
            <DonutChart data={planStatus} size={140} thickness={18} centerValue={`${plans.length}`} centerLabel="plans" />
          )}
        </div>

        <div className="surface surface-lift p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Risk by category</h3>
              <p className="text-xs text-muted-foreground">Open risk register</p>
            </div>
            <span className="badge border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">{risks.length} open</span>
          </div>
          {risks.length === 0 ? (
            <EmptyState icon={<AlertTriangle className="h-6 w-6" />} title="No risks logged" description="Add risks to see distribution by category." />
          ) : (
            <BarChartMini data={riskByCategory} height={120} />
          )}
        </div>

        <div className="surface surface-lift p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">BIA criticality tiers</h3>
              <p className="text-xs text-muted-foreground">Business impact distribution</p>
            </div>
            <span className="badge border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">{bia.length} entries</span>
          </div>
          {bia.length === 0 ? (
            <EmptyState icon={<CheckCircle2 className="h-6 w-6" />} title="No BIA entries" description="Add business impact analyses to see tier breakdown." />
          ) : (
            <BarChartMini data={biaByTier} height={120} />
          )}
        </div>
      </div>

      <div className="relative surface-glow overflow-hidden p-6">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 -bottom-16 h-48 w-48 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Workspace
          </div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight">DR Plan Builder SaaS — ready.</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Buat DRP ISO 22301, register asset dependency, risk register, drill schedule, approval, audit, dan export. AI co-pilot aktif di tiap section.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link to="/plans" className="btn-primary">Buka DR Plans</Link>
            <Link to="/ai-providers" className="btn-ghost">Konfigurasi AI</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
function KpiCard({ label, value, hint, tone = 'primary', spark }: { label: string; value: string; hint: string; tone?: 'primary' | 'success' | 'warning' | 'info'; spark?: number[] }) {
  const toneClass = {
    primary: 'from-primary/15 to-primary/0 text-primary',
    success: 'from-emerald-500/15 to-emerald-500/0 text-emerald-600 dark:text-emerald-400',
    warning: 'from-amber-500/15 to-amber-500/0 text-amber-600 dark:text-amber-400',
    info: 'from-cyan-500/15 to-cyan-500/0 text-cyan-600 dark:text-cyan-400',
  }[tone];
  return (
    <div className="surface surface-lift relative overflow-hidden p-5">
      <div className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br ${toneClass} blur-2xl`} />
      <div className="relative">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          {spark && spark.length >= 2 && <Sparkline data={spark} width={64} height={20} className="shrink-0" />}
        </div>
        <p className="stat-number mt-3">{value}</p>
        <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}
function StatusBadge({ status, label }: { status: string; label?: string }) { const color = status === 'approved' ? 'bg-green-100 text-green-700' : status === 'in_review' ? 'bg-yellow-100 text-yellow-800' : 'bg-slate-100 text-slate-700'; return <span className={`rounded-full px-2 py-1 text-xs font-medium ${color}`}>{label ?? status.replace('_', ' ')}</span>; }
function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) { const { label, ...rest } = props; return <label className="text-sm font-medium">{label}<input {...rest} className="mt-1 w-full rounded-md border px-3 py-2" /></label>; }
function getCompletionSignals(section: Section | undefined): CompletionSignal[] {
  if (!section) return [];
  return [
    { key: 'minWords', label: 'At least 50 words', weight: 15, hint: 'Add more context — typical sections are 200+ words.', passed: (c) => c.trim().split(/\s+/).filter(Boolean).length >= 50 },
    { key: 'hasHeading', label: 'Has a heading', weight: 10, hint: 'Start with # or ## to introduce the section.', passed: (c) => /^#{1,3}\s/m.test(c) },
    { key: 'hasList', label: 'Has a bulleted or numbered list', weight: 15, hint: 'Use lists to enumerate steps, contacts, or criteria.', passed: (c) => /(^|\n)(-|\d+\.)\s/m.test(c) },
    { key: 'hasTable', label: 'Has a table', weight: 10, hint: 'Tables work well for RTOs, contacts, dependencies.', passed: (c) => /\|.+\|[\s\S]*\|[-:|\s]+\|/m.test(c) },
    { key: 'hasContacts', label: 'Mentions contact info', weight: 15, hint: 'Roles, names, phone/email or @handles.', passed: (c) => /(\+?\d[\d\s-]{6,}|@[\w.-]+|ext\.?\s*\d|phone|tel|email|on[- ]?call|escalat)/i.test(c) },
    { key: 'hasRtoRpo', label: 'References RTO/RPO or times', weight: 10, hint: 'Section should mention target times if relevant.', passed: (c) => /(RTO|RPO|recovery time|recovery point|\d+\s*(min|minute|hour|h\b))/i.test(c) },
    { key: 'hasRoles', label: 'Defines roles and responsibilities', weight: 15, hint: 'Owner, on-call, approver, coordinator.', passed: (c) => /(owner|coordinator|approver|on[- ]?call|responsible|accountable|RACI)/i.test(c) },
    { key: 'hasEvidence', label: 'References evidence or verification', weight: 10, hint: 'Mention where to verify (runbook, dashboard, test).', passed: (c) => /(evidence|verify|test|dashboard|runbook|log|audit)/i.test(c) },
  ];
}

const SECTION_SNIPPETS: SnippetItem[] = [
  { id: 'roles', label: 'Roles & responsibilities', category: 'Governance',
    description: 'RACI-style table for plan ownership, approval, and on-call.',
    content: `## Roles & responsibilities

| Role | Person | Responsibility | Contact |
|------|--------|----------------|---------|
| Plan owner | TBA | Owns plan accuracy, quarterly review | <email> |
| Incident commander | TBA | Coordinates during disaster | <phone> |
| On-call engineer | rotation | First responder, 24/7 | PagerDuty |
| Approver (executive) | TBA | Final approval of plan and DR funding | <email> |
` },
  { id: 'contact-tree', label: 'Contact tree (escalation)', category: 'Governance',
    description: 'Tiered escalation tree with notification order and method.',
    content: `## Communication & escalation tree

1. **Tier 1 — On-call engineer** (response: 5 min)
   - Page via PagerDuty
   - Slack #dr-warroom
2. **Tier 2 — Incident commander + service owner** (response: 15 min)
   - Phone call, then group SMS
3. **Tier 3 — Director of Operations** (response: 30 min)
   - Direct call
4. **Tier 4 — Executive sponsor** (response: 60 min)
   - Direct call + email summary
` },
  { id: 'rto-rpo', label: 'RTO / RPO table', category: 'Objectives',
    description: 'Recovery time and point objectives per tier.',
    content: `## Recovery objectives

| Tier | RTO (max downtime) | RPO (max data loss) | Workaround window |
|------|-------------------|--------------------|--------------------|
| Tier 1 (critical) | 1 hour | 5 minutes | 15 min workaround |
| Tier 2 (important) | 4 hours | 1 hour | 2 h workaround |
| Tier 3 (standard) | 24 hours | 24 hours | Best effort |
| Tier 4 (deferrable) | 72 hours | 72 hours | Manual only |
` },
  { id: 'incident-response', label: 'Incident response (initial)', category: 'Operations',
    description: 'Step-by-step initial response from alert to declaration.',
    content: `## Initial incident response

1. **Detect** — alert from monitoring, user report, or status page trigger.
2. **Triage** (target 5 min) — on-call engineer acknowledges, classifies severity, opens incident channel.
3. **Contain** (target 15 min) — apply runbook mitigation: failover, scale up, block traffic, rollback deploy.
4. **Assess** (target 30 min) — is this a disaster (DR plan activation) or operational incident?
5. **Declare disaster** (per criteria below) — incident commander calls executive sponsor, switches to DR plan.
6. **Communicate** — status page update every 30 min until resolved.

### Declaration criteria
- Outage > 30 min with no ETA
- Data loss confirmed or imminent
- Multi-region failure
- Security breach with operational impact
` },
  { id: 'recovery-procedure', label: 'Recovery procedure (detailed)', category: 'Operations',
    description: 'Ordered technical recovery steps with verification gates.',
    content: `## Recovery procedure

### Pre-flight
- [ ] Confirm DR runbook accessible
- [ ] Verify backup integrity (latest checksum OK)
- [ ] Check DR region capacity and quota
- [ ] Notify on-call coordinator

### Recovery steps
1. **Provision DR environment** (target: 20 min)
   - Trigger IaC pipeline
   - Verify network connectivity
   - Confirm DNS failover readiness
2. **Restore data** (target: 40 min)
   - Restore latest backup to DR DB
   - Apply WAL/binlog tail to meet RPO
   - Verify data integrity with checksum
3. **Cut over** (target: 60 min)
   - Update DNS / load balancer to DR
   - Monitor error rates and latency
   - Stand down primary region traffic
4. **Verify** (target: 75 min)
   - Run smoke test suite
   - Confirm customer-facing flows
   - Validate metric and log ingestion

### Rollback
If verification fails, revert DNS to primary (now recovered) and open post-incident review.
` },
  { id: 'testing-schedule', label: 'Testing schedule', category: 'Validation',
    description: 'Quarterly test cadence with type, scope, and success criteria.',
    content: `## Testing schedule

| Quarter | Test type | Scope | Success criteria |
|---------|-----------|-------|------------------|
| Q1 | Tabletop walkthrough | Plan, contact tree | All roles confirm; gaps documented |
| Q2 | Component recovery | Restore from backup | Backup mounts, data readable |
| Q3 | Partial DR failover | Single tier service | RTO met, no data loss |
| Q4 | Full DR drill | Cross-region cutover | All RTOs/RPOs met, comms tested |
` },
  { id: 'communication-plan', label: 'Communication plan', category: 'Communications',
    description: 'Audience, channel, frequency, and owner for status updates.',
    content: `## Communication plan

| Audience | Channel | Cadence | Owner |
|----------|---------|---------|-------|
| Internal eng | Slack #dr-warroom | Real-time | Incident commander |
| Internal exec | Email + call | Hourly | Comms lead |
| Customers | Status page | Every 30 min | Comms lead |
| Regulators (if required) | Email + formal letter | Within 24 h | Legal |
| Vendors / partners | Direct call | As needed | Service owner |
` },
  { id: 'succession', label: 'Succession & delegation', category: 'Governance',
    description: 'Backup approvers and delegated decision rights.',
    content: `## Succession & delegation

If primary role-holder is unreachable:

- **Plan owner** → deputy plan owner → director of operations
- **Incident commander** → senior on-call → engineering manager
- **Approver** → deputy approver (always pre-authorized up to $50k spend for emergency failover)
- **Comms lead** → marketing on-call → CEO chief of staff

All delegation pairs reviewed quarterly. Pre-authorized spend reviewed annually.
` },
];

function SectionStatusGrid({ sections, selected, onSelect }: { sections: Section[]; selected: string; onSelect: (key: string) => void }) {
  const items = sections.map((s) => {
    const wordCount = (s.contentMarkdown || '').trim().split(/\s+/).filter(Boolean).length;
    const signals = getCompletionSignals(s);
    const total = signals.reduce((sum, c) => sum + c.weight, 0) || 1;
    const earned = signals.filter((c) => c.passed(s.contentMarkdown || '')).reduce((sum, c) => sum + c.weight, 0);
    return { ...s, wordCount, percent: Math.round((earned / total) * 100) };
  });
  const overall = Math.round(items.reduce((s, i) => s + i.percent, 0) / items.length);
  return (
    <div className="surface surface-lift p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Plan completion overview</h3>
          <p className="text-xs text-muted-foreground">Click any section to jump. Hover for completion details.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted/60">
            <div className={`h-full rounded-full transition-all duration-500 ${overall >= 80 ? 'bg-emerald-500' : overall >= 40 ? 'bg-amber-500' : 'bg-destructive'}`} style={{ width: `${overall}%` }} />
          </div>
          <span className="text-sm font-bold tabular-nums">{overall}%</span>
          <span className="text-xs text-muted-foreground">overall</span>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => {
          const active = item.sectionKey === selected;
          const tone = item.percent >= 80 ? 'emerald' : item.percent >= 40 ? 'amber' : 'rose';
          return (
            <button
              key={item.sectionKey}
              type="button"
              onClick={() => onSelect(item.sectionKey)}
              className={`group relative rounded-lg border p-3 text-left transition-all ${active ? 'border-primary bg-primary/5 shadow-sm' : 'border-border/60 hover:border-primary/40 hover:bg-muted/30'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-mono text-muted-foreground">{item.order}.</span>
                    <span className="truncate text-xs font-semibold">{item.title.replace(/^\d+\.\s*/, '')}</span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{item.isoClause}</p>
                </div>
                {active && <ChevronRight className="h-3.5 w-3.5 text-primary" />}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted/60">
                  <div
                    className={`h-full rounded-full ${tone === 'emerald' ? 'bg-emerald-500' : tone === 'amber' ? 'bg-amber-500' : 'bg-rose-500'}`}
                    style={{ width: `${item.percent}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold tabular-nums text-foreground">{item.percent}%</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>{item.wordCount} words</span>
                <StatusBadge status={item.status} label={item.status} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const BIA_PROCESS_TEMPLATES: { name: string; serviceName: string; description: string; rtoMinutes: number; rpoMinutes: number; tier: 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4'; impactFinancial: number; impactOperational: number; impactReputation: number; impactRegulatory: number; workaround: string }[] = [
  { name: 'Email & messaging (SMTP / Exchange)', serviceName: 'email', description: 'Outbound and inbound email for staff and customers.', rtoMinutes: 60, rpoMinutes: 30, tier: 'tier_2', impactFinancial: 2, impactOperational: 4, impactReputation: 2, impactRegulatory: 1, workaround: 'Personal Gmail accounts for critical comms, status page updates.' },
  { name: 'Authentication (SSO / LDAP / OIDC)', serviceName: 'auth', description: 'Single sign-on for all internal and customer-facing apps.', rtoMinutes: 30, rpoMinutes: 5, tier: 'tier_1', impactFinancial: 3, impactOperational: 5, impactReputation: 3, impactRegulatory: 2, workaround: 'Local accounts pre-created for top 20 staff; VPN-only access for emergencies.' },
  { name: 'DNS (authoritative + recursive)', serviceName: 'dns', description: 'External and internal DNS resolution.', rtoMinutes: 15, rpoMinutes: 60, tier: 'tier_1', impactFinancial: 4, impactOperational: 5, impactReputation: 4, impactRegulatory: 1, workaround: 'Secondary DNS provider, lower TTL (300s) on critical records.' },
  { name: 'Public web / marketing site', serviceName: 'web-public', description: 'Corporate website, marketing pages, status page.', rtoMinutes: 240, rpoMinutes: 1440, tier: 'tier_3', impactFinancial: 2, impactOperational: 2, impactReputation: 4, impactRegulatory: 1, workaround: 'Static cache served from CDN; status page via separate provider.' },
  { name: 'API gateway', serviceName: 'api-gateway', description: 'Public-facing API entry point for all customer integrations.', rtoMinutes: 60, rpoMinutes: 5, tier: 'tier_1', impactFinancial: 5, impactOperational: 5, impactReputation: 5, impactRegulatory: 2, workaround: 'Read-only mode for partners; status page with ETA; manual export queue.' },
  { name: 'Primary OLTP database', serviceName: 'db-primary', description: 'PostgreSQL/MySQL main transactional store.', rtoMinutes: 60, rpoMinutes: 5, tier: 'tier_1', impactFinancial: 5, impactOperational: 5, impactReputation: 5, impactRegulatory: 4, workaround: 'Read replica promotion; manual data entry into temporary queue.' },
  { name: 'Data warehouse / analytics', serviceName: 'analytics', description: 'Internal reporting and analytics pipeline.', rtoMinutes: 1440, rpoMinutes: 1440, tier: 'tier_3', impactFinancial: 2, impactOperational: 2, impactReputation: 1, impactRegulatory: 2, workaround: 'Stale reports acknowledged; data refresh deferred.' },
  { name: 'Object/file storage', serviceName: 'storage', description: 'S3-compatible object storage for documents, media, backups.', rtoMinutes: 240, rpoMinutes: 60, tier: 'tier_2', impactFinancial: 3, impactOperational: 3, impactReputation: 2, impactRegulatory: 3, workaround: 'Read-only access via secondary region; customer-uploaded files deferred.' },
  { name: 'CI/CD build pipeline', serviceName: 'cicd', description: 'Source control, build, test, deployment pipeline.', rtoMinutes: 480, rpoMinutes: 60, tier: 'tier_3', impactFinancial: 2, impactOperational: 3, impactReputation: 1, impactRegulatory: 1, workaround: 'Manual deploys from main branch with peer review.' },
  { name: 'Monitoring & observability (metrics, logs, traces)', serviceName: 'monitoring', description: 'Centralized observability stack for production services.', rtoMinutes: 240, rpoMinutes: 240, tier: 'tier_2', impactFinancial: 2, impactOperational: 4, impactReputation: 2, impactRegulatory: 1, workaround: 'Cloud provider default monitoring + manual health checks.' },
  { name: 'VPN / private network', serviceName: 'network-vpn', description: 'Site-to-site and remote-access VPN for office and staff.', rtoMinutes: 120, rpoMinutes: 60, tier: 'tier_1', impactFinancial: 3, impactOperational: 4, impactReputation: 2, impactRegulatory: 2, workaround: 'Zero-trust cloud app access; mobile tethering.' },
  { name: 'Customer support ticketing', serviceName: 'support', description: 'Helpdesk / ticketing system for customer issues.', rtoMinutes: 480, rpoMinutes: 240, tier: 'tier_2', impactFinancial: 2, impactOperational: 3, impactReputation: 4, impactRegulatory: 1, workaround: 'Shared inbox + shared spreadsheet triage; status page update.' },
  { name: 'Billing & payment processing', serviceName: 'billing', description: 'Subscription billing, invoicing, payment gateway.', rtoMinutes: 240, rpoMinutes: 15, tier: 'tier_1', impactFinancial: 5, impactOperational: 3, impactReputation: 4, impactRegulatory: 4, workaround: 'Manual invoicing queue; payment retry after recovery.' },
  { name: 'Backup & restore service', serviceName: 'backup', description: 'Centralized backup, snapshot, and restore orchestration.', rtoMinutes: 720, rpoMinutes: 1440, tier: 'tier_2', impactFinancial: 4, impactOperational: 4, impactReputation: 2, impactRegulatory: 4, workaround: 'Manual snapshot using cloud provider native tools.' },
  { name: 'DHCP / internal network services', serviceName: 'network-internal', description: 'DHCP, NTP, internal DNS, jump host, bastion.', rtoMinutes: 240, rpoMinutes: 1440, tier: 'tier_3', impactFinancial: 2, impactOperational: 3, impactReputation: 1, impactRegulatory: 1, workaround: 'Static IPs documented; cloud jump host for admin access.' },
];

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { cell += c; }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else { cell += c; }
    }
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}
function PlaceholderPage({ title, note }: { title: string; note: string }) { return <div className="space-y-4"><h1 className="text-2xl font-bold">{title}</h1><div className="rounded-lg border border-dashed border-border bg-card/50 p-12 text-center"><p className="text-sm text-muted-foreground">{note}</p></div></div>; }
function ErrorBox({ message }: { message: string }) { return <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{message}</div>; }
function Centered({ children }: { children: React.ReactNode }) { return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">{children}</div>; }
function NotFound() { return <div className="space-y-4 text-center"><h1 className="text-4xl font-bold">404</h1><p className="text-muted-foreground">Page not found</p><Link to="/" className="text-primary hover:underline">← Back to Dashboard</Link></div>; }

// ===== AI Providers =====

type AIProviderType = 'openai' | 'anthropic' | 'google' | 'openai_compatible';
type AIProvider = {
  id: string;
  provider: AIProviderType;
  apiKey: string;
  model: string;
  baseUrl?: string | null;
  maxTokens: number;
  temperature: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

const AI_PROVIDER_LABELS: Record<AIProviderType, { label: string; defaultModel: string; defaultBaseUrl?: string; description: string }> = {
  openai: { label: 'OpenAI', defaultModel: 'gpt-4o-mini', description: 'OpenAI native (api.openai.com).' },
  anthropic: { label: 'Anthropic', defaultModel: 'claude-3-5-sonnet-latest', description: 'Anthropic native (api.anthropic.com).' },
  google: { label: 'Google Gemini', defaultModel: 'gemini-1.5-flash', description: 'Google Generative AI (generativelanguage.googleapis.com).' },
  openai_compatible: { label: 'OpenAI-compatible', defaultModel: '', defaultBaseUrl: 'https://api.openrouter.ai/api/v1', description: 'Custom baseUrl for any OpenAI-spec endpoint (LiteLLM, Ollama, vLLM, OpenRouter, llama.cpp, etc).' },
};

function AIProvidersPage() {
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id?: string; ok: boolean; latencyMs?: number; sample?: string; error?: string } | null>(null);
  const toast = useToast();

  async function load() {
    setLoading(true);
    try {
      const data = await api<{ providers: AIProvider[] }>('/api/v1/ai/providers');
      setProviders(data.providers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load providers');
    } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(''); setTestResult(null);
    const form = event.currentTarget;
    const data = new FormData(form);
    const provider = data.get('provider') as AIProviderType;
    const baseUrl = String(data.get('baseUrl') ?? '').trim();
    const payload: Record<string, unknown> = {
      provider,
      apiKey: String(data.get('apiKey') ?? ''),
      model: String(data.get('model') ?? ''),
      maxTokens: Number(data.get('maxTokens') ?? 2048),
      temperature: Number(data.get('temperature') ?? 0.7),
      enabled: true,
    };
    if (baseUrl) payload.baseUrl = baseUrl;
    try {
      await api<AIProvider>('/api/v1/ai/providers', { method: 'POST', body: JSON.stringify(payload) });
      form.reset();
      setFormOpen(false);
      toast.success('Provider added');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add provider');
      toast.error('Failed to add provider');
    }
  }

  async function testInline(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(''); setTestResult(null);
    const data = new FormData(event.currentTarget);
    const provider = data.get('provider') as AIProviderType;
    const baseUrl = String(data.get('baseUrl') ?? '').trim();
    const payload: Record<string, unknown> = {
      provider,
      apiKey: String(data.get('apiKey') ?? ''),
      model: String(data.get('model') ?? ''),
    };
    if (baseUrl) payload.baseUrl = baseUrl;
    setTesting('inline');
    try {
      const res = await api<{ ok: boolean; latencyMs?: number; sample?: string; error?: string }>(
        '/api/v1/ai/providers/test',
        { method: 'POST', body: JSON.stringify(payload) }
      );
      setTestResult(res);
      if (res.ok) toast.success('Connection OK', { description: `${res.latencyMs}ms latency` });
      else toast.error('Connection failed', { description: res.error });
    } catch (err) {
      setTestResult({ ok: false, error: err instanceof Error ? err.message : 'Test failed' });
      toast.error('Test failed');
    } finally {
      setTesting(null);
    }
  }

  async function testSaved(provider: AIProvider) {
    setError(''); setTestResult(null);
    setTesting(provider.id);
    try {
      const start = Date.now();
      const csrf = cookieValue('resiliplan_csrf');
      const res = await fetch(`/api/v1/ai/suggest`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': decodeURIComponent(csrf) } : {}) },
        body: JSON.stringify({ section: 'Connectivity check', prompt: 'Reply with the single word: ok' }),
      });
      const latencyMs = Date.now() - start;
      if (!res.ok) {
        const text = await res.text();
        setTestResult({ id: provider.id, ok: false, error: text || `HTTP ${res.status}` });
        toast.error(`Test failed: ${provider.id.slice(0, 8)}`);
      } else {
        const sample = (await res.text()).trim().slice(0, 80);
        setTestResult({ id: provider.id, ok: true, latencyMs, sample });
        toast.success('Provider OK', { description: `${AI_PROVIDER_LABELS[provider.provider]?.label}: ${latencyMs}ms` });
      }
    } catch (err) {
      setTestResult({ id: provider.id, ok: false, error: err instanceof Error ? err.message : 'Test failed' });
      toast.error('Test failed');
    } finally {
      setTesting(null);
    }
  }

  async function toggle(id: string) {
    try {
      await api(`/api/v1/ai/providers/${id}/toggle`, { method: 'POST' });
      await load();
      toast.success('Provider toggled');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Toggle failed');
      toast.error('Toggle failed');
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this AI provider? Existing plans are not affected.')) return;
    try {
      await api(`/api/v1/ai/providers/${id}`, { method: 'DELETE' });
      await load();
      toast.success('Provider deleted');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
      toast.error('Delete failed');
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={<>System · AI Providers</>}
        title="AI Providers"
        description="BYO multi-provider. Supports OpenAI, Anthropic, Google, and any OpenAI-spec endpoint (LiteLLM, Ollama, vLLM, OpenRouter)."
        breadcrumbs={[{ label: 'AI Providers' }]}
        actions={<Button variant="primary" size="md" onClick={() => setFormOpen(!formOpen)} leftIcon={<Sparkles className="h-4 w-4" />}>{formOpen ? 'Cancel' : 'Add provider'}</Button>}
      />
      {error && <ErrorBox message={error} />}

      {formOpen && (
        <form onSubmit={submit} className="surface surface-lift grid gap-3 p-5 md:grid-cols-2">
          <label className="text-sm font-medium md:col-span-2">Provider
            <select name="provider" defaultValue="openai" className="input mt-1" onChange={(e) => {
              const meta = AI_PROVIDER_LABELS[e.currentTarget.value as AIProviderType];
              const modelInput = e.currentTarget.form?.querySelector<HTMLInputElement>('input[name="model"]');
              const baseInput = e.currentTarget.form?.querySelector<HTMLInputElement>('input[name="baseUrl"]');
              if (modelInput && !modelInput.value) modelInput.value = meta.defaultModel;
              if (baseInput) baseInput.value = meta.defaultBaseUrl ?? '';
            }}>
              {(Object.keys(AI_PROVIDER_LABELS) as AIProviderType[]).map((key) => (
                <option key={key} value={key}>{AI_PROVIDER_LABELS[key].label}</option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-muted-foreground">{AI_PROVIDER_LABELS.openai_compatible.description}</span>
          </label>
          <Input name="apiKey" label="API key" type="password" required placeholder="sk-..." />
          <Input name="model" label="Model name" required placeholder="e.g. gpt-4o-mini, claude-3-5-sonnet-latest" />
          <Input name="baseUrl" label="Base URL (only for OpenAI-compatible)" placeholder="https://api.openrouter.ai/api/v1" />
          <Input name="maxTokens" label="Max tokens" type="number" defaultValue="2048" />
          <Input name="temperature" label="Temperature" type="number" step="0.1" defaultValue="0.7" />
          <div className="md:col-span-2 flex gap-2">
            <Button type="submit" variant="primary" size="md">Save provider</Button>
            <Button type="button" variant="ghost" size="md" onClick={(e) => testInline({ preventDefault: () => {}, currentTarget: (e.currentTarget as HTMLButtonElement).form! } as unknown as React.FormEvent<HTMLFormElement>)}>
              {testing === 'inline' ? 'Testing…' : 'Test connection'}
            </Button>
          </div>
          {testResult && !testResult.id && (
            <div className={`md:col-span-2 rounded-lg border p-3 text-sm ${testResult.ok ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700' : 'border-destructive/30 bg-destructive/5 text-destructive'}`}>
              {testResult.ok ? `✓ Connection OK in ${testResult.latencyMs}ms — "${testResult.sample}"` : `✗ ${testResult.error}`}
            </div>
          )}
        </form>
      )}

      {loading ? <SkeletonList rows={3} /> : providers.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="h-8 w-8" />}
          title="No AI providers configured"
          description="Add one to enable AI helpers across DR Plans, BIA, Risks, and Assets."
          action={<Button variant="primary" size="md" onClick={() => setFormOpen(true)}>Add first provider</Button>}
        />
      ) : (
        <div className="surface surface-lift">
          <div className="grid border-b bg-muted/40 p-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1.2fr' }}>
            <div>Provider</div><div>Model</div><div>Base URL</div><div>Tokens</div><div>Status</div><div className="text-right">Actions</div>
          </div>
          {providers.map((p) => (
            <div key={p.id} className="grid items-center border-b p-3 text-sm last:border-0" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1.2fr' }}>
              <div><div className="font-medium">{AI_PROVIDER_LABELS[p.provider]?.label ?? p.provider}</div><div className="text-xs text-muted-foreground font-mono">key: {p.apiKey}</div></div>
              <div className="truncate pr-3">{p.model}</div>
              <div className="truncate pr-3 text-xs text-muted-foreground">{p.baseUrl ?? '—'}</div>
              <div>{p.maxTokens}</div>
              <div><StatusBadge status={p.enabled ? 'live' : 'cancelled'} label={p.enabled ? 'active' : 'off'} /></div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => testSaved(p)} disabled={testing === p.id}>{testing === p.id ? 'Testing…' : 'Test'}</Button>
                <Button variant="ghost" size="sm" onClick={() => toggle(p.id)}>{p.enabled ? 'Disable' : 'Enable'}</Button>
                <Button variant="ghost" size="sm" onClick={() => remove(p.id)}>Delete</Button>
              </div>
              {testResult?.id === p.id && (
                <div className={`col-span-6 mt-2 rounded-md border p-2 text-xs ${testResult.ok ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700' : 'border-destructive/30 bg-destructive/5 text-destructive'}`}>
                  {testResult.ok ? `✓ OK in ${testResult.latencyMs}ms — "${testResult.sample}"` : `✗ ${testResult.error}`}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
