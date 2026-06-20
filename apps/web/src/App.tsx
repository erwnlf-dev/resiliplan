import { useEffect, useMemo, useState } from 'react';
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, Calendar, CheckCircle2, Download, FileText, Home, Lock, LogOut, Save, Send, Server, Sparkles } from 'lucide-react';

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

const API = import.meta.env.VITE_API_URL ?? `${window.location.protocol}//${window.location.hostname}:3001`;

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
  if (!user) return <LoginPage onLogin={setUser} />;

  return <Shell user={user} onUserUpdate={setUser} onLogout={() => setUser(null)} />;
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
  const [commentBody, setCommentBody] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState('');
  async function load() {
    if (!id) return;
    try {
      const loaded = await api<Plan>(`/api/v1/plans/${id}`);
      const commentData = await api<{ comments: PlanComment[] }>(`/api/v1/plans/${id}/comments`);
      setPlan(loaded); setComments(commentData.comments); setSelected(loaded.sections?.[0]?.sectionKey ?? 'context'); setDraft(loaded.sections?.[0]?.contentMarkdown ?? '');
    }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to load plan'); }
  }
  useEffect(() => { void load(); }, [id]);

  const section = plan?.sections?.find((s) => s.sectionKey === selected);
  useEffect(() => { setDraft(section?.contentMarkdown ?? ''); }, [section?.id]);

  async function saveSection() {
    if (!id || !section) return;
    const updated = await api<Section>(`/api/v1/plans/${id}/sections/${section.sectionKey}`, { method: 'PATCH', body: JSON.stringify({ contentMarkdown: draft }) });
    setPlan((p) => p ? { ...p, sections: p.sections?.map((s) => s.id === updated.id ? updated : s) } : p); setMessage('Section saved.');
  }
  async function submitReview() { if (!id) return; setPlan(await api<Plan>(`/api/v1/plans/${id}/submit`, { method: 'POST' })); setMessage('Submitted for approval.'); }
  async function approve() { if (!id) return; const signatureText = prompt('Approval signature text'); if (!signatureText) return; setPlan(await api<Plan>(`/api/v1/plans/${id}/approve`, { method: 'POST', body: JSON.stringify({ signatureText }) })); setMessage('Approved and signed.'); }
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
    setDraft(aiSuggestion);
    setMessage('AI suggestion applied to draft. Click Save to persist.');
  }

  if (error) return <ErrorBox message={error} />;
  if (!plan) return <Centered>Loading plan...</Centered>;
  const currentComments = comments.filter((comment) => comment.sectionKey === selected);

  return <div className="space-y-4"><div className="flex items-start justify-between"><div><Link to="/plans" className="text-sm text-primary hover:underline">← Back to plans</Link><h1 className="mt-1 text-2xl font-bold">{plan.title}</h1><p className="text-sm text-muted-foreground">{plan.serviceName} · version {plan.version} · RTO {plan.rtoMinutes}m · RPO {plan.rpoMinutes}m</p></div><div className="flex items-center gap-2"><StatusBadge status={plan.status} /><button onClick={submitReview} className="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm"><Send className="h-4 w-4" /> Submit</button><button onClick={approve} className="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-2 text-sm text-white"><CheckCircle2 className="h-4 w-4" /> Approve</button></div></div>
    {message && <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">{message}</div>}
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]"><aside className="rounded-lg border bg-card p-3"><div className="mb-2 text-sm font-medium">14 ISO 22301 Sections</div><div className="space-y-1">{plan.sections?.map((s) => <button key={s.id} onClick={() => setSelected(s.sectionKey)} className={`w-full rounded-md px-3 py-2 text-left text-sm ${s.sectionKey === selected ? 'bg-primary text-white' : 'hover:bg-muted'}`}><div className="font-medium">{s.order}. {s.title.replace(/^\d+\. /, '')}</div><div className="text-xs opacity-75">{s.isoClause}</div></button>)}</div></aside>
      <section className="rounded-lg border bg-card"><div className="flex items-center justify-between border-b p-4"><div><h2 className="font-semibold">{section?.title}</h2><p className="text-xs text-muted-foreground">Compliance badge: {section?.isoClause}</p></div><div className="flex gap-2"><button onClick={suggestWithAI} disabled={aiLoading} className="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm disabled:opacity-50"><Sparkles className="h-4 w-4" /> {aiLoading ? 'AI drafting...' : 'AI Suggest'}</button><button onClick={saveSection} className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm text-white"><Save className="h-4 w-4" /> Save</button></div></div><textarea value={draft} onChange={(e) => setDraft(e.target.value)} className="h-[520px] w-full resize-none p-4 font-mono text-sm outline-none" /></section></div>
    {aiSuggestion && <section className="rounded-lg border border-blue-200 bg-blue-50 p-4"><div className="flex items-center justify-between"><div><h2 className="font-semibold text-blue-900">AI suggestion</h2><p className="text-xs text-blue-700">Review before applying. AI output is draft-only until saved.</p></div><button onClick={applyAISuggestion} className="rounded-md bg-blue-700 px-3 py-2 text-sm text-white">Apply to draft</button></div><pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-white p-3 text-sm text-slate-800">{aiSuggestion}</pre></section>}
    <section className="rounded-lg border bg-card p-4"><div className="flex items-center justify-between"><div><h2 className="font-semibold">Section comments</h2><p className="text-xs text-muted-foreground">Use @email format to mention a reviewer. Replies stay linked to the parent comment.</p></div><StatusBadge status={`${currentComments.filter((comment) => comment.status === 'open').length} open`} /></div>{replyTo && <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 p-2 text-xs text-blue-700">Replying to comment {replyTo.slice(0, 8)}… <button onClick={() => setReplyTo(null)} className="ml-2 underline">cancel</button></div>}<div className="mt-3 flex gap-2"><input value={commentBody} onChange={(e) => setCommentBody(e.target.value)} placeholder="Add review note, reply, or @reviewer@datacomm.co.id" className="flex-1 rounded-md border px-3 py-2 text-sm" /><button onClick={addComment} className="rounded-md bg-primary px-3 py-2 text-sm text-white">{replyTo ? 'Add reply' : 'Add comment'}</button></div><div className="mt-4 space-y-2">{currentComments.length === 0 ? <p className="text-sm text-muted-foreground">No comments for this section.</p> : currentComments.map((comment) => <div key={comment.id} className={`rounded-md border p-3 text-sm ${comment.parentCommentId ? 'ml-6 bg-muted/30' : ''}`}><div className="flex items-center justify-between gap-3"><div><p>{comment.body}</p>{comment.parentCommentId && <p className="mt-1 text-xs text-muted-foreground">Reply to {comment.parentCommentId.slice(0, 8)}…</p>}{comment.mentionedEmails && comment.mentionedEmails.length > 0 && <p className="mt-1 text-xs text-blue-700">Mentions: {comment.mentionedEmails.join(', ')}</p>}</div><StatusBadge status={comment.status} /></div><div className="mt-2 flex gap-3">{comment.status === 'open' && <button onClick={() => resolveComment(comment.id)} className="text-xs text-primary hover:underline">Mark resolved</button>}<button onClick={() => setReplyTo(comment.id)} className="text-xs text-primary hover:underline">Reply</button></div></div>)}</div></section>
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
  return <RegisterPage title="Assets" subtitle="Service dependency and recovery-priority register." error={error}><form onSubmit={submit} className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-3"><Input name="serviceName" label="Service" required /><Input name="assetName" label="Asset name" required /><Input name="assetType" label="Asset type" placeholder="database / vm / network" required /><Input name="owner" label="Owner" required /><Input name="recoveryPriority" label="Recovery priority" type="number" min="1" max="5" defaultValue="3" required /><label className="text-sm font-medium">Criticality<select name="criticality" defaultValue="high" className="mt-1 w-full rounded-md border px-3 py-2"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label><Input name="dependencies" label="Dependencies" placeholder="comma separated" /><label className="text-sm font-medium md:col-span-2">Notes<textarea name="notes" className="mt-1 h-20 w-full rounded-md border px-3 py-2" /></label><div className="md:col-span-3"><button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white">Add asset</button></div></form><SimpleTable headers={['Service','Asset','Type','Owner','Priority','Criticality']} rows={assets.map((asset) => [asset.serviceName, asset.assetName, asset.assetType, asset.owner, String(asset.recoveryPriority), asset.criticality])} empty="No assets registered." /></RegisterPage>;
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
  return <RegisterPage title="Risks" subtitle="Probability × impact risk register tied to DR readiness." error={error}><form onSubmit={submit} className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-3"><Input name="serviceName" label="Service" required /><Input name="riskTitle" label="Risk title" required /><Input name="category" label="Category" required /><Input name="probability" label="Probability 1-5" type="number" min="1" max="5" defaultValue="3" required /><Input name="impact" label="Impact 1-5" type="number" min="1" max="5" defaultValue="4" required /><Input name="owner" label="Owner" /><label className="text-sm font-medium md:col-span-3">Mitigation<textarea name="mitigation" className="mt-1 h-20 w-full rounded-md border px-3 py-2" /></label><div className="md:col-span-3"><button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white">Add risk</button></div></form><SimpleTable headers={['Service','Risk','Category','Score','Owner','Status']} rows={risks.map((risk) => [risk.serviceName, risk.riskTitle, risk.category, String(risk.riskScore), risk.owner || '-', risk.status])} empty="No risks registered." /></RegisterPage>;
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
  return <RegisterPage title="Drills" subtitle="Recovery exercise calendar and result tracking." error={error}><form onSubmit={submit} className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-2"><Input name="serviceName" label="Service" required /><Input name="drillTitle" label="Drill title" required /><Input name="scheduledAt" label="Schedule" type="datetime-local" required /><Input name="owner" label="Owner" required /><label className="text-sm font-medium md:col-span-2">Scope<textarea name="scope" className="mt-1 h-20 w-full rounded-md border px-3 py-2" required /></label><div className="md:col-span-2"><button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white">Schedule drill</button></div></form><SimpleTable headers={['Service','Drill','Schedule','Owner','Status']} rows={drills.map((drill) => [drill.serviceName, drill.drillTitle, new Date(drill.scheduledAt).toLocaleString(), drill.owner, drill.status])} empty="No drills scheduled." /></RegisterPage>;
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
