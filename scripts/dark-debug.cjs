// Show HEAD originals for the 3 suspicious replacements.
const fs = require('fs');
const head = fs.readFileSync(process.env.TEMP + '/dd_head_client.js', 'utf8').split('\n');
head.forEach((l, i) => {
  if (l.includes("fill: '#f0f0f2' }") && l.includes('rect')) console.log('f0f0f2 L' + (i + 1) + ':', JSON.stringify(l.trim().slice(0, 170)));
  if (l.includes("fill: '#e4e4e7'") && l.includes('rect')) console.log('e4e4e7 L' + (i + 1) + ':', JSON.stringify(l.trim().slice(0, 170)));
  if (l.includes('opacity: 0.85') && l.includes("fill: '#10b981'")) console.log('10b981-85 L' + (i + 1) + ':', JSON.stringify(l.trim().slice(0, 170)));
  if (l.includes("fill: '#10b981' }") && !l.includes('opacity')) console.log('10b981 L' + (i + 1) + ':', JSON.stringify(l.trim().slice(0, 170)));
});
