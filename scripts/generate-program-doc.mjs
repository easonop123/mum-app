import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderProgramMarkdown } from './program-doc.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const program = JSON.parse(readFileSync(join(root, 'src/content/program.json'), 'utf8'));
const catalogue = JSON.parse(readFileSync(join(root, 'src/content/exercise-catalogue.json'), 'utf8'));
mkdirSync(join(root, 'docs'), { recursive: true });
writeFileSync(join(root, 'docs/PROGRAM.md'), renderProgramMarkdown(program, catalogue));
console.log('wrote docs/PROGRAM.md');
