import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { Activity, AlertTriangle, Bell, Calendar, CheckCircle2, CreditCard, Download, FileText, Home, Lock, LogOut, Mail, Save, Send, Server, Settings, Sparkles, Users } from 'lucide-react';
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
type ReadinessSummary = { status: string; failed: number; warnings: number; checks: Array<{ key: string; label: string; status: 'pass' | 'warn' | 'fail'; detail: string }> };
type TenantSettings = { smtp: { mode: 'outbox_only' | 'smtp'; host?: string; port?: number; from?: string; configuredFromDashboard?: boolean }; internalAccess: { mode: 'ip_port'; securityGroupRestricted: boolean; adminPolicy: string }; backup: { frequency: 'daily'; retentionDays: number }; sso: { enabled: boolean; provider: 'oidc' | 'azure_ad'; issuerUrl?: string; clientId?: string; redirectUri?: string } };
type AuditLogItem = { id: string; actorId?: string | null; actorEmail?: string | null; entityType: string; entityId: string; action: string; summary: string; metadata: Record<string, unknown>; appendOnly: boolean; createdAt: string };

const API = import.meta.env.VITE_API_URL ?? `${window.location.protocol}//${window.location.hostname}:3001`;
const COLLAB_WS = import.meta.env.VITE_COLLAB_WS_URL ?? `ws://${window.location.hostname}:3002`;

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

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    api<{ user: User }>('/api/v1/auth/me')
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setAuthLoading(false));
  }, []);

  if (authLoading) return <Centered>Loading ResiliPlan...</Centered>;
  if (!user) return <AuthRoutes onLogin={setUser} />;

  return <Shell user={user} onUserUpdate={setUser} onLogout={() => setUser(null)} />;
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

