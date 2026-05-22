const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../');
const PAGES = ['index.html', 'about.html', 'contact.html', 'leadership.html', 'services.html', 'partnerships.html'];

let failed = false;

function checkFile(filePath, referencedFrom) {
  const full = path.join(ROOT, filePath);
  if (!fs.existsSync(full)) {
    console.error(`  MISSING: ${filePath} (referenced in ${referencedFrom})`);
    failed = true;
  }
}

function extractLocalRefs(html, filename) {
  const refs = [];
  const patterns = [
    /href="([^"#?]+)"/g,
    /src="([^"http][^"]+)"/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const ref = match[1];
      if (!ref.startsWith('http') && !ref.startsWith('mailto') && !ref.startsWith('//')) {
        refs.push(ref);
      }
    }
  }
  return refs;
}

console.log('Checking pages and local assets...\n');

for (const page of PAGES) {
  const full = path.join(ROOT, page);
  if (!fs.existsSync(full)) {
    console.error(`MISSING PAGE: ${page}`);
    failed = true;
    continue;
  }
  console.log(`OK: ${page}`);
  const html = fs.readFileSync(full, 'utf8');
  const refs = extractLocalRefs(html, page);
  for (const ref of refs) {
    checkFile(ref, page);
  }
}

if (failed) {
  console.error('\nFailed: one or more pages or assets are missing.');
  process.exit(1);
} else {
  console.log('\nAll pages and assets OK.');
}
