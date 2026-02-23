const fs = require('fs');
const content = fs.readFileSync('PLAN_AI_AVANZADA.md', 'utf8');

const regex = /\*\*Archivo:\s*`([^`]+)`[^*]*\*\*\s*```(?:typescript|tsx|ts)\n([\s\S]*?)```/g;
let match;
while ((match = regex.exec(content)) !== null) {
  const file = match[1];
  const code = match[2];
  
  if (file.includes('utils/engine/loop.ts')) continue; // Skip modifications to existing files for now
  if (file.includes('types/notifications.ts')) continue; // Skip modifying notifications for now
  
  const pathParts = file.split('/');
  pathParts.pop(); // remove filename
  let dir = '.';
  for (const part of pathParts) {
    dir += '/' + part;
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(file, code);
  console.log(`Created ${file}`);
}
