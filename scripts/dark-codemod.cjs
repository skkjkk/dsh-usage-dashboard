// Dark-mode codemod for src/client.js (line 1 = CSS string).
//
// Strategy (vibecafe.ai-inspired): light CSS keeps pixel-identical rendering by
// turning every color literal into var(--dd-token, literal); the dark block
// shrinks to ONE var-definition rule on body[data-ds-dark-theme] .dd-dash.
//
// Context-sensitive literals (#18181b as inverted-bg vs text, #fff as surface
// vs on-invert, #f3f4f6 as page-bg vs hover, #e2e3e7 as seg-bg vs tip-bg) are
// handled by a per-selector override table; everything else maps by literal.
const fs = require('fs');

const path = 'src/client.js';
const raw = fs.readFileSync(path, 'utf8');
const nl = raw.indexOf('\n');
const line1 = raw.slice(0, nl);
const rest = raw.slice(nl + 1);

const PREFIX = "const CSS = '";
if (!line1.startsWith(PREFIX)) throw new Error('unexpected line1 head: ' + line1.slice(0, 30));
const HEAD = line1.slice(0, PREFIX.length); // "const CSS = '"
const TAIL = line1.endsWith('\r') ? "'\r" : "'";
if (!line1.endsWith(TAIL)) throw new Error('unexpected line1 tail');
const css = line1.slice(PREFIX.length, line1.length - TAIL.length);

const MARK = ';body[data-ds-dark-theme]';
const semi = css.indexOf(MARK);
let light = semi < 0
  ? css                                  // no dark block (HEAD state): tokenize everything
  : css.slice(0, semi + 1);               // includes trailing ';'
const oldDark = semi < 0
  ? ''
  : css.slice(semi + MARK.length).replace(/^;/, '');
if (light.includes('var(--dd-')) throw new Error('already tokenized?');
// HEAD's CSS string ends with an UNCLOSED rule (.dd-model-item input{...flex:none;)
// — browsers tolerate it at EOF, but the rule regex below needs the brace.
if (!light.endsWith('}')) light += '}';

// ---------- harvest old var defs (keep chart ramps verbatim) ----------
const oldVars = new Map();
for (const m of oldDark.matchAll(/--dd-[a-z0-9-]+:[^;}]+/g)) {
  const i = m[0].indexOf(':');
  oldVars.set(m[0].slice(0, i), m[0].slice(i + 1));
}

