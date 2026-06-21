#!/usr/bin/env python3
"""Convert ResiliPlan DR plan to PDF with whitelabel cover page.

Uses branding config from tenant settings:
- companyName, companyTagline
- logoBase64 (embedded image)
- primaryColor, accentColor
- documentFooter
- defaultDocumentPrefix
- hidePlatformBranding
- documentClassification

Generates a single HTML document with cover page + TOC + sections,
then renders to PDF via weasyprint.
"""
import base64
import json
import os
import re
import sys
import subprocess
from pathlib import Path
from datetime import datetime


def parse_sections(skeleton: str) -> list[dict]:
    parts = re.split(r'=== SECTION:\s*([^=]+?)\s*===', skeleton)
    sections = []
    for i in range(1, len(parts), 2):
        key = parts[i].strip()
        content = parts[i+1].strip() if i+1 < len(parts) else ''
        sections.append({'key': key, 'content': content})
    return sections


# Section title lookup (matches ISO_22301_SECTIONS in apps/api/src/drp/iso-template.ts)
SECTION_TITLES = {
    'context':     ('1. Context and Scope',           'ISO 22301:2019 Clause 4'),
    'leadership':  ('2. Leadership and Ownership',    'ISO 22301:2019 Clause 5'),
    'planning':    ('3. Planning and Objectives',     'ISO 22301:2019 Clause 6'),
    'support':     ('4. Support and Resources',       'ISO 22301:2019 Clause 7'),
    'operation':   ('5. Operational Control',         'ISO 22301:2019 Clause 8.1'),
    'bia':         ('6. Business Impact Analysis',    'ISO 22301:2019 Clause 8.2.2'),
    'risk':        ('7. Risk Assessment',             'ISO 22301:2019 Clause 8.2.3'),
    'strategy':    ('8. Recovery Strategy',           'ISO 22301:2019 Clause 8.3'),
    'procedure':   ('9. Recovery Procedure',          'ISO 22301:2019 Clause 8.4'),
    'communication': ('10. Communication Plan',       'ISO 22301:2019 Clause 8.4.3'),
    'validation':  ('11. Validation and Acceptance Criteria', 'ISO 22301:2019 Clause 8.5'),
    'exercise':    ('12. Exercise and Testing Plan',  'ISO 22301:2019 Clause 8.5'),
    'performance': ('13. Performance Evaluation',     'ISO 22301:2019 Clause 9'),
    'improvement': ('14. Continual Improvement',      'ISO 22301:2019 Clause 10'),
}


def md_to_html(text: str) -> str:
    """Lightweight Markdown → HTML for our subset (h1-h4, ul, ol, bold, italic, code, table, hr)."""
    lines = text.split('\n')
    html = []
    in_list = False
    in_olist = False
    in_table = False
    table_rows = []

    def flush_list():
        nonlocal in_list, in_olist
        if in_list:
            html.append('</ul>')
            in_list = False
        if in_olist:
            html.append('</ol>')
            in_olist = False

    def flush_table():
        nonlocal in_table, table_rows
        if in_table and table_rows:
            html.append('<table>')
            header = table_rows[0]
            html.append('<thead><tr>' + ''.join(f'<th>{cell}</th>' for cell in header) + '</tr></thead>')
            if len(table_rows) > 1:
                html.append('<tbody>')
                for row in table_rows[1:]:
                    html.append('<tr>' + ''.join(f'<td>{cell}</td>' for cell in row) + '</tr>')
                html.append('</tbody>')
            html.append('</table>')
            in_table = False
            table_rows = []

    def inline(s: str) -> str:
        s = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', s)
        s = re.sub(r'(?<!\*)\*([^*]+)\*(?!\*)', r'<em>\1</em>', s)
        s = re.sub(r'`([^`]+)`', r'<code>\1</code>', s)
        return s

    for line in lines:
        # Table detection
        if '|' in line and line.strip().startswith('|') and line.strip().endswith('|'):
            cells = [c.strip() for c in line.strip()[1:-1].split('|')]
            if not in_table:
                in_table = True
            if all(re.match(r'^[-:]+$', c) for c in cells):
                continue  # separator
            table_rows.append(cells)
            continue
        else:
            if in_table:
                flush_table()

        # Headings
        m = re.match(r'^(#{1,4})\s+(.+)$', line)
        if m:
            flush_list()
            level = len(m.group(1))
            html.append(f'<h{level}>{inline(m.group(2))}</h{level}>')
            continue

        # Horizontal rule
        if re.match(r'^---+\s*$', line):
            flush_list()
            html.append('<hr/>')
            continue

        # Lists
        if re.match(r'^[-*]\s+', line):
            if in_olist:
                html.append('</ol>')
                in_olist = False
            if not in_list:
                html.append('<ul>')
                in_list = True
            html.append(f'<li>{inline(line[2:].strip())}</li>')
            continue
        if re.match(r'^\d+\.\s+', line):
            if in_list:
                html.append('</ul>')
                in_list = False
            if not in_olist:
                html.append('<ol>')
                in_olist = True
            stripped = re.sub(r'^\d+\.\s+', '', line).strip()
            html.append(f'<li>{inline(stripped)}</li>')
            continue

        # Empty line
        if not line.strip():
            flush_list()
            continue

        # Paragraph
        flush_list()
        html.append(f'<p>{inline(line.strip())}</p>')

    flush_list()
    flush_table()
    return '\n'.join(html)


