# ResiliPlan — UI/UX Design System

> **Design reference** untuk konsistensi visual & interaksi.
> **Inspiration:** Linear, Notion, Vercel, Stripe
> **Last updated:** 2026-06-20
> **Status:** Design tokens + key screens defined. Detailed wireframes per screen di Phase 1.

---

## 1. Design Philosophy

**3 prinsip utama:**

1. **Calm & Professional** — Internal tool, user pakai setiap hari, jangan overwhelming. Subtle hierarchy, generous whitespace.
2. **Information Density** — Show data yang dibutuhkan, hide yang tidak. Progressive disclosure.
3. **Aesthetic + Functional** — Pretty tapi functional, no decoration tanpa purpose.

**Anti-patterns:**
- ❌ Bright neon colors
- ❌ Excessive animations
- ❌ Decorative gradients (subtle only)
- ❌ Stock photos / generic illustrations
- ❌ Modal hell (prefer inline editing)

---

## 2. Design Tokens

### 2.1 Color Palette

**Base (neutral, light mode default):**

| Token | Hex | Usage |
|---|---|---|
| `--background` | `#FFFFFF` | Page background |
| `--foreground` | `#0A0A0A` | Primary text |
| `--muted` | `#F4F4F5` | Subtle backgrounds (cards, hover) |
| `--muted-foreground` | `#71717A` | Secondary text, labels |
| `--border` | `#E4E4E7` | Dividers, input borders |
| `--input` | `#E4E4E7` | Input background |
| `--ring` | `#3B82F6` | Focus ring (blue) |

**Brand (primary blue):**

| Token | Hex | Usage |
|---|---|---|
| `--primary` | `#2563EB` | Primary buttons, links |
| `--primary-foreground` | `#FFFFFF` | Text on primary |
| `--primary-hover` | `#1D4ED8` | Hover state |

**Semantic:**

| Token | Hex | Usage |
|---|---|---|
| `--success` | `#10B981` | Success messages, valid |
| `--success-foreground` | `#FFFFFF` | Text on success |
| `--warning` | `#F59E0B` | Warnings, in-progress |
| `--warning-foreground` | `#FFFFFF` | Text on warning |
| `--destructive` | `#EF4444` | Errors, delete, critical |
| `--destructive-foreground` | `#FFFFFF` | Text on destructive |
| `--info` | `#3B82F6` | Info messages, tips |

**Severity (for DRP tier, risk, audit):**

| Token | Hex | Usage |
|---|---|---|
| `--severity-critical` | `#DC2626` | Tier 1, critical risk |
| `--severity-high` | `#EA580C` | Tier 2, high risk |
| `--severity-medium` | `#CA8A04` | Tier 3, medium risk |
| `--severity-low` | `#16A34A` | Tier 4, low risk |
| `--severity-none` | `#6B7280` | Not classified |

**Dark mode (auto via system preference):**

| Token | Light | Dark |
|---|---|---|
| `--background` | `#FFFFFF` | `#0A0A0A` |
| `--foreground` | `#0A0A0A` | `#FAFAFA` |
| `--muted` | `#F4F4F5` | `#27272A` |
| `--muted-foreground` | `#71717A` | `#A1A1AA` |
| `--border` | `#E4E4E7` | `#27272A` |

### 2.2 Typography

**Font families:**

```css
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
```

**Type scale (Tailwind default):**

| Token | Size | Weight | Line Height | Usage |
|---|---|---|---|---|
| `text-xs` | 12px | 400 | 16px | Helper text, badges |
| `text-sm` | 14px | 400 | 20px | Body small, captions |
| `text-base` | 16px | 400 | 24px | Body default |
| `text-lg` | 18px | 500 | 28px | Subheading |
| `text-xl` | 20px | 600 | 28px | Section heading |
| `text-2xl` | 24px | 700 | 32px | Page heading |
| `text-3xl` | 30px | 700 | 36px | Hero |
| `text-4xl` | 36px | 800 | 40px | Display |

**Font weight:**
- `font-normal` (400) — body
- `font-medium` (500) — emphasis
- `font-semibold` (600) — subheading
- `font-bold` (700) — heading

### 2.3 Spacing

**4px grid (Tailwind default):**

