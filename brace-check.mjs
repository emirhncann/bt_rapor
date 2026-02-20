import { readFileSync, writeFileSync } from 'fs';
const code = readFileSync('app/yemek-karti-satis/page.tsx', 'utf8');
const lines = code.split('\n');
let d = 0;
const out = [];
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  let inStr = false, ch = '';
  for (let j = 0; j < l.length; j++) {
    const c = l[j];
    if (inStr) { if (c === ch && l[j-1] !== '\\') inStr = false; continue; }
    if (c === "'" || c === '"' || c === '`') { inStr = true; ch = c; continue; }
    if (c === '/' && l[j+1] === '/') break;
    if (c === '{') d++;
    if (c === '}') d--;
  }
  if (d < 0) { out.push(`NEG line ${i+1}: d=${d}`); break; }
  if (i+1 >= 40 && i+1 <= 50) out.push(`${i+1}: d=${d}`);
  if (i+1 >= 1100 && i+1 <= 1160) out.push(`${i+1}: d=${d}`);
}
out.push(`END d=${d} total=${lines.length}`);
writeFileSync('brace-result.txt', out.join('\n'));
