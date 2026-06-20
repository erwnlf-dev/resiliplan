import { Routes, Route, Link } from 'react-router-dom';
import { FileText, Server, AlertTriangle, Calendar, Home } from 'lucide-react';

export function App() {
  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <header className="border-b border-border bg-card">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <FileText className="h-4 w-4" />
            </div>
            <span className="font-semibold">ResiliPlan</span>
          </div>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>v0.1.0</span>
          </nav>
        </div>
      </header>

      {/* Sidebar + Main */}
      <div className="container flex gap-6 py-6">
        {/* Sidebar */}
        <aside className="w-56 shrink-0">
          <nav className="space-y-1 text-sm">
            <NavLink to="/" icon={<Home className="h-4 w-4" />}>
              Dashboard
            </NavLink>
            <NavLink to="/plans" icon={<FileText className="h-4 w-4" />}>
              Plans
            </NavLink>
            <NavLink to="/assets" icon={<Server className="h-4 w-4" />}>
              Assets
            </NavLink>
            <NavLink to="/risks" icon={<AlertTriangle className="h-4 w-4" />}>
              Risks
            </NavLink>
            <NavLink to="/drills" icon={<Calendar className="h-4 w-4" />}>
              Drills
            </NavLink>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/plans" element={<PlaceholderPage title="Plans" />} />
            <Route path="/assets" element={<PlaceholderPage title="Assets" />} />
            <Route path="/risks" element={<PlaceholderPage title="Risks" />} />
            <Route path="/drills" element={<PlaceholderPage title="Drills" />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function NavLink({ to, icon, children }: { to: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2 rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {icon}
      <span>{children}</span>
    </Link>
  );
}

function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Disaster recovery posture overview
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total DRP" value="0" hint="Total plans" />
        <KpiCard label="Approved" value="0" hint="Ready for incident" />
        <KpiCard label="In Draft" value="0" hint="Work in progress" />
        <KpiCard label="Coverage" value="0%" hint="Critical services" />
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-2 text-lg font-semibold">Welcome to ResiliPlan 👋</h2>
        <p className="text-sm text-muted-foreground">
          This is the foundation scaffolding. Phase 0b complete. Phase 1 (Core DRP) coming next.
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          <a
            href="https://github.com/datacomm-diangraha/resiliplan"
            target="_blank"
            rel="noreferrer"
            className="text-primary hover:underline"
          >
            View on GitHub →
          </a>
        </p>
      </div>
    </div>
  );
}

function KpiCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{title}</h1>
      <div className="rounded-lg border border-dashed border-border bg-card/50 p-12 text-center">
        <p className="text-sm text-muted-foreground">
          Coming in Phase 1 — Core DRP features
        </p>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="space-y-4 text-center">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-muted-foreground">Page not found</p>
      <Link to="/" className="text-primary hover:underline">
        ← Back to Dashboard
      </Link>
    </div>
  );
}
