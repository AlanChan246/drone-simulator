// Exercise the existing Pages packaging recipe without deploying or contacting GitHub.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const workflow = fs.readFileSync(path.join(root, '.github/workflows/deploy-pages.yml'), 'utf8').replace(/\r/g, '');
const recipe = workflow.match(/- name: Prepare static site\n\s+run: \|\n([\s\S]*?)\n\s+- name:/)?.[1];
if (!recipe) throw new Error('Pages packaging recipe was not found');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'drone-v2-pages-'));
try {
    const output = path.join(temp, 'site');
    const command = recipe.split('\n').map(line => line.trim()).join('\n').replaceAll('_site', "'" + output.replaceAll("'", "'\\''") + "'");
    const result = spawnSync('sh', ['-eu', '-c', command], { cwd: root, encoding: 'utf8' });
    if (result.status !== 0) throw new Error(result.stderr || 'Packaging failed');
    const sw = fs.readFileSync(path.join(output, 'sw.js'), 'utf8');
    const shell = JSON.parse(sw.match(/const APP_SHELL = (\[[\s\S]*?\]);/)[1]);
    const missing = shell.filter(file => !fs.existsSync(path.join(output, file)));
    if (missing.length) throw new Error(`Missing offline resources: ${missing.join(', ')}`);
    if (!fs.existsSync(path.join(output, '.nojekyll'))) throw new Error('Missing .nojekyll');
    console.log(`Pages package verified: ${shell.length} offline entries, including Blockly media and 3D loaders. No deployment performed.`);
} finally { fs.rmSync(temp, { recursive: true, force: true }); }
