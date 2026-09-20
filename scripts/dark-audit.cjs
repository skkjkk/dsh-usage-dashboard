// Audit every body.replace(pattern, "replacement") in dark-js.cjs for paren balance.
const fs = require('fs');
const c = fs.readFileSync('scripts/dark-js.cjs', 'utf8');
const lines = c.split('\n');
let bad = 0;
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  if (!/body\.replace\(/.test(l)) continue;
  // find continuation: pattern on this line, replacement on this or next line(s) until ");"
  let chunk = l;
  let j = i;
  while (!/\"\);?\s*$/.test(chunk) && j + 1 < lines.length) chunk += '\n' + lines[++j];
  // extract regex literal
  const pm = chunk.match(/replace\((\/.*?\/[a-z]*),/);
  if (!pm) continue;
  // extract double-quoted replacement (raw string in source)
  const rm = chunk.match(/,\s*\r?\n?\s*"((?:[^"\\]|\\.)*)"\)/);
  if (!rm) continue;
  const pat = pm[1], rep = rm[1];
  // count LITERAL parens in pattern: \( and \) are literals
  const pLit = (pat.match(/\\\(/g) || []).length + (pat.match(/\\\)/g) || []).length;
  const pTot = (pat.match(/\(/g) || []).length + (pat.match(/\)/g) || []).length;
  // unescaped grouping parens in pattern
  const pGroup = ((pat.match(/(^|[^\\])\(/g) || []).length) + ((pat.match(/(^|[^\\])\)/g) || []).length) - pLit * 0;
  const rOpen = (rep.match(/\(/g) || []).length;
  const rClose = (rep.match(/\)/g) || []).length;
  // LITERAL parens in replacement that should equal pattern's literal parens
  if (rOpen !== rClose) { console.log(`L${i + 1} REPL unbalanced (o${rOpen} c${rClose}): ${rep.slice(0, 100)}`); bad++; }
}
console.log('unbalanced replacements:', bad);
