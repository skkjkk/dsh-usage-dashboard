// JS-body codemod: wrap hardcoded colors in src/client.js body (line 2+) with
// var(--dd-token, literal) so SVG/DOM charts follow the theme var table.
// SVG presentation attributes that CANNOT take var() (stop-color) are converted
// to style. Colors already inside var() are left alone (idempotent).
const fs = require('fs');
const path = 'src/client.js';
const raw = fs.readFileSync(path, 'utf8');
const nl = raw.indexOf('\n');
const line1 = raw.slice(0, nl);
let body = raw.slice(nl + 1);
if (!line1.includes('var(--dd-')) throw new Error('CSS not tokenized yet — run dark-codemod first');

const before = body;

// ---- 0. heat scales + calendar levels: large surfaces -> follow the theme ramps ----
body = body.replace(
  /tokens: \['transparent', '#e4e4e7', '#d4d4d8', '#b8b8bd', '#9ca3af', '#7e8794', '#646b78', '#52525b'\]/,
  "tokens: ['transparent', 'var(--dd-htk-1,#e4e4e7)', 'var(--dd-htk-2,#d4d4d8)', 'var(--dd-htk-3,#b8b8bd)', 'var(--dd-htk-4,#9ca3af)', 'var(--dd-htk-5,#7e8794)', 'var(--dd-htk-6,#646b78)', 'var(--dd-htk-7,#52525b)']",
);
body = body.replace(
  /cost: \['transparent', '#d1fae5', '#a7f3d0', '#6ee7b7', '#34d399', '#10b981', '#059669', '#047857'\]/,
  "cost: ['transparent', 'var(--dd-hc-1,#d1fae5)', 'var(--dd-hc-2,#a7f3d0)', 'var(--dd-hc-3,#6ee7b7)', 'var(--dd-hc-4,#34d399)', 'var(--dd-hc-5,#10b981)', 'var(--dd-hc-6,#059669)', 'var(--dd-hc-7,#047857)']",
);
body = body.replace(
  /dur: \['transparent', '#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8'\]/,
  "dur: ['transparent', 'var(--dd-hd-1,#dbeafe)', 'var(--dd-hd-2,#bfdbfe)', 'var(--dd-hd-3,#93c5fd)', 'var(--dd-hd-4,#60a5fa)', 'var(--dd-hd-5,#3b82f6)', 'var(--dd-hd-6,#2563eb)', 'var(--dd-hd-7,#1d4ed8)']",
);
const CALS = ['#EAEDEF', '#DDF3E5', '#B8E6C8', '#86D2A5', '#55BA83', '#2D9F68', '#1D7D50', '#125E3B'];
CALS.forEach((c, i) => {
  body = body.replace(`color: '${c}' }`, `color: 'var(--dd-cal-${i},${c})' }`);
});

// ---- 1. TREND_SEG_COLORS (lines ~34-36): theme-aware object ----
body = body.replace(
  /const TREND_SEG_COLORS = \{\r?\n\s*output: '#18181b', input: '#71717a', cache: '#d4d4d8',\r?\n\s*cost: '#10b981', durActive: '#3b82f6', durTotal: 'rgba\(59,130,246,0\.25\)'\r?\n\s*\}/,
  "const TREND_SEG_COLORS = {\r\n      output: 'var(--dd-text2,#18181b)', input: 'var(--dd-muted2,#71717a)', cache: 'var(--dd-border2,#d4d4d8)',\r\n      cost: 'var(--dd-green,#10b981)', durActive: 'var(--dd-blue,#3b82f6)', durTotal: 'rgba(59,130,246,0.25)'\r\n    }",
);

// ---- 2. duration legend (lines ~569-570) ----
body = body.replace(/color: '#60a5fa' \}/, "color: 'var(--dd-blue,#60a5fa)' }");
body = body.replace(/color: 'rgba\(96,165,250,0\.3\)' \}/, "color: 'rgba(96,165,250,0.3)' }");

// ---- 3. radar: rings / axes / labels / dots / chips ----
body = body.replace(/stroke: f === 1 \? '#d4d4d8' : '#e9e9ec'/,
  "stroke: f === 1 ? 'var(--dd-border2,#d4d4d8)' : 'var(--dd-border3,#e9e9ec)'");
body = body.replace(/style: \{ stroke: '#e9e9ec', strokeWidth: 1 \}/,
  "style: { stroke: 'var(--dd-border3,#e9e9ec)', strokeWidth: 1 }");
body = body.replace(/style: \{ fontSize: '22px', fill: '#52525b', fontWeight: 600 \}/,
  "style: { fontSize: '22px', fill: 'var(--dd-muted,#52525b)', fontWeight: 600 }");
// dot halo stroke (#fff card-like) + vertex chips (light surfaces)
body = body.replace(/stroke: '#fff',\r?\n\s*strokeOpacity:/,
  "stroke: 'var(--dd-surface,#fff)',\r\n          strokeOpacity:");
