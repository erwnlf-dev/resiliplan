/**
 * UI component library — primitives used across ResiliPlan.
 * All components are unstyled at the base level; they rely on Tailwind utilities
 * and the design tokens in src/styles/globals.css.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronRight,
  FileX,
  Info,
  Search,
  Sparkles,
  TriangleAlert,
  X,
} from 'lucide-react';

// ============================================================
// Toast
// ============================================================

type ToastVariant = 'success' | 'error' | 'warning' | 'info';
type ToastItem = {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  duration: number;
  action?: { label: string; onClick: () => void };
};

type ToastContextValue = {
  push: (t: Omit<ToastItem, 'id' | 'duration'> & { duration?: number }) => string;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_STYLE: Record<ToastVariant, { bar: string; ring: string; icon: ReactNode; iconColor: string }> = {
  success: {
    bar: 'bg-emerald-500',
    ring: 'ring-emerald-500/30',
    icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
    iconColor: 'text-emerald-500',
  },
  error: {
    bar: 'bg-destructive',
    ring: 'ring-destructive/30',
    icon: <TriangleAlert className="h-5 w-5 text-destructive" />,
    iconColor: 'text-destructive',
  },
  warning: {
    bar: 'bg-amber-500',
    ring: 'ring-amber-500/30',
    icon: <AlertTriangle className="h-5 w-5 text-amber-500" />,
    iconColor: 'text-amber-500',
  },
  info: {
    bar: 'bg-primary',
    ring: 'ring-primary/30',
    icon: <Info className="h-5 w-5 text-primary" />,
    iconColor: 'text-primary',
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((curr) => curr.filter((i) => i.id !== id));
  }, []);

  const push = useCallback<ToastContextValue['push']>((t) => {
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setItems((curr) => [...curr, { id, duration: 4500, ...t }]);
    return id;
  }, []);

  const ctx = useMemo(() => ({ push, dismiss }), [push, dismiss]);

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <div className="pointer-events-none fixed top-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2">
        {items.map((t) => (
          <ToastCard key={t.id} item={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const style = VARIANT_STYLE[item.variant];
  const [paused, setPaused] = useState(false);
  const startedAt = useRef(Date.now());
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => {
      const elapsed = Date.now() - startedAt.current;
      const remaining = Math.max(0, 100 - (elapsed / item.duration) * 100);
      setProgress(remaining);
      if (remaining <= 0) {
        window.clearInterval(id);
        onDismiss();
      }
    }, 50);
    return () => window.clearInterval(id);
  }, [item.duration, onDismiss, paused]);

  return (
    <div
      role="status"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => { setPaused(false); startedAt.current = Date.now() - (100 - progress) * item.duration / 100; }}
      className={`pointer-events-auto surface surface-lift overflow-hidden p-0 ring-1 ${style.ring} anim-fade-up`}
    >
      <div className="flex items-start gap-3 p-3.5">
        <div className="mt-0.5 shrink-0">{style.icon}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-5">{item.title}</p>
          {item.description && <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>}
          {item.action && (
            <button
              onClick={() => { item.action?.onClick(); onDismiss(); }}
              className="mt-1.5 text-xs font-semibold text-primary hover:underline"
            >
              {item.action.label}
            </button>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="shrink-0 rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="h-0.5 w-full bg-muted">
        <div className={`h-full ${style.bar} transition-[width] duration-100 ease-linear`} style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return {
    success: (title: string, opts?: { description?: string; action?: ToastItem['action'] }) =>
      ctx.push({ title, variant: 'success', ...opts }),
    error: (title: string, opts?: { description?: string; action?: ToastItem['action'] }) =>
      ctx.push({ title, variant: 'error', duration: 7000, ...opts }),
    warning: (title: string, opts?: { description?: string; action?: ToastItem['action'] }) =>
      ctx.push({ title, variant: 'warning', duration: 6000, ...opts }),
    info: (title: string, opts?: { description?: string; action?: ToastItem['action'] }) =>
      ctx.push({ title, variant: 'info', ...opts }),
  };
}

// ============================================================
// Skeleton
// ============================================================

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`anim-shimmer rounded-md bg-muted/60 ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="surface p-5">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-4 h-8 w-32" />
      <Skeleton className="mt-3 h-3 w-40" />
    </div>
  );
}

export function SkeletonList({ rows = 4, className = '' }: { rows?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="surface surface-lift flex items-center gap-3 p-4">
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}
// ============================================================
// Empty state
// ============================================================

export function EmptyState({
  icon,
  title,
  description,
  action,
  variant = 'default',
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  variant?: 'default' | 'gradient';
}) {
  return (
    <div className="surface relative overflow-hidden p-10 text-center">
      {variant === 'gradient' && (
        <>
          <div className="pointer-events-none absolute -top-12 left-1/2 h-32 w-32 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-12 left-1/2 h-32 w-32 -translate-x-1/2 rounded-full bg-accent/20 blur-3xl" />
        </>
      )}
      <div className="relative">
        {icon ?? <FileX className="mx-auto h-12 w-12 text-muted-foreground/40" />}
        <h3 className="mt-4 text-base font-semibold">{title}</h3>
        {description && <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>}
        {action && <div className="mt-5">{action}</div>}
      </div>
    </div>
  );
}

// ============================================================
// Button
// ============================================================

type ButtonVariant = 'primary' | 'ghost' | 'outline' | 'destructive' | 'secondary';
type ButtonSize = 'sm' | 'md' | 'lg';

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-br from-primary to-[hsl(280,80%,60%)] text-primary-foreground shadow-[0_6px_16px_-6px_hsl(243,90%,60%,0.55)] hover:shadow-[0_10px_28px_-8px_hsl(243,90%,60%,0.7)] hover:-translate-y-0.5',
  ghost: 'text-foreground/80 hover:bg-muted hover:text-foreground',
  outline: 'border bg-background/60 hover:bg-muted',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  secondary: 'border bg-muted hover:bg-muted/70',
};

const BUTTON_SIZE: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-9 px-4 text-sm',
  lg: 'h-11 px-6 text-base',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  leftIcon,
  rightIcon,
  className = '',
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON_VARIANT[variant]} ${BUTTON_SIZE[size]} ${className}`}
    >
      {loading ? <span className="anim-pulse-soft">...</span> : leftIcon}
      <span>{children}</span>
      {rightIcon}
    </button>
  );
}

// ============================================================
// Tabs
// ============================================================

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

export function Tabs({
  items,
  value,
  onChange,
  className = '',
}: {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={`inline-flex items-center gap-1 rounded-xl border bg-card/60 p-1 backdrop-blur-sm ${className}`}>
      {items.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`relative inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all duration-200 ${
              active
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>{t.label}</span>
            {typeof t.count === 'number' && (
              <span className={`rounded-full px-1.5 text-xs font-semibold ${active ? 'bg-primary-foreground/20' : 'bg-muted'}`}>
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================
// Modal
// ============================================================

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title?: string | null;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const widthClass = size === 'sm' ? 'max-w-sm' : size === 'lg' ? 'max-w-2xl' : 'max-w-md';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 anim-fade-in">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-md" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative w-full ${widthClass} surface-glow p-6 anim-fade-up`}
      >
        {(title || description) && (
          <div className="mb-4">
            {title && <h2 className="text-lg font-bold tracking-tight">{title}</h2>}
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          </div>
        )}
        <div>{children}</div>
        {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

// ============================================================
// Breadcrumb
// ============================================================

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

export function Breadcrumb({ items, className = '' }: { items: BreadcrumbItem[]; className?: string }) {
  return (
    <nav className={`flex items-center gap-1.5 text-sm ${className}`} aria-label="Breadcrumb">
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5">
            {item.to && !last ? (
              <a href={item.to} className="text-muted-foreground transition-colors hover:text-foreground">{item.label}</a>
            ) : (
              <span className={last ? 'font-medium text-foreground' : 'text-muted-foreground'}>{item.label}</span>
            )}
            {!last && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />}
          </span>
        );
      })}
    </nav>
  );
}

// ============================================================
// Avatar
// ============================================================

function hashCode(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i) | 0;
  return Math.abs(h);
}

const AVATAR_GRADIENTS = [
  'from-primary to-accent',
  'from-cyan-500 to-blue-500',
  'from-violet-500 to-fuchsia-500',
  'from-amber-500 to-rose-500',
  'from-emerald-500 to-teal-500',
  'from-pink-500 to-purple-500',
];

export function Avatar({
  name,
  size = 'md',
  status,
  ring = false,
}: {
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  status?: 'online' | 'offline' | 'busy' | 'away';
  ring?: boolean;
}) {
  const initials = name.split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';
  const gradient = AVATAR_GRADIENTS[hashCode(name) % AVATAR_GRADIENTS.length];
  const sizeClass = { sm: 'h-7 w-7 text-xs', md: 'h-9 w-9 text-sm', lg: 'h-12 w-12 text-base', xl: 'h-16 w-16 text-xl' }[size];
  const dotSize = { sm: 'h-2 w-2', md: 'h-2.5 w-2.5', lg: 'h-3 w-3', xl: 'h-3.5 w-3.5' }[size];
  const dotColor =
    status === 'online' ? 'bg-emerald-500' :
    status === 'busy' ? 'bg-destructive' :
    status === 'away' ? 'bg-amber-500' :
    status === 'offline' ? 'bg-muted-foreground' : '';

  return (
    <div className={`relative inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradient} font-bold text-white shadow-soft ${sizeClass} ${ring ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}`}>
      {initials}
      {status && (
        <span className={`absolute bottom-0 right-0 rounded-full border-2 border-background ${dotSize} ${dotColor} ${status === 'online' ? 'anim-pulse-soft' : ''}`} />
      )}
    </div>
  );
}

// ============================================================
// Sparkline
// ============================================================

export function Sparkline({
  data,
  width = 96,
  height = 28,
  trend = 'auto',
  className = '',
}: {
  data: number[];
  width?: number;
  height?: number;
  trend?: 'auto' | 'up' | 'down' | 'flat';
  className?: string;
}) {
  if (data.length < 2) {
    return <div className={`text-xs text-muted-foreground ${className}`}>—</div>;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * (height - 2) - 1;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const polyline = points.join(' ');
  const areaPath = `M0,${height} L${polyline} L${width},${height} Z`;
  const actualTrend = trend === 'auto' ? (data[data.length - 1] > data[0] ? 'up' : data[data.length - 1] < data[0] ? 'down' : 'flat') : trend;
  const stroke = actualTrend === 'up' ? 'hsl(142 71% 45%)' : actualTrend === 'down' ? 'hsl(0 72% 51%)' : 'hsl(243 75% 59%)';
  const gradId = `spark-grad-${Math.random().toString(36).slice(2, 7)}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <polyline points={polyline} fill="none" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ============================================================
// StatusBadge
// ============================================================

const STATUS_VARIANT: Record<string, { bg: string; text: string; dot?: boolean; pulse?: boolean }> = {
  approved: { bg: 'bg-emerald-500/15 border-emerald-500/30', text: 'text-emerald-600 dark:text-emerald-400', dot: true },
  in_review: { bg: 'bg-amber-500/15 border-amber-500/30', text: 'text-amber-600 dark:text-amber-400', dot: true },
  draft: { bg: 'bg-slate-500/15 border-slate-500/30', text: 'text-slate-600 dark:text-slate-400', dot: true },
  retired: { bg: 'bg-muted border-border', text: 'text-muted-foreground', dot: true },
  live: { bg: 'bg-emerald-500/15 border-emerald-500/30', text: 'text-emerald-600 dark:text-emerald-400', dot: true, pulse: true },
  queued: { bg: 'bg-amber-500/15 border-amber-500/30', text: 'text-amber-600 dark:text-amber-400', dot: true },
  sent: { bg: 'bg-emerald-500/15 border-emerald-500/30', text: 'text-emerald-600 dark:text-emerald-400', dot: true },
  failed: { bg: 'bg-destructive/15 border-destructive/30', text: 'text-destructive', dot: true },
  cancelled: { bg: 'bg-muted border-border', text: 'text-muted-foreground', dot: true },
  completed: { bg: 'bg-emerald-500/15 border-emerald-500/30', text: 'text-emerald-600 dark:text-emerald-400', dot: true },
  open: { bg: 'bg-amber-500/15 border-amber-500/30', text: 'text-amber-600 dark:text-amber-400', dot: true },
  resolved: { bg: 'bg-emerald-500/15 border-emerald-500/30', text: 'text-emerald-600 dark:text-emerald-400', dot: true },
};

export function StatusBadge({ status, label, className = '' }: { status: string; label?: string; className?: string }) {
  const v = STATUS_VARIANT[status] ?? { bg: 'bg-muted border-border', text: 'text-muted-foreground', dot: true };
  const display = label ?? status.replace(/_/g, ' ');
  return (
    <span className={`badge ${v.bg} ${v.text} ${className}`}>
      {v.dot && <span className={`h-1.5 w-1.5 rounded-full bg-current ${v.pulse ? 'anim-pulse-soft' : ''}`} />}
      <span className="capitalize">{display}</span>
    </span>
  );
}

// ============================================================
// PageHeader
// ============================================================

export function PageHeader({
  eyebrow,
  title,
  description,
  breadcrumbs,
  actions,
  children,
}: {
  eyebrow?: ReactNode;
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="space-y-4 anim-fade-up">
      {breadcrumbs && <Breadcrumb items={breadcrumbs} />}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {eyebrow && <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-primary">{eyebrow}</div>}
          <h1 className="display">{title}</h1>
          {description && <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

// ============================================================
// ActivityTimeline
// ============================================================

export interface TimelineEvent {
  id: string;
  actor: { name: string; email?: string };
  action: string;
  entity: string;
  summary: string;
  at: string; // ISO
  meta?: Record<string, unknown>;
}

const ACTION_COLOR: Record<string, string> = {
  created: 'bg-primary',
  updated: 'bg-amber-500',
  approved: 'bg-emerald-500',
  deleted: 'bg-destructive',
  login: 'bg-cyan-500',
  logout: 'bg-muted-foreground',
  export: 'bg-violet-500',
  attach: 'bg-amber-500',
  default: 'bg-primary',
};

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function ActivityTimeline({ events, empty = 'No activity yet.' }: { events: TimelineEvent[]; empty?: string }) {
  if (events.length === 0) {
    return <EmptyState title={empty} icon={<Sparkles className="mx-auto h-10 w-10 text-muted-foreground/40" />} />;
  }
  return (
    <ol className="relative space-y-4 pl-6">
      <span className="absolute bottom-2 left-2 top-2 w-px bg-border" aria-hidden />
      {events.map((e) => {
        const dot = ACTION_COLOR[e.action] ?? ACTION_COLOR.default;
        return (
          <li key={e.id} className="relative anim-fade-up">
            <span className={`absolute -left-[18px] top-2.5 h-2.5 w-2.5 rounded-full ${dot} ring-4 ring-background`} aria-hidden />
            <div className="surface surface-lift p-3.5">
              <div className="flex items-start gap-3">
                <Avatar name={e.actor.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-sm font-semibold">{e.actor.name}</span>
                    <span className="text-xs text-muted-foreground">{e.action}</span>
                    <span className="text-xs font-medium text-foreground/80">{e.entity}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{relativeTime(e.at)}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-foreground/80">{e.summary}</p>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ============================================================
// Simple SVG Charts
// ============================================================

export function DonutChart({
  data,
  size = 140,
  thickness = 18,
  centerLabel,
  centerValue,
}: {
  data: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const radius = (size - thickness) / 2;
  const circ = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(var(--border))" strokeWidth={thickness} />
        {data.map((d, i) => {
          const len = (d.value / total) * circ;
          const segment = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={d.color}
              strokeWidth={thickness}
              strokeDasharray={`${len} ${circ - len}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            />
          );
          offset += len;
          return segment;
        })}
      </svg>
      {(centerLabel || centerValue) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {centerValue && <span className="text-2xl font-bold tracking-tight">{centerValue}</span>}
          {centerLabel && <span className="text-xs text-muted-foreground">{centerLabel}</span>}
        </div>
      )}
    </div>
  );
}

export function BarChartMini({
  data,
  height = 80,
  className = '',
}: {
  data: { label: string; value: number; color?: string }[];
  height?: number;
  className?: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className={`flex items-end gap-1.5 ${className}`} style={{ height }}>
      {data.map((d, i) => {
        const h = (d.value / max) * 100;
        return (
          <div key={i} className="group flex flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-t-md bg-gradient-to-t from-primary/40 to-primary transition-all duration-300 group-hover:from-primary/60 group-hover:to-primary"
              style={{ height: `${h}%` }}
              title={`${d.label}: ${d.value}`}
            />
            <span className="text-[10px] text-muted-foreground">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// Search input (shared primitive)
// ============================================================

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input pl-9"
      />
    </div>
  );
}

export { Check, Sparkles, X };