| Token | Size | Usage |
|---|---|---|
| `0` | 0px | Reset |
| `1` | 4px | Tight inline |
| `2` | 8px | Compact spacing |
| `3` | 12px | Default inline |
| `4` | 16px | Default block |
| `6` | 24px | Card padding |
| `8` | 32px | Section spacing |
| `12` | 48px | Large block |
| `16` | 64px | Page section |
| `24` | 96px | Hero spacing |

### 2.4 Border Radius

```css
--radius-sm: 4px;    /* Badges, small elements */
--radius-md: 6px;    /* Buttons, inputs */
--radius-lg: 8px;    /* Cards */
--radius-xl: 12px;   /* Modals, popovers */
--radius-full: 9999px; /* Pills, avatars */
```

### 2.5 Shadows

```css
--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
--shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
```

### 2.6 Animation

```css
--duration-fast: 150ms;    /* Hover, focus */
--duration-base: 250ms;    /* Default */
--duration-slow: 400ms;    /* Page transition */
--ease-out: cubic-bezier(0.16, 1, 0.3, 1);
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
```

**Usage:**
- Hover: 150ms ease-out
- Modal open: 250ms ease-out
- Page transition: 400ms ease-in-out
- **No** decoration animations (rotate, pulse, bounce)

---

## 3. Component Library (shadcn/ui)

**Base:** shadcn/ui (Radix UI primitives) — copy-paste ke `apps/web/src/components/ui/`

### 3.1 Component List

| Component | Variant | Usage |
|---|---|---|
| **Button** | primary, secondary, ghost, destructive, link | All actions |
| **Input** | text, email, password, search, number | Form fields |
| **Textarea** | default, with-counter | Long content (DRP section) |
| **Select** | single, multi, searchable | Dropdowns (tier, status, dll) |
| **Checkbox** | default, indeterminate | Multi-select |
| **RadioGroup** | default | Single choice from few options |
| **Switch** | default, with-label | Toggle settings |
| **Slider** | default, range | RTO/RPO, thresholds |
| **DatePicker** | single, range, with-time | Scheduled dates |
| **Card** | default, interactive, with-header | Content grouping |
| **Dialog** | default, with-footer, large | Modals |
| **Sheet** | side, top, bottom | Slide-in panels |
| **Popover** | default, with-arrow | Tooltips, dropdowns |
| **Tooltip** | default, with-arrow | Hover hints |
| **Toast** | success, error, info, warning | Notifications |
| **Alert** | info, success, warning, error | Inline messages |
| **Badge** | default, secondary, destructive, outline | Tags, status |
| **Avatar** | default, with-fallback | User avatar |
| **Tabs** | default, vertical, with-icons | Section navigation |
| **Accordion** | default, multiple | Collapsible content |
| **Table** | default, sortable, paginated | Data tables |
| **Pagination** | default, with-jump | Long lists |
| **Breadcrumb** | default | Navigation |
| **DropdownMenu** | default, with-icons | Action menus |
| **Command** | default, with-shortcuts | Search + actions (⌘K) |
| **Skeleton** | default, text, card, avatar | Loading states |
| **Progress** | linear, circular | Loading + completion |
| **Separator** | horizontal, vertical | Dividers |

### 3.2 Component Customization

Setiap component di-customize via `tailwind.config.ts`:

```typescript
// apps/web/tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        // ... see design tokens
        severity: {
          critical: 'hsl(var(--severity-critical))',
          high: 'hsl(var(--severity-high))',
          medium: 'hsl(var(--severity-medium))',
          low: 'hsl(var(--severity-low))',
          none: 'hsl(var(--severity-none))',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
```

---

## 4. Layout System

### 4.1 App Shell

```
┌─────────────────────────────────────────────────────────────┐
│  Top Bar (h: 56px)                                          │
│  [Logo] [Global Search ⌘K]      [Notifications] [User Menu] │
├──────────┬──────────────────────────────────────────────────┤
│          │                                                  │
│  Sidebar │  Main Content Area (max-w: 1280px, centered)     │
│  (w: 240)│                                                  │
│          │  ┌─────────────────────────────────────────────┐ │
│  [Nav 1] │  │  Page Header                                │ │
│  [Nav 2] │  │  [Title] [Subtitle] [Actions]              │ │
│  [Nav 3] │  ├─────────────────────────────────────────────┤ │
│  [Nav 4] │  │                                             │ │
│  ...     │  │  Page Content                               │ │
│          │  │                                             │ │
│          │  └─────────────────────────────────────────────┘ │
│          │                                                  │
│  [Footer]│                                                  │
└──────────┴──────────────────────────────────────────────────┘
```

