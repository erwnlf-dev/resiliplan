/**
 * MarkdownEditor — textarea + formatting toolbar + optional preview + completion tracking.
 * Supports auto-save via debounced onSave callback.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bold,
  Code as CodeIcon,
  Eye,
  EyeOff,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Save,
  Sparkles,
  Table,
  Wand2,
  X,
} from 'lucide-react';

export interface SnippetItem {
  id: string;
  label: string;
  description: string;
  category: string;
  content: string;
}

export type ToolAction =
  | 'bold'
  | 'italic'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'ul'
  | 'ol'
  | 'quote'
  | 'code'
  | 'link'
  | 'table'
  | 'checklist';

export interface CompletionSignal {
  key: string;
  label: string;
  weight: number;
  passed: (content: string) => boolean;
  hint: string;
}

function wrapSelection(textarea: HTMLTextAreaElement, before: string, after = before, placeholder = ''): { value: string; selectionStart: number; selectionEnd: number } {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = textarea.value.slice(start, end) || placeholder;
  const next = textarea.value.slice(0, start) + before + selected + after + textarea.value.slice(end);
  const newStart = start + before.length;
  const newEnd = newStart + selected.length;
  return { value: next, selectionStart: newStart, selectionEnd: newEnd };
}

function prefixLines(textarea: HTMLTextAreaElement, prefix: string): { value: string; selectionStart: number; selectionEnd: number } {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  const segment = value.slice(lineStart, end);
  const prefixed = segment
    .split('\n')
    .map((l) => (l.startsWith(prefix) ? l : prefix + l))
    .join('\n');
  const next = value.slice(0, lineStart) + prefixed + value.slice(end);
  return { value: next, selectionStart: start + prefix.length, selectionEnd: end + (prefixed.length - segment.length) };
}

function applyAction(textarea: HTMLTextAreaElement | null, action: ToolAction, onChange: (value: string, selStart: number, selEnd: number) => void): { value: string; selStart: number; selEnd: number } | null {
  if (!textarea) return null;
  let result: { value: string; selectionStart: number; selectionEnd: number } | null = null;
  switch (action) {
    case 'bold':
      result = wrapSelection(textarea, '**', '**', 'bold text');
      break;
    case 'italic':
      result = wrapSelection(textarea, '*', '*', 'italic text');
      break;
    case 'h1':
      result = prefixLines(textarea, '# ');
      break;
    case 'h2':
      result = prefixLines(textarea, '## ');
      break;
    case 'h3':
      result = prefixLines(textarea, '### ');
      break;
    case 'ul':
      result = prefixLines(textarea, '- ');
      break;
    case 'ol':
      result = prefixLines(textarea, '1. ');
      break;
    case 'quote':
      result = prefixLines(textarea, '> ');
      break;
    case 'code': {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selected = textarea.value.slice(start, end) || 'code';
      const next = textarea.value.slice(0, start) + '```\n' + selected + '\n```' + textarea.value.slice(end);
      result = { value: next, selectionStart: start + 4, selectionEnd: start + 4 + selected.length };
      break;
    }
    case 'link': {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selected = textarea.value.slice(start, end) || 'link text';
      const next = textarea.value.slice(0, start) + '[' + selected + '](https://)' + textarea.value.slice(end);
      result = { value: next, selectionStart: start + selected.length + 3, selectionEnd: start + selected.length + 11 };
      break;
    }
    case 'table': {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const sample = '| Column 1 | Column 2 |\n|----------|----------|\n| value    | value    |';
      const next = textarea.value.slice(0, start) + (start > 0 && !textarea.value[start - 1].match(/\n/) ? '\n' : '') + sample + textarea.value.slice(end);
      result = { value: next, selectionStart: start + sample.length, selectionEnd: start + sample.length };
      break;
    }
    case 'checklist':
      result = prefixLines(textarea, '- [ ] ');
      break;
  }
  if (result) onChange(result.value, result.selectionStart, result.selectionEnd);
  return result ? { value: result.value, selStart: result.selectionStart, selEnd: result.selectionEnd } : null;
}

function renderMarkdown(md: string): string {
  // Lightweight markdown renderer for preview (safe, escape-first).
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lines = md.split('\n');
  const out: string[] = [];
  let inCode = false;
  let inList = false;
  let listType: 'ul' | 'ol' | null = null;

  const closeList = () => {
    if (inList && listType) {
      out.push(`</${listType}>`);
      inList = false;
      listType = null;
    }
  };

  for (let raw of lines) {
    const line = esc(raw);
    if (line.startsWith('```')) {
      closeList();
      if (!inCode) { out.push('<pre class="rounded-md bg-muted/40 p-3 text-xs font-mono overflow-x-auto"><code>'); inCode = true; }
      else { out.push('</code></pre>'); inCode = false; }
      continue;
    }
    if (inCode) { out.push(line); continue; }
    if (line.startsWith('### ')) { closeList(); out.push(`<h3 class="mt-3 text-sm font-semibold">${line.slice(4)}</h3>`); continue; }
    if (line.startsWith('## ')) { closeList(); out.push(`<h2 class="mt-4 text-base font-semibold">${line.slice(3)}</h2>`); continue; }
    if (line.startsWith('# ')) { closeList(); out.push(`<h1 class="mt-4 text-lg font-bold">${line.slice(2)}</h1>`); continue; }
    if (line.startsWith('> ')) { closeList(); out.push(`<blockquote class="border-l-2 border-primary/40 pl-3 text-muted-foreground italic">${line.slice(2)}</blockquote>`); continue; }
    const olMatch = /^(\d+)\.\s+/.exec(line);
    const ulMatch = /^-\s+\[[ x]\]\s+/.test(line) || /^-\s+/.test(line);
    if (olMatch) {
      if (listType !== 'ol') { closeList(); out.push('<ol class="ml-5 list-decimal space-y-0.5 text-sm">'); listType = 'ol'; inList = true; }
      const taskMatch = /^-\s+\[([ x])\]\s+(.*)$/.exec(line);
      const content = taskMatch ? `<span class="${taskMatch[1] === 'x' ? 'line-through text-muted-foreground' : ''}">${taskMatch[2]}</span>` : line.replace(/^\d+\.\s+/, '');
      out.push(`<li>${content}</li>`);
      continue;
    }
    if (ulMatch) {
      if (listType !== 'ul') { closeList(); out.push('<ul class="ml-5 list-disc space-y-0.5 text-sm">'); listType = 'ul'; inList = true; }
      const taskMatch = /^-\s+\[([ x])\]\s+(.*)$/.exec(line);
      const content = taskMatch ? `<span class="${taskMatch[1] === 'x' ? 'line-through text-muted-foreground' : ''}">${taskMatch[2]}</span>` : line.replace(/^-\s+/, '');
      out.push(`<li>${content}</li>`);
      continue;
    }
    closeList();
    if (line.trim() === '') { out.push(''); continue; }
    // inline: bold, italic, code, link
    const rendered = line
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code class="rounded bg-muted/60 px-1 py-0.5 text-xs">$1</code>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary underline" target="_blank" rel="noreferrer">$1</a>');
    out.push(`<p class="text-sm leading-relaxed">${rendered}</p>`);
  }
  closeList();
  if (inCode) out.push('</code></pre>');
  return out.join('\n');
}

export interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave?: (value: string) => Promise<void> | void;
  autoSaveDelayMs?: number;
  minHeight?: number;
  completionSignals?: CompletionSignal[];
  snippets?: SnippetItem[];
  onAiAssist?: () => void;
  aiLoading?: boolean;
  placeholder?: string;
  ariaLabel?: string;
}

export function MarkdownEditor({
  value,
  onChange,
  onSave,
  autoSaveDelayMs = 30000,
  minHeight = 480,
  completionSignals,
  snippets,
  onAiAssist,
  aiLoading,
  placeholder = 'Write in Markdown. Use toolbar to format. AI Assist helps draft ISO 22301 content.',
  ariaLabel = 'Markdown editor',
}: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showSnippets, setShowSnippets] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const lastValueRef = useRef(value);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detect changes → mark dirty
  useEffect(() => {
    if (value !== lastValueRef.current) {
      setDirty(true);
      lastValueRef.current = value;
    }
  }, [value]);

  // Reset dirty after external value matches (initial load)
  useEffect(() => {
    if (!dirty && value === lastValueRef.current) setSavedAt(Date.now());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save on debounce
  useEffect(() => {
    if (!onSave) return;
    if (!dirty) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        setSaving(true);
        await onSave(value);
        setSavedAt(Date.now());
        setDirty(false);
      } catch {
        // keep dirty for retry
      } finally {
        setSaving(false);
      }
    }, autoSaveDelayMs);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [value, dirty, onSave, autoSaveDelayMs]);

  const apply = useCallback((action: ToolAction) => {
    const result = applyAction(textareaRef.current, action, (v, s, e) => {
      onChange(v);
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(s, e);
        }
      });
    });
    return result;
  }, [onChange]);

  const insertSnippet = useCallback((snippet: SnippetItem) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const prefix = value && !value.endsWith('\n\n') ? (value.endsWith('\n') ? '\n' : '\n\n') : '';
    const inserted = prefix + snippet.content;
    const next = value.slice(0, start) + inserted + value.slice(end);
    onChange(next);
    setShowSnippets(false);
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const cursor = start + inserted.length;
        textareaRef.current.setSelectionRange(cursor, cursor);
      }
    });
  }, [value, onChange]);

  const completion = useMemo(() => {
    if (!completionSignals) return null;
    const total = completionSignals.reduce((s, c) => s + c.weight, 0) || 1;
    const passed = completionSignals.filter((c) => c.passed(value));
    const earned = passed.reduce((s, c) => s + c.weight, 0);
    return { percent: Math.round((earned / total) * 100), passed, signals: completionSignals };
  }, [completionSignals, value]);

  const wordCount = useMemo(() => value.trim().split(/\s+/).filter(Boolean).length, [value]);
  const charCount = value.length;
  const readMinutes = Math.max(1, Math.round(wordCount / 200));

  const savedAgo = savedAt ? `${Math.max(0, Math.round((Date.now() - savedAt) / 1000))}s ago` : 'unsaved';

  // Tick for "saved Xs ago" freshness
  const [, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(i);
  }, []);

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border/60 bg-card/60 p-1.5 backdrop-blur-sm">
        <ToolButton icon={<Bold className="h-3.5 w-3.5" />} label="Bold" onClick={() => apply('bold')} />
        <ToolButton icon={<Italic className="h-3.5 w-3.5" />} label="Italic" onClick={() => apply('italic')} />
        <Divider />
        <ToolButton icon={<Heading1 className="h-3.5 w-3.5" />} label="Heading 1" onClick={() => apply('h1')} />
        <ToolButton icon={<Heading2 className="h-3.5 w-3.5" />} label="Heading 2" onClick={() => apply('h2')} />
        <ToolButton icon={<Heading3 className="h-3.5 w-3.5" />} label="Heading 3" onClick={() => apply('h3')} />
        <Divider />
        <ToolButton icon={<List className="h-3.5 w-3.5" />} label="Bulleted list" onClick={() => apply('ul')} />
        <ToolButton icon={<ListOrdered className="h-3.5 w-3.5" />} label="Numbered list" onClick={() => apply('ol')} />
        <ToolButton icon={<Quote className="h-3.5 w-3.5" />} label="Blockquote" onClick={() => apply('quote')} />
        <ToolButton icon={<CodeIcon className="h-3.5 w-3.5" />} label="Code block" onClick={() => apply('code')} />
        <ToolButton icon={<LinkIcon className="h-3.5 w-3.5" />} label="Link" onClick={() => apply('link')} />
        <ToolButton icon={<Table className="h-3.5 w-3.5" />} label="Table" onClick={() => apply('table')} />
        <ToolButton icon={<span className="text-xs font-bold">☑</span>} label="Checklist" onClick={() => apply('checklist')} />
        <Divider />
        {snippets && snippets.length > 0 && (
          <button
            type="button"
            onClick={() => setShowSnippets(!showSnippets)}
            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${showSnippets ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
          >
            <Wand2 className="h-3.5 w-3.5" /> Snippets
          </button>
        )}
        {onAiAssist && (
          <button
            type="button"
            onClick={onAiAssist}
            disabled={aiLoading}
            className="inline-flex items-center gap-1 rounded-md bg-gradient-to-r from-primary to-accent px-2.5 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition-all hover:shadow disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5" /> {aiLoading ? 'AI drafting…' : 'AI Assist'}
          </button>
        )}
        <div className="ml-auto flex items-center gap-1">
          {onSave && (
            <div className="flex items-center gap-1 px-2 text-xs text-muted-foreground">
              <Save className={`h-3 w-3 ${saving ? 'anim-pulse-soft text-primary' : dirty ? 'text-amber-500' : 'text-emerald-500'}`} />
              <span>{saving ? 'Saving…' : dirty ? 'Unsaved' : `Saved ${savedAgo}`}</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${showPreview ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
            title={showPreview ? 'Hide preview' : 'Show preview'}
          >
            {showPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {showPreview ? 'Edit' : 'Preview'}
          </button>
        </div>
      </div>

      {/* Snippet picker */}
      {showSnippets && snippets && snippets.length > 0 && (
        <div className="surface surface-lift p-3 anim-fade-up">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Section snippets</h3>
            <button onClick={() => setShowSnippets(false)} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {snippets.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => insertSnippet(s)}
                className="rounded-lg border bg-card p-3 text-left text-xs transition-all hover:border-primary/40 hover:bg-muted/40"
              >
                <div className="font-semibold text-foreground">{s.label}</div>
                <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{s.category}</div>
                <div className="mt-1 text-xs text-muted-foreground line-clamp-2">{s.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Editor + Preview */}
      <div className={`grid gap-3 ${showPreview ? 'lg:grid-cols-2' : ''}`}>
        {!showPreview && (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            aria-label={ariaLabel}
            className="w-full resize-y rounded-lg border border-border/60 bg-card/40 p-4 font-mono text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            style={{ minHeight }}
          />
        )}
        {showPreview && (
          <>
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              aria-label={ariaLabel}
              className="w-full resize-y rounded-lg border border-border/60 bg-card/40 p-4 font-mono text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
              style={{ minHeight }}
            />
            <div
              className="rounded-lg border border-border/60 bg-card/40 p-4 overflow-y-auto prose prose-sm max-w-none"
              style={{ minHeight }}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(value) }}
            />
          </>
        )}
      </div>

      {/* Footer: word count, completion, save state */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>{wordCount} words · {charCount} chars · ~{readMinutes}m read</span>
        {completion && (
          <div className="flex flex-1 items-center gap-2 min-w-0">
            <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted/60">
              <div
                className={`h-full rounded-full transition-all duration-500 ${completion.percent >= 80 ? 'bg-emerald-500' : completion.percent >= 40 ? 'bg-amber-500' : 'bg-destructive'}`}
                style={{ width: `${completion.percent}%` }}
              />
            </div>
            <span className="font-medium text-foreground">{completion.percent}% complete</span>
            <span className="text-muted-foreground/70">({completion.passed.length}/{completion.signals.length} signals)</span>
          </div>
        )}
      </div>

      {/* Completion signals detail (when not at 100%) */}
      {completion && completion.passed.length < completion.signals.length && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
          <div className="font-semibold text-amber-700 dark:text-amber-400">Missing for completeness:</div>
          <ul className="mt-1.5 ml-4 list-disc space-y-0.5 text-muted-foreground">
            {completion.signals.filter((s) => !s.passed(value)).map((s) => (
              <li key={s.key}><span className="font-medium text-foreground">{s.label}</span> — {s.hint}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ToolButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {icon}
    </button>
  );
}

function Divider() {
  return <div className="mx-1 h-5 w-px bg-border" aria-hidden />;
}