// ---------- mask at-rules (no colors inside, keep verbatim) ----------
// Match each at-rule with balanced braces, replace with a placeholder, and
// keep the text between matches (replace-with-callback preserves inter-rule
// text, unlike match()+join() which drops it).
const AT_RULE_RE = /@(?:keyframes|media|supports)\b[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g;
const atBlocks = [];
light = light.replace(AT_RULE_RE, (m) => {
  atBlocks.push(m);
  return `\u0000A${atBlocks.length - 1}\u0000`;
});

// ---------- context overrides ----------
// [selector regex (anchored per comma-group), find regex, token, whole?]
// whole=true wraps the ENTIRE declaration value (gradients); default wraps
// only the color literal inside the matched declaration (shorthands keep width/style).
const CTX = [
  [/^\.dd-pill\.on$/, /background:#18181b/, 'inv'],
  [/^\.dd-seg-btn\.on$/, /background:#18181b/, 'inv'],
  [/^\.dd-drop-item\.on \.dd-check$/, /background:#18181b/, 'inv'],
  [/^\.dd-custom \.apply$/, /background:#18181b/, 'inv'],
  [/^\.dd-pill\.on$/, /color:#fff/, 'oninv'],
  [/^\.dd-seg-btn\.on$/, /color:#fff/, 'oninv'],
  [/^\.dd-drop-item\.on \.dd-check$/, /color:#fff/, 'oninv'],
  [/^\.dd-custom \.apply$/, /color:#fff/, 'oninv'],
  [/^\.dd-custom \.apply:hover$/, /background:#27272a/, 'invh'],
  [/^\.dd-dash$/, /background:#f3f4f6/, 'bg'],
  [/^\.dd-drop-item:hover$/, /background:#f3f4f6/, 'hover'],
  [/^\.dd-drop-item\.on$/, /background:#f3f4f6/, 'hover'],
  [/^\.dd-pop td$/, /border-bottom:1px solid #f3f4f6/, 'border3'],
  [/^\.dd-range$/, /background:#e2e3e7/, 'bg-seg'],
  [/^\.dd-seg-group$/, /background:#e2e3e7/, 'bg-seg'],
  [/^\.dd-tip$/, /background:#e2e3e7/, 'tipbg'],
  [/^\.dd-cal-floating-tip$/, /background:#e2e3e7/, 'tipbg'],
  [/^\.dd-heat-cell \.tip$/, /background:#e2e3e7/, 'tipbg'],
  [/^\.dd-busy \.spinner$/, /border:1\.5px solid #e2e3e7/, 'border5'],
  [/^\.dd-cache-kpi\.hero$/, /background:linear-gradient\([^)]*#ecfdf5[^)]*\)/, 'herobg', true],
];

const DEFAULT = {
  '#f3f4f6': 'hover', '#f4f4f5': 'hover', '#fafafa': 'hover2', '#f0fdf4': 'sel',
  '#fff': 'surface', '#e4e4e7': 'border', '#d4d4d8': 'border2', '#ececf0': 'border4',
  '#f0f0f2': 'border3', '#e2e3e7': 'tipbg', '#f6f6f8': 'track',
  '#09090b': 'text', '#18181b': 'text2', '#3f3f46': 'text2',
  '#52525b': 'muted', '#71717a': 'muted2', '#a1a1aa': 'faint', '#999': 'muted2',
  '#34d399': 'green', '#10b981': 'green3', '#047857': 'green4', '#059669': 'green4',
  '#d1fae5': 'heroline',
  '#60a5fa': 'blue', '#93c5fd': 'blue2', '#ef4444': 'red', '#dc2626': 'red2',
  '#f59e0b': 'amber',
};

const slots = []; // placeholder registry
function place(text) {
  slots.push(text);
  return `\u0001${slots.length - 1}\u0001`;
}

const rules = light.match(/[^{}]+\{[^{}]*\}/g);
if (!rules) throw new Error('no rules parsed');
const applied = [];
// Tokenize via replace-with-callback: placeholders (\u0000A* for at-rules,
// \u0001* for context slots) survive untouched; all other rule bodies are
// rewritten in place; inter-rule text (comments, at-rule heads) is preserved.
let ruleCount = 0;
light = light.replace(/[^{}]+\{[^{}]*\}/g, (rule) => {
  ruleCount++;
  const bi = rule.indexOf('{');
  const sel = rule.slice(0, bi);
  let body = rule.slice(bi);
  const parts = sel.split(',').map((s) => s.trim());
  for (const [selRe, find, tok, whole] of CTX) {
    if (!parts.some((p) => selRe.test(p))) continue;
    if (!find.test(body)) { applied.push(`MISS  ${sel} -> ${tok}`); continue; }
    body = body.replace(find, (m) => {
      if (whole) {
        const ci = m.indexOf(':');
        return place(`${m.slice(0, ci + 1)}var(--dd-${tok},${m.slice(ci + 1)})`);
      }
      // wrap only the color literal, keep prop name / widths verbatim
      return place(m.replace(
        /#[0-9a-fA-F]{3}(?![0-9a-fA-F])|#[0-9a-fA-F]{6}\b|rgba?\([^)]*\)/,
        (v) => `var(--dd-${tok},${v})`,
      ));
    });
    applied.push(`ok    ${sel.trim()} -> ${tok}`);
  }
  body = body.replace(/#[0-9a-fA-F]{3}(?![0-9a-fA-F])|#[0-9a-fA-F]{6}\b|rgba?\([^)]*\)/g, (v) => {
    if (/^rgba\(0,0,0,/.test(v)) return v; // shadows: theme-neutral
    const tok = DEFAULT[v.toLowerCase()];
    if (!tok) throw new Error(`unmapped literal ${v} in rule ${sel}`);
    return `var(--dd-${tok},${v})`;
  });
  return sel + body;
});

// restore at-rule placeholders AFTER tokenization (rule regex never matches them)
light = light.replace(/\u0001(\d+)\u0001/g, (_, i) => slots[+i]);
light = light.replace(/\u0000A(\d+)\u0000/g, (_, i) => atBlocks[+i]);

// ---------- post-tokenization invariants ----------

// drop the old stray mitigation (color-scheme now lives only in the dark rule)
light = light.replace(/color-scheme:light;?/, '');

// ---------- assert: no naked color literal survives (black shadows exempt) ----------
const stripped = light
  .replace(/var\(--dd-[a-z0-9-]+,(?:[^()]|\([^()]*\))*\)/g, '')
  .replace(/rgba\(0,0,0,[^)]*\)/g, '');
const bad = stripped.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g);
if (bad) throw new Error('naked literals remain: ' + [...new Set(bad)].join(' '));

// ---------- new dark block ----------
const hex2rgb = (h) => [0, 2, 4].map((i) => parseInt(h.slice(1 + i, 3 + i), 16));
const rgb2hex = (r) => '#' + r.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
function lerpHex(a, b, t) {
  const x = hex2rgb(a), y = hex2rgb(b);
  return rgb2hex(x.map((v, i) => v + (y[i] - v) * t));
}
function ramp(a, b, n) { return Array.from({ length: n }, (_, i) => lerpHex(a, b, i / (n - 1))); }

const Ramps = {
  // heat: tokens (grays), cost (mint), dur (blue) — 7 steps each (array idx 1..7)
  ...Object.fromEntries(ramp('#262a31', '#87909c', 7).map((v, i) => [`--dd-htk-${i + 1}`, v])),
  ...Object.fromEntries(ramp('#123c2d', '#22c55e', 7).map((v, i) => [`--dd-hc-${i + 1}`, v])),
  ...Object.fromEntries(ramp('#1e3a5f', '#bfdbfe', 7).map((v, i) => [`--dd-hd-${i + 1}`, v])),
  // calendar: level 0 = empty surface, then mint ramp (idx 1..7)
  '--dd-cal-0': '#181a20',
  ...Object.fromEntries(ramp('#123524', '#8debb0', 7).map((v, i) => [`--dd-cal-${i + 1}`, v])),
};

const PAL = {
  '--dd-bg': '#14161a', '--dd-surface': '#1d2025', '--dd-surface2': '#282c33',
  '--dd-bg-seg': '#2a2f36', '--dd-hover': '#282c33', '--dd-hover2': '#22262c',
  '--dd-sel': '#17251c', '--dd-track': '#31363d', '--dd-border': '#2c3037',
  '--dd-border2': '#3a4150', '--dd-border3': '#282c33', '--dd-border4': '#2c3037',
  '--dd-border5': '#3a4150', '--dd-text': '#e8eaed', '--dd-text2': '#f2f4f7',
  '--dd-text3': '#cdd2d9', '--dd-muted': '#9aa0a8', '--dd-muted2': '#c0c6cd',
  '--dd-faint': '#6f757d', '--dd-inv': '#f2f4f7', '--dd-invh': '#e4e4e7',
  '--dd-oninv': '#14161a', '--dd-tipbg': '#2a2f36', '--dd-green': '#34d399',
  '--dd-green3': '#34d399', '--dd-green4': '#34d399', '--dd-blue': '#60a5fa',
  '--dd-blue2': '#93c5fd', '--dd-red': '#f87171', '--dd-red2': '#f87171',
  '--dd-amber': '#f59e0b',
  // JS-side chart furniture (gridlines, volume bars)
  '--dd-grid': '#1b1f24', '--dd-bar-o': '#3a4150',
  '--dd-herobg': 'linear-gradient(135deg,#12271e,#0f2419 60%)',
  '--dd-heroline': '#1f4634',
};
const KEEP = new Set([...Object.keys(PAL), ...Object.keys(Ramps)]);
const vars = { ...Ramps, ...PAL };
for (const [k, v] of oldVars) if (!KEEP.has(k)) vars[k] = v;

const varCss = Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(';');
const darkBlock =
  'body[data-ds-dark-theme] .dd-dash{color-scheme:dark;background:#14161a;color:#e8eaed;' +
  varCss + ';}';

const newLine1 = HEAD + light + darkBlock + TAIL;
fs.writeFileSync(path, newLine1 + '\n' + rest, 'utf8');

console.log('rules tokenized:', ruleCount);
console.log('ctx applied:\n' + applied.join('\n'));
console.log('at-rules preserved:', atBlocks.length);
console.log('dark vars defined:', Object.keys(vars).length);