**Top bar:**
- Logo (left)
- Global search (⌘K to open Command palette)
- Notifications bell (with count)
- User avatar dropdown (profile, settings, logout)

**Sidebar:**
- Navigation: Dashboard, Plans, Assets, Risks, Drills, Reports
- Collapsible (icon-only mode on smaller screens)
- Active state: subtle background + left border accent

**Main content:**
- Max width 1280px (centered)
- Page header: title, subtitle, primary action button (right)
- Content: 8px grid spacing

### 4.2 Responsive Breakpoints

```typescript
const breakpoints = {
  sm: '640px',   // Mobile landscape
  md: '768px',   // Tablet
  lg: '1024px',  // Desktop
  xl: '1280px',  // Large desktop
  '2xl': '1536px',
};
```

**Mobile strategy:**
- Sidebar → hamburger menu (drawer)
- Tables → card layout (responsive table)
- Forms → single column
- Editor → full screen (no side panel)

---

## 5. Key Screens (Wireframe Description)

### 5.1 Login Page (`/login`)

```
┌────────────────────────────────────────────────┐
│                                                │
│           ┌──────────────────┐                 │
│           │                  │                 │
│           │   [Logo]         │                 │
│           │                  │                 │
│           │   ResiliPlan     │                 │
│           │   Sign in to your account         │
│           │                  │                 │
│           │   ┌────────────┐ │                 │
│           │   │ Email      │ │                 │
│           │   └────────────┘ │                 │
│           │   ┌────────────┐ │                 │
│           │   │ Password   │ │                 │
│           │   └────────────┘ │                 │
│           │                  │                 │
│           │   [Sign In]      │                 │
│           │                  │                 │
│           │   Forgot password?                  │
│           │                  │                 │
│           └──────────────────┘                 │
│                                                │
└────────────────────────────────────────────────┘
```

**Components:**
- Centered card (max-w 400px)
- Logo + product name
- Email + password input
- Sign In button (primary)
- Forgot password link

---

### 5.2 Dashboard (`/app`)

```
┌────────────────────────────────────────────────────────────┐
│  Dashboard                                    [+ New DRP ▼]│
│  Overview of your disaster recovery posture                │
├────────────────────────────────────────────────────────────┤
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐                   │
│  │  12  │  │   8  │  │   3  │  │  73% │                   │
│  │ Total│  │Apprvd│  │ Draft│  │ Cov  │                   │
│  │ DRP  │  │      │  │      │  │      │                   │
│  └──────┘  └──────┘  └──────┘  └──────┘                   │
│                                                            │
│  ┌─────────────────────┐  ┌─────────────────────┐          │
│  │ DRP by Tier         │  │ Recent Activity     │          │
│  │ (donut chart)       │  │                     │          │
│  │                     │  │ • User A created... │          │
│  │                     │  │ • Plan B approved   │          │
│  │                     │  │ • Drill C scheduled │          │
│  │                     │  │                     │          │
│  └─────────────────────┘  └─────────────────────┘          │
│                                                            │
│  Pending Approvals (3)                                     │
│  ┌────────────────────────────────────────────────┐       │
│  │ Plan X        Reviewer  Due: 2026-06-25  [→]  │       │
│  │ Plan Y        Approver  Due: 2026-06-27  [→]  │       │
│  │ Plan Z        Signer    Due: 2026-06-30  [→]  │       │
│  └────────────────────────────────────────────────┘       │
└────────────────────────────────────────────────────────────┘
```

**Components:**
- 4 KPI cards (total, approved, draft, coverage %)
- 2 charts side-by-side (donut + activity feed)
- Pending approvals table (compact)

---

### 5.3 Plan List (`/app/plans`)

```
┌────────────────────────────────────────────────────────────┐
│  Plans                                       [+ New Plan]  │
│  All disaster recovery plans                                │
│                                                            │
│  [Search...] [Tier ▼] [Status ▼] [Owner ▼] [⋮ Filter]     │
│                                                            │
│  ┌──────┬──────────────────────┬──────┬───────┬──────┐    │
│  │ Tier │ Name                 │ Owner│ Status│ RTO  │    │
│  ├──────┼──────────────────────┼──────┼───────┼──────┤    │
│  │ 🔴T1 │ Core Database        │ John │ Apprv │ 30m  │    │
│  │ 🟠T2 │ API Gateway          │ Jane │ Drft  │ 60m  │    │
│  │ 🟡T3 │ Analytics Dashboard  │ Bob  │ Revw  │ 4h   │    │
│  │ 🟢T4 │ Internal Wiki        │ Mary │ Apprv │ 24h  │    │
│  └──────┴──────────────────────┴──────┴───────┴──────┘    │
│                                                            │
│  Showing 12 of 12 plans        [< 1 >]                      │
└────────────────────────────────────────────────────────────┘
```

