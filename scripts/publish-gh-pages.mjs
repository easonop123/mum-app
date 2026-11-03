// Publishes the already-built dist/ to the `gh-pages` branch of `origin`
// (GitHub Pages: Settings → Pages → Deploy from a branch → gh-pages / root).
// Run via `npm run deploy`, which builds and privacy-scans first.
// The gh-pages branch holds only build output, so it is replaced each time.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
if (!existsSync(join(dist, 'index.html'))) {
  console.error('publish-gh-pages: dist/index.html not found — run `npm run build` first.');
  process.exit(1);
}

const remote = process.env.DEPLOY_REMOTE ?? execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: root }).toString().trim();
const sourceRev = (() => {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root }).toString().trim();
  } catch {
    return 'local';
  }
})();

const dir = mkdtempSync(join(tmpdir(), 'gh-pages-'));
try {
  cpSync(dist, dir, { recursive: true });
  writeFileSync(join(dir, '.nojekyll'), ''); // serve files as-is (no Jekyll processing)
  const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'inherit' });
  git('init', '-q', '-b', 'gh-pages');
  git('add', '-A');
  const extra = process.env.DEPLOY_MESSAGE_EXTRA ? `\n\n${process.env.DEPLOY_MESSAGE_EXTRA}` : '';
  git('commit', '-q', '-m', `Deploy build of ${sourceRev}${extra}`);
  git('push', '--force', remote, 'gh-pages');
  console.log('Published dist/ to gh-pages.');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