// legend chip selected ring
body = body.replace(/border: cur \? '1\.5px solid #fff' : 'none'/,
  "border: cur ? '1.5px solid var(--dd-surface,#fff)' : 'none'");
body = body.replace(/fill: '#ffffff', stroke: '#dcdce1', strokeWidth: 1/,
  "fill: 'var(--dd-surface,#ffffff)', stroke: 'var(--dd-border2,#dcdce1)', strokeWidth: 1");
body = body.replace(/style: \{ fontSize: '20px', fontWeight: 600, fill: '#3f3f46'/,
  "style: { fontSize: '20px', fontWeight: 600, fill: 'var(--dd-text2,#3f3f46)'");
// radar list / axis labels
body = body.replace(/color: '#3f3f46', overflow: 'hidden'/,
  "color: 'var(--dd-text2,#3f3f46)', overflow: 'hidden'");
body = body.replace(/color: '#a1a1aa', paddingLeft: 14 \}/,
  "color: 'var(--dd-faint,#a1a1aa)', paddingLeft: 14 }");
body = body.replace(/border: '1px solid #ececee', borderRadius: 8, marginTop: 4/,
  "border: '1px solid var(--dd-border4,#ececee)', borderRadius: 8, marginTop: 4");
body = body.replace(/h\('span', \{ style: \{ color: '#71717a' \} \}, d\.name\)/,
  "h('span', { style: { color: 'var(--dd-muted2,#71717a)' } }, d.name)");
body = body.replace(/color: f == null \? '#a1a1aa' : '#3f3f46'/,
  "color: f == null ? 'var(--dd-faint,#a1a1aa)' : 'var(--dd-text2,#3f3f46)'");
body = body.replace(/background: '#f0f0f2', borderRadius: 99 \}/,
  "background: 'var(--dd-border3,#f0f0f2)', borderRadius: 99 }");

// ---- 4. cache hit-rate chart ----
// axis tick fill (x + y)
body = body.replace(/style: \{ fontSize: '10px', fill: '#9ca3af' \}/,
  "style: { fontSize: '10px', fill: 'var(--dd-faint,#9ca3af)' }");
body = body.replace(/style: \{ fontSize: '9px', fill: '#9ca3af' \}/g,
  "style: { fontSize: '9px', fill: 'var(--dd-faint,#9ca3af)' }");
// gridlines
body = body.replace(/style: \{ stroke: '#f0f0f2', strokeWidth: 1 \}/g,
  "style: { stroke: 'var(--dd-grid,#f0f0f2)', strokeWidth: 1 }");
// tooltip rows
body = body.replace(/color: noData \? '#a1a1aa' : '#18181b'/,
  "color: noData ? 'var(--dd-faint,#a1a1aa)' : 'var(--dd-text2,#18181b)'");
body = body.replace(/color: '#047857', whiteSpace: 'nowrap', fontWeight: '600' \}/,
  "color: 'var(--dd-green4,#047857)', whiteSpace: 'nowrap', fontWeight: '600' }");
body = body.replace(/color: '#71717a', whiteSpace: 'nowrap' \}/g,
  "color: 'var(--dd-muted2,#71717a)', whiteSpace: 'nowrap' }");
// guide line + gap bands
body = body.replace(/style: \{ stroke: '#a1a1aa', strokeWidth: 1, strokeDasharray: '3 3', opacity: 0\.6 \}/,
  "style: { stroke: 'var(--dd-faint,#a1a1aa)', strokeWidth: 1, strokeDasharray: '3 3', opacity: 0.6 }");
