const fs = require('fs');
const code = fs.readFileSync('app/yemek-karti-satis/page.tsx', 'utf8');
const lines = code.split('\n');
let depth = 0;
const results = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inBacktick = false;
  let inLineComment = false;
  let opens = 0;
  let closes = 0;
  for (let j = 0; j < line.length; j++) {
    const c = line[j];
    const prev = j > 0 ? line[j-1] : '';
    if (inLineComment) break;
    if (inSingleQuote) { if (c === "'" && prev !== '\\') inSingleQuote = false; continue; }
    if (inDoubleQuote) { if (c === '"' && prev !== '\\') inDoubleQuote = false; continue; }
    if (inBacktick) { 
      if (c === '`' && prev !== '\\') inBacktick = false;
      if (c === '$' && line[j+1] === '{') { j++; opens++; depth++; }
      continue;
    }
    if (c === '/' && line[j+1] === '/') { inLineComment = true; continue; }
    if (c === "'") { inSingleQuote = true; continue; }
    if (c === '"') { inDoubleQuote = true; continue; }
    if (c === '`') { inBacktick = true; continue; }
    if (c === '{') { opens++; depth++; }
    if (c === '}') { closes++; depth--; }
  }
  if (opens !== closes) {
    results.push((i+1) + ': o=' + opens + ' c=' + closes + ' d=' + depth + ' | ' + line.trim().substring(0, 80));
  }
}
results.push('FINAL depth=' + depth);
process.stdout.write(results.join('\n') + '\n');