**Components:**
- Page header with action button
- Filter bar (search + multi-filter)
- Sortable table with status indicators
- Color-coded tier badges
- Pagination (if > 25 plans)

---

### 5.4 Plan Editor (`/app/plans/:planId/editor`)

```
┌────────────────────────────────────────────────────────────┐
│  ← Back to Plans                          [Save] [Submit] │
│  Core Database DRP                        v2.3 • Approved  │
├──────────┬─────────────────────────────────┬──────────────┤
│          │                                 │              │
│ Metadata │  Section 7: BIA                 │ AI Co-pilot  │
│          │  Business Impact Analysis       │              │
│ Tier: T1 │                                 │ 💡 Generate  │
│ RTO: 30m │  ┌─────────────────────────────┐│ with AI     │
│ RPO: 15m │  │                             ││              │
│ Status:  │  │  [Markdown editor]          ││ Model:       │
│  ✓Apprv  │  │                             ││ GPT-4o ▼    │
│          │  │  - Impact 1h: critical      ││              │
│ Sections │  │  - Impact 4h: critical      ││ [Generate]   │
│          │  │  - Impact 24h: critical     ││              │
│ 1 Exec   │  │  ...                        ││              │
│ 2 Intro  │  │                             ││ History:     │
│ 3 Scope  │  │                             ││ 2 versions   │
│ 4 Assum  │  │                             ││              │
│ 5 Ops    │  └─────────────────────────────┘│              │
│ 6 Sys    │                                 │              │
│ 7 BIA ◄  │  ISO 22301: 8.2, 8.3            │              │
│ 8 Strat  │  NIST 800-34: Section 4         │              │
│ 9 Comm   │                                 │              │
│ 10 Act   │                                 │              │
│ 11 Proc  │                                 │              │
│ 12 Val   │                                 │              │
│ 13 Maint │                                 │              │
│ 14 Appx  │                                 │              │
│          │                                 │              │
│ Comments │                                 │              │
│ (2)      │                                 │              │
└──────────┴─────────────────────────────────┴──────────────┘
```

**3-column layout:**

**Left sidebar (240px):**
- Plan metadata (tier, RTO/RPO, status)
- Section list (14 items, ordered, active highlighted)
- Comments count (badge)

**Center:**
- Section title + order
- Markdown editor (textarea or WYSIWYG)
- ISO 22301 + NIST + BCI compliance badges (visual)