body = body.replace(
  /gapBands\.map\(\[x1, x2\], i\) => h\('rect', \{ key: 'gap' \+ i, x: x1, y: PAD\.top, width: Math\.max\(0, x2 - x1\), height: PH, style: \{ fill: '#fafafa' \} \}\)/,
  "gapBands.map(([x1, x2], i) => h('rect', { key: 'gap' + i, x: x1, y: PAD.top, width: Math.max(0, x2 - x1), height: PH, style: { fill: 'var(--dd-hover2,#fafafa)' } })",
);
// cov paths / avg line
body = body.replace(/style: \{ stroke: '#f59e0b', strokeWidth: 1\.4/,
  "style: { stroke: 'var(--dd-amber,#f59e0b)', strokeWidth: 1.4");
body = body.replace(/style: \{ stroke: '#a1a1aa', strokeWidth: 1, strokeDasharray: '2 3', opa/,
  "style: { stroke: 'var(--dd-faint,#a1a1aa)', strokeWidth: 1, strokeDasharray: '2 3', opa");
body = body.replace(/style: \{ fontSize: '9px', fill: '#a1a1aa' \}/,
  "style: { fontSize: '9px', fill: 'var(--dd-faint,#a1a1aa)' }");
// hit-rate line + dots + badge
body = body.replace(/style: \{ stroke: '#10b981', strokeWidth: 2\.2, fill: 'none'/,
  "style: { stroke: 'var(--dd-green,#10b981)', strokeWidth: 2.2, fill: 'none'");
body = body.replace(/style: \{ fill: 'none', stroke: '#d4d4d8', strokeWidth: 1\.5 \}/,
  "style: { fill: 'none', stroke: 'var(--dd-border2,#d4d4d8)', strokeWidth: 1.5 }");
// inline dots (fill #10b981 + stroke #fff, various strokeWidth)
body = body.replace(/style: \{ fill: '#10b981', stroke: '#fff', strokeWidth: 1\.2 \}/,
  "style: { fill: 'var(--dd-green,#10b981)', stroke: 'var(--dd-surface,#fff)', strokeWidth: 1.2 }");
body = body.replace(/style: \{ fill: '#10b981', stroke: '#fff', strokeWidth: 1\.8 \}/,
  "style: { fill: 'var(--dd-green,#10b981)', stroke: 'var(--dd-surface,#fff)', strokeWidth: 1.8 }");
body = body.replace(/stroke: '#fff', strokeWidth: 1\.8 \}/g,
  "stroke: 'var(--dd-surface,#fff)', strokeWidth: 1.8 }");
// dots whose stroke was already converted above (ordering artifact)
body = body.replace(/style: \{ fill: '#10b981', stroke: 'var\(--dd-surface,#fff\)', strokeWidth: 1\.8 \}/g,
  "style: { fill: 'var(--dd-green,#10b981)', stroke: 'var(--dd-surface,#fff)', strokeWidth: 1.8 }");
body = body.replace(/style: \{ fill: '#10b981', stroke: 'var\(--dd-surface,#fff\)', strokeWidth: 1\.2 \}/g,
  "style: { fill: 'var(--dd-green,#10b981)', stroke: 'var(--dd-surface,#fff)', strokeWidth: 1.2 }");
body = body.replace(/style: \{ fill: '#10b981' \} \}\)/,
  "style: { fill: 'var(--dd-green,#10b981)' } })");
body = body.replace(/style: \{ fontSize: '10px', fontWeight: '700', fill: '#fff' \}/,
  "style: { fontSize: '10px', fontWeight: '700', fill: 'var(--dd-oninv,#fff)' }");
// empty-vol bars
body = body.replace(/style: \{ fill: '#f0f0f2' \} \}\)/,
  "style: { fill: 'var(--dd-grid,#f0f0f2)' } })");
// volume bars
body = body.replace(/style: \{ fill: '#e4e4e7' \} \}\)/,
  "style: { fill: 'var(--dd-bar-o,#e4e4e7)' } })");
body = body.replace(/style: \{ fill: '#10b981', opacity: 0\.85 \} \}\)/,
  "style: { fill: 'var(--dd-green,#10b981)', opacity: 0.85 } })");
// gradient stops: attributes -> style (SVG attributes can't take var())
body = body.replace(/h\('stop', \{ offset: '0', 'stop-color': '#10b981', 'stop-opacity': '0\.14' \}\)/,
  "h('stop', { offset: '0', style: { stopColor: 'var(--dd-green,#10b981)', stopOpacity: '0.14' } })");
body = body.replace(/h\('stop', \{ offset: '1', 'stop-color': '#10b981', 'stop-opacity': '0' \}\)/,
  "h('stop', { offset: '1', style: { stopColor: 'var(--dd-green,#10b981)', stopOpacity: '0' } })");

// ---- 5. cache-card legend swatches (lines ~1418-1423) ----
body = body.replace(/borderTopColor: '#10b981' \}/,
  "borderTopColor: 'var(--dd-green,#10b981)' }");
body = body.replace(/borderTopColor: '#f59e0b', borderTopStyle: 'dashed' \}/,
  "borderTopColor: 'var(--dd-amber,#f59e0b)', borderTopStyle: 'dashed' }");
body = body.replace(/borderTopColor: '#a1a1aa', borderTopStyle: 'dotted' \}/,
  "borderTopColor: 'var(--dd-faint,#a1a1aa)', borderTopStyle: 'dotted' }");
body = body.replace(/style: \{ background: '#10b981' \} \}/,
  "style: { background: 'var(--dd-green,#10b981)' } }");
body = body.replace(/style: \{ background: '#e4e4e7' \} \}/,
  "style: { background: 'var(--dd-bar-o,#e4e4e7)' } }");

// ---- 6. retry button (line ~1727) ----
body = body.replace(/style: \{ color: '#18181b', textDecoration: 'underline'/,
  "style: { color: 'var(--dd-text2,#18181b)', textDecoration: 'underline'");

// ---------- verify ----------
const stray = body.match(/#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g) || [];
const themed = (body.match(/var\(--dd-/g) || []).length;
console.log('body var() count:', themed);
console.log('remaining hex literals:', stray.length);
const byVal = {};
for (const s of stray) byVal[s] = (byVal[s] || 0) + 1;
console.log(JSON.stringify(byVal, null, 0));
if (body === before) throw new Error('NOTHING CHANGED — patterns stale');
fs.writeFileSync(path, line1 + '\n' + body, 'utf8');
console.log('written.');
