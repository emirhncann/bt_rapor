const fs = require('fs');
const code = fs.readFileSync('app/yemek-karti-satis/page.tsx', 'utf8');
const lines = code.split('\n');
let depth = 0;
const out = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  let inStr = 0; // 0=none, 1=single, 2=double, 3=backtick
  let prevDepth = depth;
  
  for (let j = 0; j < line.length; j++) {
    const c = line[j];
    const p = j > 0 ? line[j-1] : '';
    
    if (inStr === 1) { if (c === "'" && p !== '\\') inStr = 0; continue; }
    if (inStr === 2) { if (c === '"' && p !== '\\') inStr = 0; continue; }
    if (inStr === 3) { 
      if (c === '`' && p !== '\\') inStr = 0;
      continue; 
    }
    
    if (c === '/' && j + 1 < line.length && line[j+1] === '/') break;
    if (c === "'") { inStr = 1; continue; }
    if (c === '"') { inStr = 2; continue; }
    if (c === '`') { inStr = 3; continue; }
    
    if (c === '{') depth++;
    if (c === '}') depth--;
  }
  
  if (depth !== prevDepth) {
    const delta = depth - prevDepth;
    if (i + 1 >= 1100 && i + 1 <= 1160) {
      out.push('>>> ' + (i+1) + ': delta=' + (delta > 0 ? '+' : '') + delta + ' depth=' + depth + ' | ' + line.trim().substring(0, 100));
    }
  }
  
  if (depth < 0) {
    out.push('NEGATIVE at line ' + (i+1) + ': depth=' + depth);
    break;
  }
}

out.push('FINAL: depth=' + depth + ' lines=' + lines.length);

try {
  fs.writeFileSync('c:/next.js_apps/btRapor/brace-analysis.txt', out.join('\n'), 'utf8');
} catch(e) {
  // fallback
  try {
    fs.writeFileSync('./brace-analysis.txt', out.join('\n'), 'utf8');
  } catch(e2) {}
}