function Shell({ user, onUserUpdate, onLogout }: { user: User; onUserUpdate: (user: User) => void; onLogout: () => void }) {
  async function logout() {
    await api('/api/v1/auth/logout', { method: 'POST' });
    onLogout();
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground"><FileText className="h-4 w-4" /></div>
            <span className="font-semibold">ResiliPlan</span>
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">Phase 1 Core DRP</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>{user.name} · {user.role}</span>
            <button onClick={logout} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 hover:bg-muted"><LogOut className="h-3 w-3" /> Logout</button>
          </div>
        </div>
      </header>
      <div className="container flex gap-6 py-6">
        <aside className="w-56 shrink-0"><nav className="space-y-1 text-sm">
          <NavLink to="/" icon={<Home className="h-4 w-4" />}>Dashboard</NavLink>
          <NavLink to="/plans" icon={<FileText className="h-4 w-4" />}>DR Plans</NavLink>
          <NavLink to="/bia" icon={<CheckCircle2 className="h-4 w-4" />}>BIA</NavLink>
          <NavLink to="/assets" icon={<Server className="h-4 w-4" />}>Assets</NavLink>
          <NavLink to="/risks" icon={<AlertTriangle className="h-4 w-4" />}>Risks</NavLink>
          <NavLink to="/drills" icon={<Calendar className="h-4 w-4" />}>Drills</NavLink>
          <NavLink to="/users" icon={<Users className="h-4 w-4" />}>Users</NavLink>
          <NavLink to="/notifications" icon={<Bell className="h-4 w-4" />}>Notifications</NavLink>
          <NavLink to="/monitoring" icon={<Activity className="h-4 w-4" />}>Monitoring</NavLink>
          <NavLink to="/billing" icon={<CreditCard className="h-4 w-4" />}>Billing</NavLink>
          <NavLink to="/email-outbox" icon={<Mail className="h-4 w-4" />}>Email Outbox</NavLink>
          <NavLink to="/audit-trail" icon={<FileText className="h-4 w-4" />}>Audit Trail</NavLink>
          <NavLink to="/readiness" icon={<CheckCircle2 className="h-4 w-4" />}>Readiness</NavLink>
          <NavLink to="/settings" icon={<Settings className="h-4 w-4" />}>Settings</NavLink>
          <NavLink to="/security" icon={<Lock className="h-4 w-4" />}>Security</NavLink>
        </nav></aside>
        <main className="flex-1"><Routes>
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
          <Route path="/readiness" element={<ReadinessPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/security" element={<SecurityPage user={user} onUserUpdate={onUserUpdate} />} />
          <Route path="*" element={<NotFound />} />
        </Routes></main>
      </div>
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

  return <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6"><form onSubmit={submit} className="w-full max-w-md rounded-xl border bg-white p-8 shadow-sm">
    <div className="mb-6 flex items-center gap-2"><div className="rounded-lg bg-primary p-2 text-white"><Lock className="h-5 w-5" /></div><div><h1 className="text-xl font-semibold">Login ResiliPlan</h1><p className="text-sm text-muted-foreground">Core DRP workspace</p></div></div>
    {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <label className="text-sm font-medium">Email</label><input value={email} onChange={(e) => setEmail(e.target.value)} className="mb-4 mt-1 w-full rounded-md border px-3 py-2" />
    <label className="text-sm font-medium">Password</label><input value={password} onChange={(e) => setPassword(e.target.value)} type="password" className="mb-4 mt-1 w-full rounded-md border px-3 py-2" />
    <label className="text-sm font-medium">TOTP code <span className="text-muted-foreground">(if MFA enabled)</span></label><input value={totp} onChange={(e) => setTotp(e.target.value)} inputMode="numeric" className="mb-6 mt-1 w-full rounded-md border px-3 py-2" />
    <button disabled={loading} className="w-full rounded-md bg-primary px-4 py-2 font-medium text-white disabled:opacity-50">{loading ? 'Signing in...' : 'Sign in'}</button>
    <div className="mt-4 text-center text-sm"><Link to="/forgot-password" className="text-primary hover:underline">Forgot password?</Link></div>
  </form></div>;
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
  const navigate = useNavigate();

  async function load() {
    setLoading(true);
    try { setPlans((await api<{ plans: Plan[] }>('/api/v1/plans')).plans); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to load plans'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  const stats = useMemo(() => ({ total: plans.length, approved: plans.filter((p) => p.status === 'approved').length, review: plans.filter((p) => p.status === 'in_review').length }), [plans]);

  return <div className="space-y-6"><div className="flex items-start justify-between"><div><h1 className="text-2xl font-bold">DR Plans</h1><p className="text-sm text-muted-foreground">ISO 22301 template, approval, audit, export.</p></div><button onClick={() => setFormOpen(!formOpen)} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white">New DRP</button></div>
    <div className="grid gap-4 sm:grid-cols-3"><KpiCard label="Total" value={`${stats.total}`} hint="Plans" /><KpiCard label="Approved" value={`${stats.approved}`} hint="Signed-off" /><KpiCard label="In Review" value={`${stats.review}`} hint="Waiting approval" /></div>
    {formOpen && <NewPlanForm onCreated={(plan) => navigate(`/plans/${plan.id}`)} />}
    {error && <ErrorBox message={error} />}
    <div className="rounded-lg border bg-card"><div className="border-b p-4 font-medium">Plan register</div>{loading ? <div className="p-4 text-sm text-muted-foreground">Loading...</div> : plans.length === 0 ? <div className="p-8 text-center text-sm text-muted-foreground">Belum ada DRP. Buat plan pertama dari template ISO 22301.</div> : <div className="divide-y">{plans.map((plan) => <Link key={plan.id} to={`/plans/${plan.id}`} className="block p-4 hover:bg-muted/50"><div className="flex items-center justify-between"><div><div className="font-medium">{plan.title}</div><div className="text-sm text-muted-foreground">{plan.serviceName} · RTO {plan.rtoMinutes}m · RPO {plan.rpoMinutes}m</div></div><StatusBadge status={plan.status} /></div></Link>)}</div>}</div>
  </div>;
}

function NewPlanForm({ onCreated }: { onCreated: (plan: Plan) => void }) {
  const [error, setError] = useState('');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    const data = new FormData(event.currentTarget);
    try {
      const plan = await api<Plan>('/api/v1/plans', { method: 'POST', body: JSON.stringify({
        title: String(data.get('title')), serviceName: String(data.get('serviceName')), serviceOwner: String(data.get('serviceOwner')),
        criticality: String(data.get('criticality')), rtoMinutes: Number(data.get('rtoMinutes')), rpoMinutes: Number(data.get('rpoMinutes')),
        description: String(data.get('description') ?? ''), recoveryStrategy: String(data.get('recoveryStrategy') ?? ''),
      }) });
      onCreated(plan);
    } catch (err) { setError(err instanceof Error ? err.message : 'Create failed'); }
  }
  return <form onSubmit={submit} className="grid gap-4 rounded-lg border bg-card p-4 md:grid-cols-2">{error && <div className="md:col-span-2"><ErrorBox message={error} /></div>}
    <Input name="title" label="Plan title" placeholder="DRP Core Banking" required />
    <Input name="serviceName" label="Service name" placeholder="Core Banking" required />
    <Input name="serviceOwner" label="Service owner" placeholder="Nama PIC" required />
    <label className="text-sm font-medium">Criticality<select name="criticality" defaultValue="high" className="mt-1 w-full rounded-md border px-3 py-2"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label>
    <Input name="rtoMinutes" label="RTO minutes" type="number" defaultValue="240" required />
    <Input name="rpoMinutes" label="RPO minutes" type="number" defaultValue="60" required />
    <Input name="recoveryStrategy" label="Recovery strategy" placeholder="Warm standby / backup restore" />
    <label className="text-sm font-medium md:col-span-2">Description<textarea name="description" className="mt-1 h-20 w-full rounded-md border px-3 py-2" /></label>
    <div className="md:col-span-2"><button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white">Create from ISO 22301 template</button></div>
  </form>;
}

function PlanEditor() {
  const { id } = useParams();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [selected, setSelected] = useState('context');
  const [draft, setDraft] = useState('');
  const [message, setMessage] = useState('');
  const [comments, setComments] = useState<PlanComment[]>([]);
  const [versions, setVersions] = useState<PlanVersion[]>([]);
  const [commentBody, setCommentBody] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [collabStatus, setCollabStatus] = useState('offline');
  const [collabUsers, setCollabUsers] = useState(1);
  const [error, setError] = useState('');
  const yDocRef = useRef<Y.Doc | null>(null);
  const yTextRef = useRef<Y.Text | null>(null);
  async function load() {
    if (!id) return;
    try {
      const loaded = await api<Plan>(`/api/v1/plans/${id}`);
      const commentData = await api<{ comments: PlanComment[] }>(`/api/v1/plans/${id}/comments`);
      const versionData = await api<{ versions: PlanVersion[] }>(`/api/v1/plans/${id}/versions`);
      setPlan(loaded); setComments(commentData.comments); setVersions(versionData.versions); setSelected(loaded.sections?.[0]?.sectionKey ?? 'context'); setDraft(loaded.sections?.[0]?.contentMarkdown ?? '');
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
    const updated = await api<Section>(`/api/v1/plans/${id}/sections/${section.sectionKey}`, { method: 'PATCH', body: JSON.stringify({ contentMarkdown: draft }) });
    setPlan((p) => p ? { ...p, sections: p.sections?.map((s) => s.id === updated.id ? updated : s) } : p); setMessage('Section saved.');
  }
  async function submitReview() { if (!id) return; setPlan(await api<Plan>(`/api/v1/plans/${id}/submit`, { method: 'POST' })); setMessage('Submitted for approval.'); }
  async function approve() { if (!id) return; const signatureText = prompt('Approval signature text'); if (!signatureText) return; setPlan(await api<Plan>(`/api/v1/plans/${id}/approve`, { method: 'POST', body: JSON.stringify({ signatureText }) })); setMessage('Approved and signed.'); }
  async function createVersion() { if (!id) return; await api<PlanVersion>(`/api/v1/plans/${id}/versions`, { method: 'POST', body: JSON.stringify({ changeSummary: 'Manual snapshot from editor' }) }); await load(); setMessage('Version snapshot created.'); }
  async function rollbackVersion(versionId: string) { if (!id || !confirm('Rollback plan content to this version?')) return; setPlan(await api<Plan>(`/api/v1/plans/${id}/versions/${versionId}/rollback`, { method: 'POST' })); await load(); setMessage('Plan rolled back to selected version.'); }
  async function addComment() {
    if (!id || !section || !commentBody.trim()) return;
    const comment = await api<PlanComment>(`/api/v1/plans/${id}/comments`, { method: 'POST', body: JSON.stringify({ sectionKey: section.sectionKey, body: commentBody, parentCommentId: replyTo ?? undefined }) });
    setComments((current) => [...current, comment]); setCommentBody(''); setReplyTo(null); setMessage(replyTo ? 'Reply added.' : 'Comment added.');
  }
  async function resolveComment(commentId: string) {
    if (!id) return;
    const updated = await api<PlanComment>(`/api/v1/plans/${id}/comments/${commentId}`, { method: 'PATCH', body: JSON.stringify({ status: 'resolved' }) });
    setComments((current) => current.map((comment) => comment.id === updated.id ? updated : comment));
  }
  async function suggestWithAI() {
    if (!section || !plan || aiLoading) return;
    setAiLoading(true); setAiSuggestion(''); setMessage('');
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
    } finally { setAiLoading(false); }
  }
  function applyAISuggestion() {
    if (!aiSuggestion.trim()) return;
    updateDraft(aiSuggestion);
    setMessage('AI suggestion applied to draft. Click Save to persist.');
  }

  if (error) return <ErrorBox message={error} />;
  if (!plan) return <Centered>Loading plan...</Centered>;
  const currentComments = comments.filter((comment) => comment.sectionKey === selected);

  return <div className="space-y-4"><div className="flex items-start justify-between"><div><Link to="/plans" className="text-sm text-primary hover:underline">← Back to plans</Link><h1 className="mt-1 text-2xl font-bold">{plan.title}</h1><p className="text-sm text-muted-foreground">{plan.serviceName} · version {plan.version} · RTO {plan.rtoMinutes}m · RPO {plan.rpoMinutes}m</p><p className="mt-1 text-xs text-muted-foreground">Realtime collaboration: {collabStatus} · {collabUsers} active editor(s)</p></div><div className="flex items-center gap-2"><StatusBadge status={plan.status} /><button onClick={submitReview} className="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm"><Send className="h-4 w-4" /> Submit</button><button onClick={approve} className="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-2 text-sm text-white"><CheckCircle2 className="h-4 w-4" /> Approve</button></div></div>
    {message && <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">{message}</div>}
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]"><aside className="rounded-lg border bg-card p-3"><div className="mb-2 text-sm font-medium">14 ISO 22301 Sections</div><div className="space-y-1">{plan.sections?.map((s) => <button key={s.id} onClick={() => setSelected(s.sectionKey)} className={`w-full rounded-md px-3 py-2 text-left text-sm ${s.sectionKey === selected ? 'bg-primary text-white' : 'hover:bg-muted'}`}><div className="font-medium">{s.order}. {s.title.replace(/^\d+\. /, '')}</div><div className="text-xs opacity-75">{s.isoClause}</div></button>)}</div></aside>
      <section className="rounded-lg border bg-card"><div className="flex items-center justify-between border-b p-4"><div><h2 className="font-semibold">{section?.title}</h2><p className="text-xs text-muted-foreground">Compliance badge: {section?.isoClause}</p></div><div className="flex gap-2"><button onClick={suggestWithAI} disabled={aiLoading} className="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm disabled:opacity-50"><Sparkles className="h-4 w-4" /> {aiLoading ? 'AI drafting...' : 'AI Suggest'}</button><button onClick={saveSection} className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm text-white"><Save className="h-4 w-4" /> Save</button></div></div><textarea value={draft} onChange={(e) => updateDraft(e.target.value)} className="h-[520px] w-full resize-none p-4 font-mono text-sm outline-none" /></section></div>
    {aiSuggestion && <section className="rounded-lg border border-blue-200 bg-blue-50 p-4"><div className="flex items-center justify-between"><div><h2 className="font-semibold text-blue-900">AI suggestion</h2><p className="text-xs text-blue-700">Review before applying. AI output is draft-only until saved.</p></div><button onClick={applyAISuggestion} className="rounded-md bg-blue-700 px-3 py-2 text-sm text-white">Apply to draft</button></div><pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-white p-3 text-sm text-slate-800">{aiSuggestion}</pre></section>}
    <section className="rounded-lg border bg-card p-4"><div className="flex items-center justify-between"><div><h2 className="font-semibold">Section comments</h2><p className="text-xs text-muted-foreground">Use @email format to mention a reviewer. Replies stay linked to the parent comment.</p></div><StatusBadge status={`${currentComments.filter((comment) => comment.status === 'open').length} open`} /></div>{replyTo && <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 p-2 text-xs text-blue-700">Replying to comment {replyTo.slice(0, 8)}… <button onClick={() => setReplyTo(null)} className="ml-2 underline">cancel</button></div>}<div className="mt-3 flex gap-2"><input value={commentBody} onChange={(e) => setCommentBody(e.target.value)} placeholder="Add review note, reply, or @reviewer@datacomm.co.id" className="flex-1 rounded-md border px-3 py-2 text-sm" /><button onClick={addComment} className="rounded-md bg-primary px-3 py-2 text-sm text-white">{replyTo ? 'Add reply' : 'Add comment'}</button></div><div className="mt-4 space-y-2">{currentComments.length === 0 ? <p className="text-sm text-muted-foreground">No comments for this section.</p> : currentComments.map((comment) => <div key={comment.id} className={`rounded-md border p-3 text-sm ${comment.parentCommentId ? 'ml-6 bg-muted/30' : ''}`}><div className="flex items-center justify-between gap-3"><div><p>{comment.body}</p>{comment.parentCommentId && <p className="mt-1 text-xs text-muted-foreground">Reply to {comment.parentCommentId.slice(0, 8)}…</p>}{comment.mentionedEmails && comment.mentionedEmails.length > 0 && <p className="mt-1 text-xs text-blue-700">Mentions: {comment.mentionedEmails.join(', ')}</p>}</div><StatusBadge status={comment.status} /></div><div className="mt-2 flex gap-3">{comment.status === 'open' && <button onClick={() => resolveComment(comment.id)} className="text-xs text-primary hover:underline">Mark resolved</button>}<button onClick={() => setReplyTo(comment.id)} className="text-xs text-primary hover:underline">Reply</button></div></div>)}</div></section>
    <section className="rounded-lg border bg-card p-4"><div className="flex items-center justify-between"><div><h2 className="font-semibold">Version history</h2><p className="text-xs text-muted-foreground">Create snapshots before major changes and rollback when needed.</p></div><button onClick={createVersion} className="rounded-md bg-primary px-3 py-2 text-sm text-white">Create snapshot</button></div><div className="mt-3 space-y-2">{versions.length === 0 ? <p className="text-sm text-muted-foreground">No snapshots yet.</p> : versions.map((version) => <div key={version.id} className="flex items-center justify-between rounded-md border p-3 text-sm"><div><span className="font-medium">Version {version.version}</span><span className="ml-2 text-muted-foreground">{version.changeSummary}</span><p className="text-xs text-muted-foreground">{new Date(version.createdAt).toLocaleString()}</p></div><button onClick={() => rollbackVersion(version.id)} className="text-xs text-primary hover:underline">Rollback</button></div>)}</div></section>
    <div className="flex flex-wrap gap-2"><DownloadLink href={`/api/v1/plans/${plan.id}/export/markdown`} label="Markdown" /><DownloadLink href={`/api/v1/plans/${plan.id}/export/pdf`} label="PDF" /><DownloadLink href={`/api/v1/plans/${plan.id}/export/docx`} label="DOCX" /><DownloadLink href={`/api/v1/plans/${plan.id}/audit.csv`} label="Audit CSV" /></div>
  </div>;
}

function SecurityPage({ user, onUserUpdate }: { user: User; onUserUpdate: (user: User) => void }) {
  const [secret, setSecret] = useState('');
  const [otpauthUrl, setOtpauthUrl] = useState('');
  const [token, setToken] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function setupMfa() {
    setError(''); setMessage('');
    try {
      const data = await api<{ secret: string; otpauthUrl: string }>('/api/v1/auth/mfa/setup', { method: 'POST' });
      setSecret(data.secret);
      setOtpauthUrl(data.otpauthUrl);
      setMessage('Secret generated. Add it to your authenticator app, then verify the 6-digit code.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to setup MFA'); }
  }

  async function verifyMfa() {
    setError(''); setMessage('');
    try {
      await api('/api/v1/auth/mfa/verify', { method: 'POST', body: JSON.stringify({ token }) });
      onUserUpdate({ ...user, mfaEnabled: true });
      setMessage('MFA enabled for this admin account. Next login requires TOTP token.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to verify MFA'); }
  }

  return <div className="space-y-6"><div><h1 className="text-2xl font-bold">Security Settings</h1><p className="text-sm text-muted-foreground">Admin MFA hardening for Phase 1.</p></div>
    {error && <ErrorBox message={error} />}
    {message && <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">{message}</div>}
    <div className="rounded-lg border bg-card p-6"><div className="flex items-center justify-between"><div><h2 className="font-semibold">Multi-factor authentication</h2><p className="text-sm text-muted-foreground">Status: {user.mfaEnabled ? 'enabled' : 'not enabled'}</p></div><StatusBadge status={user.mfaEnabled ? 'approved' : 'draft'} /></div>
      <div className="mt-5 space-y-4"><button onClick={setupMfa} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white">Generate MFA secret</button>
        {secret && <div className="rounded-md border bg-muted/40 p-4"><p className="text-sm font-medium">Manual secret</p><code className="mt-2 block break-all rounded bg-white p-2 text-xs">{secret}</code><p className="mt-3 text-sm font-medium">OTP Auth URL</p><code className="mt-2 block break-all rounded bg-white p-2 text-xs">{otpauthUrl}</code><div className="mt-4 flex gap-2"><input value={token} onChange={(e) => setToken(e.target.value)} placeholder="6-digit code" className="w-40 rounded-md border px-3 py-2" /><button onClick={verifyMfa} className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white">Verify & Enable</button></div></div>}
      </div>
    </div>
  </div>;
}

function BiaPage() {
  const [entries, setEntries] = useState<BiaEntry[]>([]);
  const [summary, setSummary] = useState<BiaSummary | null>(null);
  const [error, setError] = useState('');
  async function load() {
    try {
      const data = await api<{ entries: BiaEntry[]; summary: BiaSummary }>('/api/v1/bia');
      setEntries(data.entries); setSummary(data.summary);
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to load BIA'); }
  }
  useEffect(() => { void load(); }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      await api<BiaEntry>('/api/v1/bia', { method: 'POST', body: JSON.stringify({ serviceName: data.get('serviceName'), processName: data.get('processName'), owner: data.get('owner'), impact1h: Number(data.get('impact1h')), impact4h: Number(data.get('impact4h')), impact24h: Number(data.get('impact24h')), financialImpact: Number(data.get('financialImpact')), reputationalImpact: Number(data.get('reputationalImpact')), regulatoryImpact: Number(data.get('regulatoryImpact')), currentRtoMinutes: Number(data.get('currentRtoMinutes')), currentRpoMinutes: Number(data.get('currentRpoMinutes')), dependencyNotes: data.get('dependencyNotes'), workaround: data.get('workaround') }) });
      form.reset(); await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Create BIA failed'); }
  }
  return <RegisterPage title="BIA" subtitle="Business Impact Analysis: impact window, impact dimensions, RTO/RPO, and tier." error={error}><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"><KpiCard label="Total BIA" value={`${summary?.totalBia ?? 0}`} hint="Processes" /><KpiCard label="Tier 1" value={`${summary?.tier1 ?? 0}`} hint="Most critical" /><KpiCard label="Tier 2" value={`${summary?.tier2 ?? 0}`} hint="High impact" /><KpiCard label="Fastest RTO" value={summary?.fastestRtoMinutes ? `${summary.fastestRtoMinutes}m` : '-'} hint="Lowest target" /><KpiCard label="Fastest RPO" value={summary?.fastestRpoMinutes ? `${summary.fastestRpoMinutes}m` : '-'} hint="Lowest target" /></div><form onSubmit={submit} className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-4"><Input name="serviceName" label="Service" required /><Input name="processName" label="Business process" required /><Input name="owner" label="Owner" required /><Input name="currentRtoMinutes" label="RTO minutes" type="number" defaultValue="240" required /><Input name="currentRpoMinutes" label="RPO minutes" type="number" defaultValue="60" required /><Input name="impact1h" label="Impact 1h (1-5)" type="number" min="1" max="5" defaultValue="3" required /><Input name="impact4h" label="Impact 4h (1-5)" type="number" min="1" max="5" defaultValue="4" required /><Input name="impact24h" label="Impact 24h (1-5)" type="number" min="1" max="5" defaultValue="4" required /><Input name="financialImpact" label="Financial (1-5)" type="number" min="1" max="5" defaultValue="3" required /><Input name="reputationalImpact" label="Reputation (1-5)" type="number" min="1" max="5" defaultValue="3" required /><Input name="regulatoryImpact" label="Regulatory (1-5)" type="number" min="1" max="5" defaultValue="3" required /><label className="text-sm font-medium">Dependency notes<textarea name="dependencyNotes" className="mt-1 h-20 w-full rounded-md border px-3 py-2" /></label><label className="text-sm font-medium md:col-span-4">Workaround<textarea name="workaround" className="mt-1 h-20 w-full rounded-md border px-3 py-2" /></label><div className="md:col-span-4"><button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white">Add BIA entry</button></div></form><SimpleTable headers={['Service','Process','Tier','Max','RTO','RPO','Owner']} rows={entries.map((entry) => [entry.serviceName, entry.processName, entry.criticalityTier.replace('_', ' '), String(entry.maxImpactScore), `${entry.currentRtoMinutes}m`, `${entry.currentRpoMinutes}m`, entry.owner])} empty="No BIA entries registered." /></RegisterPage>;
}

function AssetsPage() {
  const [assets, setAssets] = useState<ServiceAsset[]>([]);
  const [error, setError] = useState('');
  async function load() { try { setAssets((await api<{ assets: ServiceAsset[] }>('/api/v1/assets')).assets); } catch (err) { setError(err instanceof Error ? err.message : 'Failed to load assets'); } }
  useEffect(() => { void load(); }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      await api<ServiceAsset>('/api/v1/assets', { method: 'POST', body: JSON.stringify({ serviceName: data.get('serviceName'), assetName: data.get('assetName'), assetType: data.get('assetType'), owner: data.get('owner'), criticality: data.get('criticality'), recoveryPriority: Number(data.get('recoveryPriority')), dependencies: String(data.get('dependencies') ?? '').split(',').map((item) => item.trim()).filter(Boolean), notes: data.get('notes') }) });
      form.reset(); await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Create asset failed'); }
  }
  return <RegisterPage title="Assets" subtitle="Service dependency and recovery-priority register." error={error}><form onSubmit={submit} className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-3"><Input name="serviceName" label="Service" required /><Input name="assetName" label="Asset name" required /><Input name="assetType" placeholder="database / vm / network" required label="Asset type" /><Input name="owner" label="Owner" required /><Input name="recoveryPriority" label="Recovery priority" type="number" min="1" max="5" defaultValue="3" required /><label className="text-sm font-medium">Criticality<select name="criticality" defaultValue="high" className="mt-1 w-full rounded-md border px-3 py-2"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label><Input name="dependencies" label="Dependencies" placeholder="comma separated" /><label className="text-sm font-medium md:col-span-2">Notes<textarea name="notes" className="mt-1 h-20 w-full rounded-md border px-3 py-2" /></label><div className="md:col-span-3"><button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white">Add asset</button></div></form><div className="rounded-lg border bg-card p-4"><h2 className="font-semibold">Dependency map</h2><p className="text-xs text-muted-foreground">Shows declared upstream/downstream dependencies per asset.</p><div className="mt-3 space-y-2">{assets.filter((asset) => asset.dependencies.length > 0).length === 0 ? <p className="text-sm text-muted-foreground">No dependencies declared yet.</p> : assets.filter((asset) => asset.dependencies.length > 0).map((asset) => <div key={asset.id} className="rounded-md border p-3 text-sm"><span className="font-medium">{asset.assetName}</span><span className="mx-2 text-muted-foreground">depends on</span>{asset.dependencies.map((dependency) => <span key={dependency} className="mr-2 rounded-full bg-slate-100 px-2 py-1 text-xs">{dependency}</span>)}</div>)}</div></div><SimpleTable headers={['Service','Asset','Type','Owner','Priority','Criticality']} rows={assets.map((asset) => [asset.serviceName, asset.assetName, asset.assetType, asset.owner, String(asset.recoveryPriority), asset.criticality])} empty="No assets registered." /></RegisterPage>;
}

function RisksPage() {
  const [risks, setRisks] = useState<ServiceRisk[]>([]);
  const [error, setError] = useState('');
  async function load() { try { setRisks((await api<{ risks: ServiceRisk[] }>('/api/v1/risks')).risks); } catch (err) { setError(err instanceof Error ? err.message : 'Failed to load risks'); } }
  useEffect(() => { void load(); }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      await api<ServiceRisk>('/api/v1/risks', { method: 'POST', body: JSON.stringify({ serviceName: data.get('serviceName'), riskTitle: data.get('riskTitle'), category: data.get('category'), probability: Number(data.get('probability')), impact: Number(data.get('impact')), owner: data.get('owner'), mitigation: data.get('mitigation') }) });
      form.reset(); await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Create risk failed'); }
  }
  return <RegisterPage title="Risks" subtitle="Probability × impact risk register tied to DR readiness." error={error}><form onSubmit={submit} className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-3"><Input name="serviceName" label="Service" required /><Input name="riskTitle" label="Risk title" required /><Input name="category" label="Category" required /><Input name="probability" label="Probability 1-5" type="number" min="1" max="5" defaultValue="3" required /><Input name="impact" label="Impact 1-5" type="number" min="1" max="5" defaultValue="4" required /><Input name="owner" label="Owner" /><label className="text-sm font-medium md:col-span-3">Mitigation<textarea name="mitigation" className="mt-1 h-20 w-full rounded-md border px-3 py-2" /></label><div className="md:col-span-3"><button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white">Add risk</button></div></form><div className="rounded-lg border bg-card p-4"><h2 className="font-semibold">Risk heatmap</h2><p className="text-xs text-muted-foreground">Grid count by probability and impact.</p><div className="mt-3 grid max-w-xl grid-cols-6 gap-1 text-center text-xs"><div></div>{[1,2,3,4,5].map((impact) => <div key={impact} className="font-medium">I{impact}</div>)}{[5,4,3,2,1].map((probability) => <><div key={`p-${probability}`} className="py-2 font-medium">P{probability}</div>{[1,2,3,4,5].map((impact) => { const count = risks.filter((risk) => risk.probability === probability && risk.impact === impact).length; const score = probability * impact; const color = score >= 15 ? 'bg-red-100 text-red-700' : score >= 8 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-700'; return <div key={`${probability}-${impact}`} className={`rounded p-2 ${color}`}>{count}</div>; })}</>)}</div></div><SimpleTable headers={['Service','Risk','Category','Score','Owner','Status']} rows={risks.map((risk) => [risk.serviceName, risk.riskTitle, risk.category, String(risk.riskScore), risk.owner || '-', risk.status])} empty="No risks registered." /></RegisterPage>;
}

function DrillsPage() {
  const [drills, setDrills] = useState<RecoveryDrill[]>([]);
  const [error, setError] = useState('');
  async function load() { try { setDrills((await api<{ drills: RecoveryDrill[] }>('/api/v1/drills')).drills); } catch (err) { setError(err instanceof Error ? err.message : 'Failed to load drills'); } }
  useEffect(() => { void load(); }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      await api<RecoveryDrill>('/api/v1/drills', { method: 'POST', body: JSON.stringify({ serviceName: data.get('serviceName'), drillTitle: data.get('drillTitle'), scheduledAt: new Date(String(data.get('scheduledAt'))).toISOString(), scope: data.get('scope'), owner: data.get('owner') }) });
      form.reset(); await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Create drill failed'); }
  }
  async function completeDrill(drill: RecoveryDrill) {
    const resultSummary = prompt('Result summary / evidence notes', drill.resultSummary || 'Completed successfully');
    if (resultSummary === null) return;
    await api<RecoveryDrill>(`/api/v1/drills/${drill.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'completed', resultSummary }) });
    await load();
  }
  return <RegisterPage title="Drills" subtitle="Recovery exercise calendar and result tracking." error={error}><form onSubmit={submit} className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-2"><Input name="serviceName" label="Service" required /><Input name="drillTitle" label="Drill title" required /><Input name="scheduledAt" label="Schedule" type="datetime-local" required /><Input name="owner" label="Owner" required /><label className="text-sm font-medium md:col-span-2">Scope<textarea name="scope" className="mt-1 h-20 w-full rounded-md border px-3 py-2" required /></label><div className="md:col-span-2"><button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white">Schedule drill</button></div></form><div className="rounded-lg border bg-card"><div className="border-b p-4 font-medium">Drill results</div>{drills.length === 0 ? <div className="p-6 text-center text-sm text-muted-foreground">No drills scheduled.</div> : <div className="divide-y">{drills.map((drill) => <div key={drill.id} className="flex items-center justify-between gap-3 p-4 text-sm"><div><div className="font-medium">{drill.drillTitle}</div><div className="text-muted-foreground">{drill.serviceName} · {new Date(drill.scheduledAt).toLocaleString()} · {drill.owner}</div>{drill.resultSummary && <p className="mt-1 text-xs text-muted-foreground">Result: {drill.resultSummary}</p>}</div><div className="flex items-center gap-2"><StatusBadge status={drill.status} />{drill.status !== 'completed' && <button onClick={() => completeDrill(drill)} className="rounded-md border px-3 py-2 text-xs">Mark completed</button>}</div></div>)}</div>}</div></RegisterPage>;
}

function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState('');
  async function load() { try { const data = await api<{ notifications: NotificationItem[]; unread: number }>('/api/v1/notifications'); setItems(data.notifications); setUnread(data.unread); } catch (err) { setError(err instanceof Error ? err.message : 'Failed to load notifications'); } }
  useEffect(() => { void load(); }, []);
  async function markRead(id: string) { await api<NotificationItem>(`/api/v1/notifications/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'read' }) }); await load(); }
  return <RegisterPage title="Notifications" subtitle={`${unread} unread operational notifications.`} error={error}>{items.length === 0 ? <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">No notifications.</div> : <div className="space-y-2">{items.map((item) => <div key={item.id} className="rounded-lg border bg-card p-4 text-sm"><div className="flex items-center justify-between gap-3"><div><div className="font-medium">{item.title}</div><div className="text-muted-foreground">{item.type} · {new Date(item.createdAt).toLocaleString()}</div><p className="mt-2">{item.body}</p></div><div className="flex items-center gap-2"><StatusBadge status={item.status} />{item.status === 'unread' && <button onClick={() => markRead(item.id)} className="rounded-md border px-3 py-2 text-xs">Mark read</button>}</div></div></div>)}</div>}</RegisterPage>;
}

function MonitoringPage() {
  const [summary, setSummary] = useState<MonitoringSummary | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { api<MonitoringSummary>('/api/v1/monitoring/summary').then(setSummary).catch((err) => setError(err instanceof Error ? err.message : 'Failed to load monitoring')); }, []);
  return <RegisterPage title="Monitoring" subtitle="Operational counters and runtime health." error={error}>{!summary ? <Centered>Loading monitoring...</Centered> : <><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"><KpiCard label="Plans" value={`${summary.counters.plans}`} hint="DRP total" /><KpiCard label="Users" value={`${summary.counters.users}`} hint="Tenant users" /><KpiCard label="Risks" value={`${summary.counters.risks}`} hint="Risk records" /><KpiCard label="Drills" value={`${summary.counters.drills}`} hint="Exercise records" /><KpiCard label="Notifications" value={`${summary.counters.notifications}`} hint="Unread" /></div><div className="rounded-lg border bg-card p-4 text-sm"><h2 className="font-semibold">Runtime</h2><p className="mt-2 text-muted-foreground">Status: {summary.status} · Uptime: {summary.system.uptimeSeconds}s · Memory: {summary.system.memoryUsageMB} MB · Updated: {new Date(summary.timestamp).toLocaleString()}</p></div></>}</RegisterPage>;
}

function BillingPage() {
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { api<BillingSummary>('/api/v1/billing/summary').then(setSummary).catch((err) => setError(err instanceof Error ? err.message : 'Failed to load billing')); }, []);
  return <RegisterPage title="Billing" subtitle="Subscription limits and usage metering foundation." error={error}>{!summary ? <Centered>Loading billing...</Centered> : <><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><KpiCard label="Plan" value={summary.subscription.planCode} hint={summary.subscription.status} /><KpiCard label="Seats limit" value={`${summary.subscription.seatsLimit}`} hint="User seats" /><KpiCard label="Plans limit" value={`${summary.subscription.plansLimit}`} hint="DRP limit" /><KpiCard label="AI limit" value={`${summary.subscription.aiRequestsLimit}`} hint="Requests / period" /></div><div className="rounded-lg border bg-card p-4"><h2 className="font-semibold">Usage events</h2><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{['plan_created','ai_request','export_generated','collaboration_session'].map((key) => <div key={key} className="rounded-md border p-3 text-sm"><div className="text-muted-foreground">{key}</div><div className="text-2xl font-bold">{summary.usage[key] ?? 0}</div></div>)}</div><p className="mt-3 text-xs text-muted-foreground">Current period ends {new Date(summary.subscription.currentPeriodEnd).toLocaleString()}</p></div></>}</RegisterPage>;
}

function EmailOutboxPage() {
  const [emails, setEmails] = useState<EmailOutboxItem[]>([]);
  const [queued, setQueued] = useState(0);
  const [error, setError] = useState('');
  async function load() { try { const data = await api<{ emails: EmailOutboxItem[]; queued: number }>('/api/v1/email-outbox'); setEmails(data.emails); setQueued(data.queued); } catch (err) { setError(err instanceof Error ? err.message : 'Failed to load email outbox'); } }
  useEffect(() => { void load(); }, []);
  async function updateStatus(id: string, status: EmailOutboxItem['status']) { await api<EmailOutboxItem>(`/api/v1/email-outbox/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }); await load(); }
  return <RegisterPage title="Email Outbox" subtitle={`${queued} queued draft email(s). Outbound SMTP is approval/config gated.`} error={error}>{emails.length === 0 ? <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">No queued emails.</div> : <div className="space-y-3">{emails.map((email) => <div key={email.id} className="rounded-lg border bg-card p-4 text-sm"><div className="flex items-start justify-between gap-4"><div><div className="font-medium">{email.subject}</div><div className="text-muted-foreground">{email.emailType} · to {email.toEmail} · {new Date(email.queuedAt).toLocaleString()}</div><pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-xs">{email.bodyText}</pre>{email.lastError && <p className="mt-2 text-xs text-red-600">Last error: {email.lastError}</p>}</div><div className="flex shrink-0 flex-col gap-2"><StatusBadge status={email.status} />{email.status === 'queued' && <><button onClick={() => updateStatus(email.id, 'sent')} className="rounded-md border px-3 py-2 text-xs">Mark sent</button><button onClick={() => updateStatus(email.id, 'cancelled')} className="rounded-md border px-3 py-2 text-xs">Cancel</button></>}</div></div></div>)}</div>}</RegisterPage>;
}

function AuditTrailPage() {
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [q, setQ] = useState('');
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const [limit, setLimit] = useState(50);
  const [error, setError] = useState('');
  const entityTypes = ['drp_plan', 'drp_section', 'plan_version', 'plan_comment', 'bia_entry', 'service_asset', 'service_risk', 'recovery_drill', 'email_outbox', 'tenant_settings', 'user'];
  const actions = ['create', 'update', 'submit', 'approve', 'rollback', 'queue', 'sent', 'cancelled', 'failed'];
  async function load() {
    try {
      setError('');
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (entityType) params.set('entityType', entityType);
      if (action) params.set('action', action);
      params.set('limit', String(limit));
      const data = await api<{ auditLogs: AuditLogItem[] }>(`/api/v1/audit-trail?${params.toString()}`);
      setItems(data.auditLogs);
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to load audit trail'); }
  }
  useEffect(() => { void load(); }, []);
  function submit(event: React.FormEvent) { event.preventDefault(); void load(); }
  return <RegisterPage title="Audit Trail" subtitle="Tenant-scoped append-only activity log for DRP, BIA, users, settings, and outbound queue actions." error={error}><form onSubmit={submit} className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-5"><Input name="q" label="Search" placeholder="summary, action, entity id" value={q} onChange={(e) => setQ(e.target.value)} /><label className="text-sm font-medium">Entity<select value={entityType} onChange={(e) => setEntityType(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2"><option value="">All entities</option>{entityTypes.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label className="text-sm font-medium">Action<select value={action} onChange={(e) => setAction(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2"><option value="">All actions</option>{actions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><Input name="limit" label="Limit" type="number" min="1" max="100" value={limit} onChange={(e) => setLimit(Number(e.target.value) || 50)} /><div className="flex items-end"><button className="w-full rounded-md bg-primary px-4 py-2 text-sm text-white">Search</button></div></form><div className="space-y-2">{items.length === 0 ? <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">No audit records found.</div> : items.map((item) => <div key={item.id} className="rounded-lg border bg-card p-4 text-sm"><div className="flex items-start justify-between gap-4"><div><div className="font-medium">{item.summary}</div><div className="text-muted-foreground">{item.entityType} · {item.action} · {item.actorEmail ?? 'system'} · {new Date(item.createdAt).toLocaleString()}</div><div className="mt-1 text-xs text-muted-foreground">Entity ID: {item.entityId}</div>{Object.keys(item.metadata ?? {}).length > 0 && <pre className="mt-3 max-h-28 overflow-auto whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-xs">{JSON.stringify(item.metadata, null, 2)}</pre>}</div><StatusBadge status={item.appendOnly ? 'append-only' : 'mutable'} /></div></div>)}</div></RegisterPage>;
}

function ReadinessPage() {
  const [summary, setSummary] = useState<ReadinessSummary | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { api<ReadinessSummary>('/api/v1/readiness').then(setSummary).catch((err) => setError(err instanceof Error ? err.message : 'Failed to load readiness')); }, []);
  const badgeClass = (status: string) => status === 'pass' ? 'border-green-200 bg-green-50 text-green-700' : status === 'warn' ? 'border-yellow-200 bg-yellow-50 text-yellow-800' : 'border-red-200 bg-red-50 text-red-700';
  return <RegisterPage title="Production Readiness" subtitle="Internal go-live checks for a professional operating posture." error={error}>{!summary ? <Centered>Loading readiness...</Centered> : <><div className="grid gap-4 sm:grid-cols-3"><KpiCard label="Overall" value={summary.status} hint="readiness state" /><KpiCard label="Warnings" value={`${summary.warnings}`} hint="needs decision" /><KpiCard label="Failures" value={`${summary.failed}`} hint="must fix" /></div><div className="space-y-2">{summary.checks.map((check) => <div key={check.key} className={`rounded-lg border p-4 text-sm ${badgeClass(check.status)}`}><div className="flex items-center justify-between"><div className="font-medium">{check.label}</div><span className="uppercase">{check.status}</span></div><p className="mt-2">{check.detail}</p></div>)}</div></>}</RegisterPage>;
}

function SettingsPage() {
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function load() { try { const data = await api<{ settings: TenantSettings }>('/api/v1/settings'); setSettings(data.settings); } catch (err) { setError(err instanceof Error ? err.message : 'Failed to load settings'); } }
  useEffect(() => { void load(); }, []);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setMessage('');
    const form = event.currentTarget; const data = new FormData(form);
    try {
      const payload: TenantSettings = {
        smtp: { mode: data.get('smtpMode') as 'outbox_only' | 'smtp', host: String(data.get('smtpHost') || '') || undefined, port: Number(data.get('smtpPort') || 0) || undefined, from: String(data.get('smtpFrom') || '') || undefined, configuredFromDashboard: true },
        internalAccess: { mode: 'ip_port', securityGroupRestricted: data.get('securityGroupRestricted') === 'on', adminPolicy: String(data.get('adminPolicy') || 'single_admin_erwin_only') },
        backup: { frequency: 'daily', retentionDays: Number(data.get('retentionDays') || 14) },
        sso: { enabled: data.get('ssoEnabled') === 'on', provider: data.get('ssoProvider') as 'oidc' | 'azure_ad', issuerUrl: String(data.get('ssoIssuerUrl') || '') || undefined, clientId: String(data.get('ssoClientId') || '') || undefined, redirectUri: String(data.get('ssoRedirectUri') || '') || undefined },
      };
      const updated = await api<{ settings: TenantSettings }>('/api/v1/settings', { method: 'PATCH', body: JSON.stringify(payload) });
      setSettings(updated.settings); setMessage('Settings saved.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Save settings failed'); }
  }
  if (!settings) return <RegisterPage title="Settings" subtitle="Internal production posture." error={error}><Centered>Loading settings...</Centered></RegisterPage>;
  return <RegisterPage title="Settings" subtitle="Internal office access via IP:port; SMTP can be configured later from this dashboard." error={error}>{message && <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">{message}</div>}<form onSubmit={save} className="grid gap-4 rounded-lg border bg-card p-4 md:grid-cols-2"><label className="text-sm font-medium">SMTP mode<select name="smtpMode" defaultValue={settings.smtp.mode} className="mt-1 w-full rounded-md border px-3 py-2"><option value="outbox_only">Outbox only for now</option><option value="smtp">SMTP configured</option></select></label><Input name="smtpHost" label="SMTP host" defaultValue={settings.smtp.host ?? ''} /><Input name="smtpPort" label="SMTP port" type="number" defaultValue={settings.smtp.port ? String(settings.smtp.port) : ''} /><Input name="smtpFrom" label="SMTP from" defaultValue={settings.smtp.from ?? ''} /><label className="text-sm font-medium">Access model<input name="accessMode" value="IP and port" disabled className="mt-1 w-full rounded-md border bg-muted px-3 py-2" /></label><label className="flex items-center gap-2 text-sm font-medium"><input name="securityGroupRestricted" type="checkbox" defaultChecked={settings.internalAccess.securityGroupRestricted} /> Restricted by VM security group</label><Input name="adminPolicy" label="Admin policy" defaultValue={settings.internalAccess.adminPolicy} /><Input name="retentionDays" label="Backup retention days" type="number" defaultValue={String(settings.backup.retentionDays)} /><div className="md:col-span-2 border-t pt-4"><h2 className="font-semibold">SSO / OIDC scaffold</h2><p className="text-xs text-muted-foreground">Disabled by default. Fill when Azure AD/OIDC details are ready.</p></div><label className="flex items-center gap-2 text-sm font-medium"><input name="ssoEnabled" type="checkbox" defaultChecked={settings.sso.enabled} /> Enable SSO after credentials are validated</label><label className="text-sm font-medium">Provider<select name="ssoProvider" defaultValue={settings.sso.provider} className="mt-1 w-full rounded-md border px-3 py-2"><option value="oidc">Generic OIDC</option><option value="azure_ad">Azure AD</option></select></label><Input name="ssoIssuerUrl" label="Issuer URL" defaultValue={settings.sso.issuerUrl ?? ''} /><Input name="ssoClientId" label="Client ID" defaultValue={settings.sso.clientId ?? ''} /><Input name="ssoRedirectUri" label="Redirect URI" defaultValue={settings.sso.redirectUri ?? ''} /><div className="md:col-span-2"><button className="rounded-md bg-primary px-4 py-2 text-sm text-white">Save settings</button></div></form></RegisterPage>;
}

function UsersPage() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [error, setError] = useState('');
  async function load() { try { setUsers((await api<{ users: ManagedUser[] }>('/api/v1/users')).users); } catch (err) { setError(err instanceof Error ? err.message : 'Failed to load users'); } }
  useEffect(() => { void load(); }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      await api<ManagedUser>('/api/v1/users', { method: 'POST', body: JSON.stringify({ email: data.get('email'), name: data.get('name'), role: data.get('role'), password: data.get('password') }) });
      form.reset(); await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Create user failed'); }
  }
  return <RegisterPage title="Users" subtitle="Tenant user management and RBAC foundation." error={error}><form onSubmit={submit} className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-4"><Input name="email" label="Email" type="email" required /><Input name="name" label="Name" required /><label className="text-sm font-medium">Role<select name="role" defaultValue="viewer" className="mt-1 w-full rounded-md border px-3 py-2"><option value="admin">Admin</option><option value="coordinator">Coordinator</option><option value="owner">Owner</option><option value="viewer">Viewer</option></select></label><Input name="password" label="Temporary password" type="password" required /><div className="md:col-span-4"><button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white">Create user</button></div></form><SimpleTable headers={['Email','Name','Role','MFA','Status']} rows={users.map((item) => [item.email, item.name, item.role, item.mfaEnabled ? 'enabled' : 'off', item.disabled ? 'disabled' : 'active'])} empty="No users found." /></RegisterPage>;
}

function RegisterPage({ title, subtitle, error, children }: { title: string; subtitle: string; error: string; children: React.ReactNode }) { return <div className="space-y-6"><div><h1 className="text-2xl font-bold">{title}</h1><p className="text-sm text-muted-foreground">{subtitle}</p></div>{error && <ErrorBox message={error} />}{children}</div>; }
function SimpleTable({ headers, rows, empty }: { headers: string[]; rows: string[][]; empty: string }) { return <div className="overflow-hidden rounded-lg border bg-card"><div className="grid border-b bg-muted/40 p-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground" style={{ gridTemplateColumns: `repeat(${headers.length}, minmax(0, 1fr))` }}>{headers.map((header) => <div key={header}>{header}</div>)}</div>{rows.length === 0 ? <div className="p-6 text-center text-sm text-muted-foreground">{empty}</div> : rows.map((row, index) => <div key={index} className="grid border-b p-3 text-sm last:border-0" style={{ gridTemplateColumns: `repeat(${headers.length}, minmax(0, 1fr))` }}>{row.map((cell, cellIndex) => <div key={cellIndex} className="truncate pr-3">{cell}</div>)}</div>)}</div>; }

function DownloadLink({ href, label }: { href: string; label: string }) { return <a href={`${API}${href}`} className="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm"><Download className="h-4 w-4" /> Export {label}</a>; }
function NavLink({ to, icon, children }: { to: string; icon: React.ReactNode; children: React.ReactNode }) { return <Link to={to} className="flex items-center gap-2 rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">{icon}<span>{children}</span></Link>; }
function Dashboard() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [summary, setSummary] = useState<ResilienceSummary | null>(null);
  useEffect(() => {
    api<{ plans: Plan[] }>('/api/v1/plans').then((d) => setPlans(d.plans)).catch(() => setPlans([]));
    api<{ summary: ResilienceSummary }>('/api/v1/resilience/summary').then((d) => setSummary(d.summary)).catch(() => setSummary(null));
  }, []);
  return <div className="space-y-6"><div><h1 className="text-2xl font-bold">Dashboard</h1><p className="text-sm text-muted-foreground">Disaster recovery posture overview</p></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><KpiCard label="Total DRP" value={`${plans.length}`} hint="Total plans" /><KpiCard label="Approved" value={`${plans.filter((p) => p.status === 'approved').length}`} hint="Ready for incident" /><KpiCard label="Open Risks" value={`${summary?.openRisks ?? 0}`} hint={`${summary?.highRisks ?? 0} high risk`} /><KpiCard label="Planned Drills" value={`${summary?.plannedDrills ?? 0}`} hint={`${summary?.completedDrills ?? 0} completed`} /></div><div className="grid gap-4 lg:grid-cols-3"><KpiCard label="Assets" value={`${summary?.totalAssets ?? 0}`} hint={`${summary?.criticalAssets ?? 0} critical assets`} /><KpiCard label="Priority Recovery" value={`${summary?.priorityRecoveryAssets ?? 0}`} hint="Priority 1-2 assets" /><KpiCard label="Coverage" value={plans.length ? `${Math.round((plans.filter((p) => p.status === 'approved').length / plans.length) * 100)}%` : '0%'} hint="Approved / total DRP" /></div><div className="rounded-lg border border-border bg-card p-6"><h2 className="mb-2 text-lg font-semibold">DR Plan Builder SaaS workspace aktif</h2><p className="text-sm text-muted-foreground">Buat DRP ISO 22301, register asset dependency, risk register, drill schedule, approval, audit, dan export.</p></div></div>;
}
function KpiCard({ label, value, hint }: { label: string; value: string; hint: string }) { return <div className="rounded-lg border border-border bg-card p-4"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{hint}</p></div>; }
function StatusBadge({ status }: { status: string }) { const color = status === 'approved' ? 'bg-green-100 text-green-700' : status === 'in_review' ? 'bg-yellow-100 text-yellow-800' : 'bg-slate-100 text-slate-700'; return <span className={`rounded-full px-2 py-1 text-xs font-medium ${color}`}>{status.replace('_', ' ')}</span>; }
function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) { const { label, ...rest } = props; return <label className="text-sm font-medium">{label}<input {...rest} className="mt-1 w-full rounded-md border px-3 py-2" /></label>; }
function PlaceholderPage({ title, note }: { title: string; note: string }) { return <div className="space-y-4"><h1 className="text-2xl font-bold">{title}</h1><div className="rounded-lg border border-dashed border-border bg-card/50 p-12 text-center"><p className="text-sm text-muted-foreground">{note}</p></div></div>; }
function ErrorBox({ message }: { message: string }) { return <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{message}</div>; }
function Centered({ children }: { children: React.ReactNode }) { return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">{children}</div>; }
function NotFound() { return <div className="space-y-4 text-center"><h1 className="text-4xl font-bold">404</h1><p className="text-muted-foreground">Page not found</p><Link to="/" className="text-primary hover:underline">← Back to Dashboard</Link></div>; }
