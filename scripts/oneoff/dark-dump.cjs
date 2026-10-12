// Dump rules containing ambiguous color literals for dark-mode override planning.
const fs = require('fs');
const raw = fs.readFileSync('src/client.js', 'utf8');
const nl = raw.indexOf('\n');
const line1 = raw.slice(0, nl);
const marker = ';body[data-ds-dark-theme]';
const semi = line1.indexOf(marker);
const lightCSS = line1.slice(1, semi + 1); // strip leading quote, keep trailing ';'

const rules = lightCSS.match(/[^{}]+\{[^{}]*\}/g) || [];
const AMBIG = /#18181b|#fff\b|#e2e3e7|#27272a|#999\b|#ecfdf5|#f6fefb|#d1fae5|#047857|#f0fdf4|#059669|rgba\(0,0,0/;
for (const r of rules) {
  if (AMBIG.test(r)) console.log(r + '\n');
}
console.log('TOTAL RULES:', rules.length);
