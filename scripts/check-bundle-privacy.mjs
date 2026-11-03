// Fails the build if personal details, seeded health answers or history would
// be publicly served from dist/. Generic exercise content and the supplied
// program (including its ID) are allowed.
//
// This repository is public, so the person's actual details are NOT written
// here. To scan for them too, list one regular expression per line in
//   .privacy-denylist.local          (git-ignored, for local builds), and/or
//   the PRIVACY_DENYLIST env variable (e.g. a GitHub Actions secret).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

const GENERIC = [
  { name: 'family relationship wording', re: /\bmother\b|\bher son\b|母亲|妈妈|儿子/i },
  { name: '"mum" outside the supplied program ID', re: /\bmum\b(?!-home-foundation-v2)/i },
  { name: 'seeded readiness answers', re: /"(emergencySigns|urgentSigns|currentBackPain|spreadingNumbWeak|canStandWithSupport)"\s*:\s*"(yes|no|unsure)"/ },
  { name: 'seeded session history', re: /"creditEarned"\s*:\s*true/ },
  { name: 'test fixture', re: /CLEAR_ANSWERS|approvedAdvice\(/ },
  { name: 'source map', re: /sourceMappingURL=/ },
];

function privatePatterns() {
  const lines = [];
  const file = join(root, '.privacy-denylist.local');
  if (existsSync(file)) lines.push(...readFileSync(file, 'utf8').split('\n'));
  if (process.env.PRIVACY_DENYLIST) lines.push(...process.env.PRIVACY_DENYLIST.split('\n'));
  return lines
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l, i) => ({ name: `private pattern #${i + 1}`, re: new RegExp(l, 'i') }));
}

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

let files;
try {
  files = walk(dist).filter((f) => /\.(js|css|html|json|webmanifest|txt|map)$/.test(f));
} catch {
  console.error('check-bundle-privacy: dist/ not found — run vite build first');
  process.exit(1);
}

const privateRules = privatePatterns();
const rules = [...GENERIC, ...privateRules];
const problems = [];
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  for (const rule of rules) {
    const m = rule.re.exec(text);
    // Private matches are reported without echoing the matched text.
    if (m) problems.push(`${file.replace(dist, 'dist')}: ${rule.name}${rule.name.startsWith('private') ? '' : ` → "${text.slice(Math.max(0, m.index - 30), m.index + 40).replace(/\s+/g, ' ')}"`}`);
  }
}

if (problems.length) {
  console.error('Privacy check FAILED — personal data must not ship in the bundle:');
  for (const p of problems) console.error(' - ' + p);
  process.exit(1);
}
console.log(
  `Privacy check passed: ${files.length} built files scanned (${GENERIC.length} generic rules, ${privateRules.length} private rules${privateRules.length ? '' : ' — none configured'}).`,
);
