import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Bell,
  Calendar,
  CheckCircle2,
  CreditCard,
  FileText,
  Home,
  Lock,
  Mail,
  Server,
  Settings,
  Sparkles,
  Users,
  Zap,
  Search,
  Server as ServerIcon,
  ArrowRight,
} from 'lucide-react';
import { Modal } from './ui';

type CommandItem = {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  group: string;
  to?: string;
  shortcut?: string[];
  action?: () => void;
};

const NAV_ITEMS: { label: string; to: string; icon: React.ReactNode; group: string }[] = [
  { label: 'Dashboard', to: '/', icon: <Home className="h-4 w-4" />, group: 'Navigate' },
  { label: 'DR Plans', to: '/plans', icon: <FileText className="h-4 w-4" />, group: 'Navigate' },
  { label: 'BIA', to: '/bia', icon: <CheckCircle2 className="h-4 w-4" />, group: 'Navigate' },
  { label: 'Assets', to: '/assets', icon: <Server className="h-4 w-4" />, group: 'Navigate' },
  { label: 'Risks', to: '/risks', icon: <AlertTriangle className="h-4 w-4" />, group: 'Navigate' },
  { label: 'Drills', to: '/drills', icon: <Calendar className="h-4 w-4" />, group: 'Navigate' },
  { label: 'Users', to: '/users', icon: <Users className="h-4 w-4" />, group: 'Navigate' },
  { label: 'Notifications', to: '/notifications', icon: <Bell className="h-4 w-4" />, group: 'Navigate' },
  { label: 'Monitoring', to: '/monitoring', icon: <Activity className="h-4 w-4" />, group: 'Navigate' },
  { label: 'Billing', to: '/billing', icon: <CreditCard className="h-4 w-4" />, group: 'Navigate' },
  { label: 'Email Outbox', to: '/email-outbox', icon: <Mail className="h-4 w-4" />, group: 'Navigate' },
  { label: 'Audit Trail', to: '/audit-trail', icon: <FileText className="h-4 w-4" />, group: 'Navigate' },
  { label: 'Backups', to: '/backups', icon: <ServerIcon className="h-4 w-4" />, group: 'Navigate' },
  { label: 'Readiness', to: '/readiness', icon: <CheckCircle2 className="h-4 w-4" />, group: 'Navigate' },
  { label: 'AI Providers', to: '/ai-providers', icon: <Sparkles className="h-4 w-4" />, group: 'Navigate' },
  { label: 'Settings', to: '/settings', icon: <Settings className="h-4 w-4" />, group: 'Navigate' },
  { label: 'Security', to: '/security', icon: <Lock className="h-4 w-4" />, group: 'Navigate' },
];