def build_html(plan_meta: dict, sections: list[dict], branding: dict) -> str:
    """Build the full HTML document with cover + content."""
    company = branding.get('companyName', 'PT Datacomm Diangraha')
    tagline = branding.get('companyTagline', 'IT Service Resilience')
    primary = branding.get('primaryColor', '#0F4C81')
    accent = branding.get('accentColor', '#F59E0B')
    classification = branding.get('documentClassification', 'confidential').upper()
    footer = branding.get('documentFooter', 'Confidential — Internal Use Only')
    doc_prefix = branding.get('defaultDocumentPrefix', 'Disaster Recovery Plan')
    logo_b64 = branding.get('logoBase64', '')

    # Logo: either base64 or fallback to a styled text mark
    if logo_b64:
        logo_html = f'<img class="logo" src="{logo_b64}" alt="{company} logo"/>'
    else:
        # Build a text-based mark with primary color
        initials = ''.join(w[0] for w in company.split()[:3]).upper() or 'CO'
        logo_html = f'<div class="logo-mark" style="background:{primary}">{initials}</div>'

    # Quality score color
    q = plan_meta.get('quality') or {}
    score = q.get('score', 0)
    status = q.get('status', 'fair').upper()
    score_color = '#16a34a' if score >= 75 else '#f59e0b' if score >= 50 else '#dc2626'

    # Build sections HTML
    section_html_parts = []
    for sec in sections:
        title, clause = SECTION_TITLES.get(sec['key'], (sec['key'].title(), ''))
        words = len(sec['content'].split())
        body_html = md_to_html(sec['content'])
        section_html_parts.append(f'''
        <section class="dr-section" id="sec-{sec['key']}">
          <header>
            <h2>{title}</h2>
            <p class="clause">{clause} — {words} words</p>
          </header>
          <div class="body">{body_html}</div>
        </section>
        ''')

    sections_html = '\n'.join(section_html_parts)

    # Quality signals
    if q.get('signals'):
        signals_rows = ''.join(
            f'<tr><td class="{"pass" if s["passed"] else "fail"}">{"✓" if s["passed"] else "✗"}</td>'
            f'<td>{s["label"]}</td><td class="weight">+{s["weight"]}</td><td>{s["detail"]}</td></tr>'
            for s in q['signals']
        )
        signals_html = f'<table class="signals"><thead><tr><th></th><th>Signal</th><th>Weight</th><th>Detail</th></tr></thead><tbody>{signals_rows}</tbody></table>'
    else:
        signals_html = ''

    # Cover page
    today = datetime.utcnow().strftime('%B %d, %Y')

    html = f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>{plan_meta["title"]} — {company}</title>