**Right sidebar (320px, collapsible):**
- AI Co-pilot panel
  - Model selector (per user's BYO config)
  - "Generate with AI" button
  - AI history (previous generations)
- Version history (timeline)
- Comments (when selected)

---

### 5.5 AI Configurations (`/app/settings/ai`)

```
┌────────────────────────────────────────────────────────────┐
│  Settings → AI Configurations                [+ Add Config]│
│  Configure your AI provider (BYO API key)                   │
│                                                            │
│  ┌────────────────────────────────────────────────┐       │
│  │ ⭐ OpenAI Personal             [Default]  [⋮] │       │
│  │ Provider: OpenAI                               │       │
│  │ Model: gpt-4o                                  │       │
│  │ Status: ✅ Connected                           │       │
│  │ Last used: 2 hours ago                         │       │
│  │ Token usage (month): 245K / 1M                │       │
│  └────────────────────────────────────────────────┘       │
│                                                            │
│  ┌────────────────────────────────────────────────┐       │
│  │ Anthropic Work                       [⋮]      │       │
│  │ Provider: Anthropic                            │       │
│  │ Model: claude-sonnet-4-5                      │       │
│  │ Status: ✅ Connected                           │       │
│  │ Last used: Yesterday                           │       │
│  └────────────────────────────────────────────────┘       │
│                                                            │
│  ┌────────────────────────────────────────────────┐       │
│  │ Local Ollama (custom)                 [⋮]      │       │
│  │ Provider: openai-compatible                    │       │
│  │ URL: http://localhost:11434/v1                 │       │
│  │ Model: llama-3.1-70b                          │       │
│  │ Status: ⚠️ Connection failed (timeout)        │       │
│  └────────────────────────────────────────────────┘       │
└────────────────────────────────────────────────────────────┘
```

**Add Config Modal:**
- Provider type (radio: OpenAI, Anthropic, OpenAI-compatible, Anthropic-compatible)
- Name (text)
- API Key (password input, show/hide toggle)
- Base URL (optional, placeholder)
- Model (text + dropdown based on provider)
- Test Connection button (verifies before save)
- Save as default toggle

---

### 5.6 Empty States

**No plans yet:**
```
┌─────────────────────────────────────────┐
│                                         │
│         📋 (simple SVG icon)           │
│                                         │
│     No disaster recovery plans yet     │
│                                         │
│     Create your first DRP to get       │
│     started with ISO 22301-aligned     │
│     templates.                          │
│                                         │
│       [+ Create First Plan]             │
│                                         │
└─────────────────────────────────────────┘
```

**No search results:**
```
┌─────────────────────────────────────────┐
│                                         │
│         🔍                              │
│                                         │
│     No plans match your search         │
│                                         │
│     Try adjusting your filters or      │
│     search query.                       │
│                                         │
│       [Clear Filters]                   │
│                                         │
└─────────────────────────────────────────┘
```

---

### 5.7 Loading States

**Skeleton (preferred over spinner):**
- Show structure of content, gray bars
- Used for: plan list, dashboard cards, editor
- Smooth, tidak jarring

**Spinner (only for actions):**
- Button click → inline spinner + "Saving..."
- Page transition → top progress bar (NProgress)
- File upload → progress bar

**Optimistic update:**
- Save action → update UI immediately, rollback on error
- Toast on success/error

---

### 5.8 Error States

**Form error:**
```
┌─────────────────────────┐
│ Email                   │
│ ┌─────────────────────┐ │
│ │ invalid@            │ │ ← red border
│ └─────────────────────┘ │
│ ⚠ Invalid email format  │ ← red text
└─────────────────────────┘
```

**Page error (404 / 500):**
```
┌─────────────────────────────────────────┐
│                                         │
│         404                             │
│         Plan not found                  │
│                                         │
│     The plan you're looking for        │
│     doesn't exist or has been deleted. │
│                                         │
│       [← Back to Plans]                 │
│                                         │
└─────────────────────────────────────────┘
```

**Network error (toast):**
- "❌ Connection lost. Retrying..."
- Auto-retry 3x
- After 3x: "Failed to save. Your changes are kept locally. [Retry]"

---

## 6. Interaction Patterns

### 6.1 Command Palette (⌘K)

**Trigger:** ⌘K (or Ctrl+K) anywhere in app

```
┌─────────────────────────────────────────┐
│ 🔍 Type a command or search...          │
├─────────────────────────────────────────┤
│ NAVIGATION                               │
│  → Dashboard                            │
│  → Plans                                │
│  → Assets                               │
│                                         │
│ ACTIONS                                 │
│  + New Plan                             │
│  + New Asset                            │
│  ↑ Go to Plan (search plans)            │
│                                         │
│ AI                                      │
│  ✨ Generate Section (current plan)     │
│  ⚙️ Configure AI                        │
└─────────────────────────────────────────┘
```

### 6.2 Auto-save

- Trigger: 1s after last keystroke (debounce)
- Visual: "Saved 2 seconds ago" indicator
- Failure: "Failed to save. [Retry]"
- Conflict: warning + show version diff

### 6.3 Confirmation Dialogs

**Destructive actions:**
- Delete plan → "Are you sure? This action cannot be undone. Type the plan name to confirm."
- Remove user → "Are you sure? They'll lose access immediately."
- Revoke API key → "Are you sure? AI features will stop working."

**Non-destructive (use Toast instead):**
- Save (no confirmation)
- Export (no confirmation, just success toast)
- Approve (no confirmation, success toast)

### 6.4 Empty / First-time UX

- First login → onboarding wizard (3 steps):
  1. Welcome + brief intro
  2. Configure AI (optional, can skip)
  3. Create first plan
- Skip always available
- Can replay from Settings → Help

---

## 7. Accessibility (WCAG 2.1 AA)

**Requirements:**

- ✅ **Color contrast** — minimum 4.5:1 for text, 3:1 for UI elements
- ✅ **Keyboard navigation** — all interactive elements accessible via Tab/Shift+Tab
- ✅ **Focus indicators** — visible focus ring (2px solid blue)
- ✅ **Screen reader** — semantic HTML, ARIA labels where needed
- ✅ **Alt text** — all images have descriptive alt
- ✅ **Form labels** — every input has associated label
- ✅ **Error messages** — announced via aria-live="polite"
- ✅ **Skip link** — "Skip to main content" for keyboard users
- ✅ **Heading hierarchy** — proper h1 → h2 → h3 structure

**Testing:**
- axe-core in CI (no critical violations)
- Manual keyboard test before each release
- Screen reader test (NVDA + VoiceOver) quarterly

---

## 8. Performance Budget

**Targets:**

| Metric | Target | Tool |
|---|---|---|
| **LCP (Largest Contentful Paint)** | < 2.5s | Lighthouse |
| **FID (First Input Delay)** | < 100ms | Lighthouse |
| **CLS (Cumulative Layout Shift)** | < 0.1 | Lighthouse |
| **TTI (Time to Interactive)** | < 3.5s | Lighthouse |
| **Bundle size (initial JS)** | < 200KB | rollup-plugin-visualizer |
| **Bundle size (per route)** | < 50KB | Same |

**Optimization strategies:**

- Code splitting (route + heavy component)
- Lazy load images (loading="lazy")
- Preload critical fonts (Inter)
- Tree-shake unused shadcn components
- Compress assets (gzip/brotli)
- Cache static assets (1 year)

---

## 9. Browser Support

**Supported (last 2 versions):**

- ✅ Chrome / Edge (Chromium)
- ✅ Firefox
- ✅ Safari (macOS + iOS)

**Not supported:**

- ❌ IE 11 (EOL)
- ❌ Legacy Edge (non-Chromium)
- ❌ Opera Mini

**Mobile:**

- ✅ iOS Safari 15+
- ✅ Android Chrome (latest)

---

## 10. Iconography

**Library:** Lucide React (consistent with shadcn/ui)

**Usage:**
- Outline style (default)
- 16px (inline), 20px (button), 24px (header)
- Color: inherit from text color
- Stroke: 1.5px (slightly thinner than default for elegance)

**Common icons:**
- `Home` — Dashboard
- `FileText` — Plans
- `Server` — Assets
- `AlertTriangle` — Risks
- `Calendar` — Drills
- `Settings` — Settings
- `User` — User
- `LogOut` — Logout
- `Plus` — Create
- `Search` — Search
- `Sparkles` — AI
- `Download` — Export
- `Check` — Approve
- `X` — Reject
- `Eye` — View
- `Edit` — Edit
- `Trash` — Delete

---

## 11. Brand Identity

**Logo:**
- Wordmark: "ResiliPlan" (Inter, semibold)
- Optional icon: shield/checkmark combo (representing protection + verification)
- Color: primary blue (#2563EB) on light, primary on dark
- Min size: 120px wide

**Tagline:** "From static document to living plan."

**Tone of voice:**
- Professional tapi approachable
- Bahasa Indonesia primary, English untuk jargon/teknis
- No marketing fluff
- Direct, helpful, calm

---

## 12. Implementation Notes

**File structure:**

```
apps/web/src/
├── components/
│   ├── ui/                  # shadcn/ui primitives (button, input, etc)
│   ├── plan/                # Plan-specific components
│   ├── editor/              # Section editor
│   ├── ai/                  # AI co-pilot components
│   └── layout/              # App shell (TopBar, Sidebar, etc)
├── pages/                   # Route components
├── lib/                     # Utilities
├── hooks/                   # Custom React hooks
├── stores/                  # Zustand stores
└── styles/
    └── globals.css          # Tailwind + CSS variables
```

**Tailwind CSS variables** (in `globals.css`):

```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 240 10% 3.9%;
    /* ... all design tokens */
  }

  .dark {
    --background: 240 10% 3.9%;
    --foreground: 0 0% 98%;
    /* ... dark mode overrides */
  }
}
```

---

## 13. Related Documents

- [`docs/architecture.md`](./architecture.md) — Tech stack
- [`PRD.md`](../PRD.md) — Product requirements (Section 9 has design principles)