const QUICK_ACTIONS: CommandItem[] = [
  { id: 'new-plan', label: 'Create new DR plan', description: 'Start from ISO 22301 template', icon: <FileText className="h-4 w-4" />, group: 'Quick actions', to: '/plans' },
  { id: 'new-bia', label: 'Add BIA entry', description: 'Document business process impact', icon: <CheckCircle2 className="h-4 w-4" />, group: 'Quick actions', to: '/bia' },
  { id: 'new-asset', label: 'Register asset', description: 'Add service dependency', icon: <Server className="h-4 w-4" />, group: 'Quick actions', to: '/assets' },
  { id: 'new-risk', label: 'Add risk', description: 'Log probability × impact risk', icon: <AlertTriangle className="h-4 w-4" />, group: 'Quick actions', to: '/risks' },
  { id: 'ai-suggest', label: 'AI suggest section', description: 'Open plan editor with AI co-pilot', icon: <Sparkles className="h-4 w-4" />, group: 'Quick actions', to: '/plans' },
  { id: 'theme-toggle', label: 'Toggle dark / light theme', description: 'Switch appearance', icon: <Zap className="h-4 w-4" />, group: 'Quick actions' },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Build the master list
  const items = useMemo<CommandItem[]>(() => {
    const nav = NAV_ITEMS.map((n) => ({ ...n, id: `nav-${n.to}` })) as CommandItem[];
    return [...QUICK_ACTIONS, ...nav];
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(
      (i) => i.label.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q) || i.group.toLowerCase().includes(q)
    );
  }, [items, query]);

  // Group by group preserving order
  const grouped = useMemo(() => {
    const groups: { name: string; items: CommandItem[] }[] = [];
    for (const item of filtered) {
      const g = groups.find((x) => x.name === item.group);
      if (g) g.items.push(item);
      else groups.push({ name: item.group, items: [item] });
    }
    return groups;
  }, [filtered]);

  // ⌘K / Ctrl+K to open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setHighlight(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // Keep highlight valid
  useEffect(() => {
    if (highlight >= filtered.length) setHighlight(0);
  }, [filtered, highlight]);

  const run = (item: CommandItem) => {
    if (item.id === 'theme-toggle') {
      const root = document.documentElement;
      root.classList.toggle('dark');
      try { localStorage.setItem('resiliplan-theme', root.classList.contains('dark') ? 'dark' : 'light'); } catch {}
    } else if (item.to) {
      navigate(item.to);
    } else if (item.action) {
      item.action();
    }
    setOpen(false);
  };

  const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(filtered.length - 1, h + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[highlight]) run(filtered[highlight]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  };

  let runningIndex = -1;
  return (
    <Modal open={open} onClose={() => setOpen(false)} size="lg" title={null}>
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setHighlight(0); }}
            onKeyDown={onInputKey}
            placeholder="Type a command, search a page, or jump to action..."
            className="w-full rounded-lg border-0 bg-transparent px-9 py-2.5 text-sm font-medium focus:outline-none focus:ring-0"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">ESC</kbd>
        </div>
        <div className="divider" />
        <div className="max-h-[60vh] overflow-y-auto">
          {grouped.length === 0 ? (
            <div className="px-2 py-8 text-center text-sm text-muted-foreground">No results for "{query}"</div>
          ) : (
            <div className="space-y-3">
              {grouped.map((g) => (
                <div key={g.name}>
                  <p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{g.name}</p>
                  <ul className="mt-1 space-y-0.5">
                    {g.items.map((item) => {
                      runningIndex++;
                      const idx = runningIndex;
                      const active = idx === highlight;
                      return (
                        <li key={item.id}>
                          <button
                            onMouseEnter={() => setHighlight(idx)}
                            onClick={() => run(item)}
                            className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors ${
                              active ? 'bg-primary/10 text-foreground' : 'text-foreground/80'
                            }`}
                          >
                            <span className={`flex h-7 w-7 items-center justify-center rounded-md ${active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                              {item.icon}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium">{item.label}</div>
                              {item.description && <div className="truncate text-xs text-muted-foreground">{item.description}</div>}
                            </div>
                            {active && <ArrowRight className="h-4 w-4 text-primary" />}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-border pt-2 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><kbd className="rounded border bg-muted px-1 py-0.5">↑↓</kbd> navigate</span>
            <span className="flex items-center gap-1"><kbd className="rounded border bg-muted px-1 py-0.5">↵</kbd> select</span>
            <span className="flex items-center gap-1"><kbd className="rounded border bg-muted px-1 py-0.5">esc</kbd> close</span>
          </div>
          <span>{filtered.length} result{filtered.length === 1 ? '' : 's'}</span>
        </div>
      </div>
    </Modal>
  );
}

export function CommandTrigger({ onClick }: { onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="hidden items-center gap-2 rounded-lg border bg-muted/40 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:inline-flex"
      title="Search or jump to anything (⌘K)"
    >
      <Search className="h-3.5 w-3.5" />
      <span>Search…</span>
      <kbd className="ml-2 rounded border bg-background px-1.5 py-0.5 text-[10px] font-semibold">⌘K</kbd>
    </button>
  );
}