<style>
  @page {{
    size: A4;
    margin: 2cm 1.8cm 2.5cm 1.8cm;
    @top-left   {{ content: "{company}"; font-family: 'DejaVu Sans', sans-serif; font-size: 9pt; color: #666; }}
    @top-right  {{ content: "{classification}"; font-family: 'DejaVu Sans', sans-serif; font-size: 9pt; color: #c00; font-weight: bold; }}
    @bottom-left  {{ content: "{footer}"; font-family: 'DejaVu Sans', sans-serif; font-size: 8pt; color: #888; }}
    @bottom-right {{ content: "Page " counter(page) " of " counter(pages); font-family: 'DejaVu Sans', sans-serif; font-size: 8pt; color: #888; }}
  }}
  @page :first {{
    margin: 0;
    @top-left {{ content: ""; }}
    @top-right {{ content: ""; }}
    @bottom-left {{ content: ""; }}
    @bottom-right {{ content: ""; }}
  }}
  * {{ box-sizing: border-box; }}
  body {{ font-family: 'DejaVu Sans', sans-serif; font-size: 10.5pt; line-height: 1.55; color: #1a1a1a; }}

  /* ============ COVER PAGE ============ */
  .cover {{
    page-break-after: always;
    height: 29.7cm;
    width: 21cm;
    padding: 2.5cm 2cm;
    background: linear-gradient(180deg, #ffffff 0%, #f4f7fb 100%);
    border-top: 14px solid {primary};
    position: relative;
    display: flex;
    flex-direction: column;
  }}
  .cover-top {{ display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5cm; }}
  .cover-top .logo {{ max-height: 1.8cm; }}
  .cover-top .logo-mark {{
    width: 2cm; height: 2cm; border-radius: 8px;
    display: inline-flex; align-items: center; justify-content: center;
    color: white; font-weight: 700; font-size: 16pt;
  }}
  .cover-top .classification {{
    border: 2px solid #c00; color: #c00; padding: 4px 12px;
    font-weight: 700; font-size: 9pt; letter-spacing: 1px;
  }}
  .cover-divider {{ height: 2px; background: {primary}; margin: 0 0 1.5cm 0; opacity: 0.85; }}
  .cover-pre {{ color: {primary}; font-size: 11pt; letter-spacing: 3px; text-transform: uppercase; font-weight: 600; }}
  .cover-title {{ font-size: 28pt; font-weight: 800; color: #0a0a0a; line-height: 1.18; margin: 0.4cm 0 0.3cm 0; }}
  .cover-subtitle {{ font-size: 13pt; color: #555; margin-bottom: 1.5cm; }}
  .cover-meta {{ display: grid; grid-template-columns: 1fr 1fr; gap: 0.4cm 0.8cm; margin-top: 1cm; font-size: 10.5pt; }}
  .cover-meta .k {{ color: #666; font-weight: 600; }}
  .cover-meta .v {{ color: #111; }}
  .cover-footer {{ margin-top: auto; padding-top: 1cm; border-top: 1px solid #d4d4d4; display: flex; justify-content: space-between; align-items: flex-end; font-size: 9pt; color: #555; }}
  .cover-footer .left {{ line-height: 1.5; }}
  .cover-footer .right {{ text-align: right; color: {primary}; font-weight: 600; }}
  .accent-bar {{ width: 80px; height: 5px; background: {accent}; margin: 0.5cm 0 1.2cm 0; }}

  /* ============ TOC PAGE ============ */
  .toc {{ page-break-after: always; padding-top: 0.5cm; }}
  .toc h1 {{ color: {primary}; border-bottom: 2px solid {primary}; padding-bottom: 6px; }}
  .toc ol {{ list-style: none; padding-left: 0; counter-reset: toc; }}
  .toc ol li {{ counter-increment: toc; padding: 8px 0; border-bottom: 1px dotted #ccc; display: flex; justify-content: space-between; }}
  .toc ol li::before {{ content: counter(toc) ". "; color: {primary}; font-weight: 700; margin-right: 8px; }}

  /* ============ METADATA + QUALITY ============ */
  h1 {{ color: {primary}; border-bottom: 2px solid {primary}; padding-bottom: 6px; margin-top: 0.6cm; }}
  h2 {{ color: {primary}; margin-top: 0.8cm; padding-top: 0.3cm; border-top: 1px solid #e5e5e5; }}
  h2:first-of-type {{ border-top: none; padding-top: 0; }}
  h3 {{ color: #333; }}
  h4 {{ color: #555; }}
  .clause {{ color: #888; font-size: 9pt; font-style: italic; margin: 4px 0 14px 0; }}
  table {{ border-collapse: collapse; width: 100%; margin: 8px 0 16px 0; font-size: 10pt; }}
  th {{ background: {primary}; color: white; padding: 6px 10px; text-align: left; }}
  td {{ padding: 5px 10px; border-bottom: 1px solid #e0e0e0; }}
  tr:nth-child(even) td {{ background: #f8f9fb; }}
  .signals td.pass {{ color: #16a34a; font-weight: 700; }}
  .signals td.fail {{ color: #dc2626; font-weight: 700; }}
  .signals .weight {{ text-align: right; color: #666; width: 60px; }}
  ul, ol {{ margin: 4px 0 12px 0; padding-left: 24px; }}
  li {{ margin: 3px 0; }}
  p {{ margin: 6px 0; }}
  code {{ background: #f1f3f5; padding: 1px 5px; border-radius: 3px; font-size: 9.5pt; color: #c7254e; }}
  hr {{ border: none; border-top: 1px solid #d4d4d4; margin: 12px 0; }}
  .dr-section {{ page-break-inside: avoid; }}
  .quality-score {{ font-size: 18pt; font-weight: 800; color: {score_color}; }}
  .quality-badge {{ display: inline-block; padding: 3px 10px; border-radius: 4px; color: white; font-weight: 700; font-size: 10pt; background: {score_color}; }}
  .doc-control {{ font-size: 9pt; color: #666; margin-top: 1cm; padding-top: 0.5cm; border-top: 1px solid #d4d4d4; }}
</style>
</head>
<body>

<!-- =================== COVER =================== -->
<div class="cover">
  <div class="cover-top">
    {logo_html}
    <div class="classification">{classification}</div>
  </div>
  <div class="cover-divider"></div>
  <div class="cover-pre">{doc_prefix}</div>
  <h1 class="cover-title">{plan_meta["title"]}</h1>
  <div class="cover-subtitle">{plan_meta.get("serviceName", "")} — {plan_meta.get("description", "")[:100]}</div>
  <div class="accent-bar"></div>
  <div class="cover-meta">
    <div><span class="k">Service Owner</span><div class="v">{plan_meta.get("serviceOwner", "—")}</div></div>
    <div><span class="k">Criticality</span><div class="v">{plan_meta.get("criticality", "—").upper()}</div></div>
    <div><span class="k">RTO Target</span><div class="v">{plan_meta["rtoMinutes"]} minutes ({plan_meta["rtoMinutes"]//60}h {plan_meta["rtoMinutes"]%60}m)</div></div>
    <div><span class="k">RPO Target</span><div class="v">{plan_meta["rpoMinutes"]} minutes ({plan_meta["rpoMinutes"]//60}h {plan_meta["rpoMinutes"]%60}m)</div></div>
    <div><span class="k">Plan ID</span><div class="v"><code>{plan_meta["id"]}</code></div></div>
    <div><span class="k">Status</span><div class="v">{plan_meta.get("status", "draft").upper()}</div></div>
    <div><span class="k">Document Date</span><div class="v">{today}</div></div>
    <div><span class="k">Standard</span><div class="v">ISO 22301:2019</div></div>
  </div>
  <div class="cover-footer">
    <div class="left">
      <strong>{company}</strong><br/>
      {tagline}<br/>
      {footer}
    </div>
    <div class="right">
      {doc_prefix}<br/>
      <span style="font-size:14pt;">{plan_meta["id"][:8].upper()}</span>
    </div>
  </div>
</div>

<!-- =================== TOC =================== -->
<div class="toc">
  <h1>Table of Contents</h1>
  <ol>
    <li>Plan Metadata</li>
    <li>Plan Quality Score</li>
    {"".join(f'<li>{SECTION_TITLES.get(s["key"], (s["key"].title(),))[0]}</li>' for s in sections)}
    <li>Document Control</li>
  </ol>
</div>

<!-- =================== METADATA =================== -->
<h1>Plan Metadata</h1>
<table>
  <tr><th>Field</th><th>Value</th></tr>
  <tr><td>Service</td><td>{plan_meta.get("serviceName", "—")}</td></tr>
  <tr><td>Service Owner</td><td>{plan_meta.get("serviceOwner", "—")}</td></tr>
  <tr><td>Criticality</td><td>{plan_meta.get("criticality", "—")}</td></tr>
  <tr><td>RTO Target</td><td>{plan_meta["rtoMinutes"]} minutes ({plan_meta["rtoMinutes"]//60}h {plan_meta["rtoMinutes"]%60}m)</td></tr>
  <tr><td>RPO Target</td><td>{plan_meta["rpoMinutes"]} minutes ({plan_meta["rpoMinutes"]//60}h {plan_meta["rpoMinutes"]%60}m)</td></tr>
  <tr><td>Plan ID</td><td><code>{plan_meta["id"]}</code></td></tr>
  <tr><td>Status</td><td>{plan_meta.get("status", "draft")}</td></tr>
  <tr><td>Created</td><td>{plan_meta.get("createdAt", "—")}</td></tr>
  <tr><td>Last Updated</td><td>{plan_meta.get("updatedAt", "—")}</td></tr>
</table>

<h1>Plan Quality Score</h1>
<p><span class="quality-score">{score}/100</span> <span class="quality-badge">{status}</span></p>
{signals_html}

<!-- =================== SECTIONS =================== -->
<h1>Plan Sections</h1>
{sections_html}

<!-- =================== DOCUMENT CONTROL =================== -->
<h1>Document Control</h1>
<div class="doc-control">
  <table>
    <tr><th>Field</th><th>Value</th></tr>
    <tr><td>Document Type</td><td>{doc_prefix}</td></tr>
    <tr><td>Standard</td><td>ISO 22301:2019 — Security and resilience — Business continuity management systems</td></tr>
    <tr><td>Organization</td><td>{company}</td></tr>
    <tr><td>Tagline</td><td>{tagline}</td></tr>
    <tr><td>Classification</td><td>{classification}</td></tr>
    <tr><td>Document Date</td><td>{today}</td></tr>
    <tr><td>Approval Status</td><td>DRAFT — Pending review and approval</td></tr>
  </table>
</div>

</body>
</html>'''
    return html


def main():
    if len(sys.argv) < 5:
        print("Usage: build_pdf.py <plan.json> <sections.json> <branding.json> <output.pdf>")
        sys.exit(1)

    with open(sys.argv[1]) as f:
        plan = json.load(f)
    with open(sys.argv[2]) as f:
        skel_data = json.load(f)
    with open(sys.argv[3]) as f:
        branding = json.load(f)

    sections = parse_sections(skel_data['skeleton'])

    plan_meta = {
        'id': plan['id'],
        'title': plan['title'],
        'serviceName': plan['serviceName'],
        'serviceOwner': plan.get('serviceOwner', '—'),
        'description': plan.get('description', ''),
        'criticality': plan.get('criticality', '—'),
        'rtoMinutes': plan['rtoMinutes'],
        'rpoMinutes': plan['rpoMinutes'],
        'status': plan.get('status', 'draft'),
        'createdAt': plan.get('createdAt', '—'),
        'updatedAt': plan.get('updatedAt', '—'),
        'quality': plan.get('quality'),
    }

    html = build_html(plan_meta, sections, branding)

    # Write HTML for debugging
    html_path = Path(sys.argv[4]).with_suffix('.html')
    html_path.write_text(html)
    print(f'  HTML: {html_path} ({len(html):,} chars)')

    # Render to PDF with weasyprint (resolve from PATH or WEASYPRINT_BIN env override)
    weasyprint_bin = os.environ.get('WEASYPRINT_BIN', 'weasyprint')
    out_pdf = sys.argv[4]
    result = subprocess.run([
        weasyprint_bin,
        str(html_path),
        out_pdf,
    ], capture_output=True, text=True)

    if result.returncode != 0:
        print('  WEASYPRINT ERROR:', result.stderr[:500])
        sys.exit(2)

    size = Path(out_pdf).stat().st_size
    print(f'  PDF: {out_pdf} ({size:,} bytes)')


if __name__ == '__main__':
    main()
