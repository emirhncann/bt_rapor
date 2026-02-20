const fs = require('fs');
const code = fs.readFileSync('app/yemek-karti-satis/page.tsx', 'utf8');
const lines = code.split('\n');
let depth = 0;
const output = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  // Skip string contents and comments roughly
  let inString = false;
  let stringChar = '';
  for (let j = 0; j < line.length; j++) {
    const c = line[j];
    if (inString) {
      if (c === stringChar && line[j-1] !== '\\') inString = false;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      inString = true;
      stringChar = c;
      continue;
    }
    if (c === '/' && line[j+1] === '/') break; // line comment
    if (c === '{') depth++;
    if (c === '}') depth--;
  }
  if (depth < 0) {
    output.push('NEGATIVE at line ' + (i+1) + ': depth=' + depth);
    break;
  }
  if ((i+1) >= 1100 && (i+1) <= 1160) {
    output.push('Line ' + (i+1) + ': depth=' + depth);
  }
}
output.push('Final depth: ' + depth + ' at line ' + lines.length);
fs.writeFileSync('brace-check-result.txt', output.join('\n'));
