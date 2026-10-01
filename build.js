/* Build: inlines validator.js into content.js (content.source.js is the pristine
 * editable source) and packages extension/ into schema-validator-extension.zip
 * for GitHub Releases. No npm dependencies; zip via python3 stdlib. */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = __dirname;
const extDir = path.join(root, 'extension');
const validator = fs.readFileSync(path.join(extDir, 'validator.js'), 'utf8');
const MARKER = '/* __VALIDATOR_SOURCE__ */';

const pristinePath = path.join(extDir, 'content.source.js');
if (!fs.existsSync(pristinePath)) {
  fs.writeFileSync(pristinePath, fs.readFileSync(path.join(extDir, 'content.js')));
}
let content = fs.readFileSync(pristinePath, 'utf8');
if (!content.includes(MARKER)) throw new Error('placeholder missing in content.source.js');
content = content.replace(MARKER, () => validator);
fs.writeFileSync(path.join(extDir, 'content.js'), content);
console.log('inlined validator.js -> content.js (' + validator.length + ' bytes)');

// package (exclude the .source.js dev file)
execSync(`python3 - << 'PY'
import os, zipfile
src = r"${extDir}"
out = r"${path.join(root, 'schema-validator-extension.zip')}"
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for dirpath, dirs, files in os.walk(src):
        for f in sorted(files):
            if f == 'content.source.js':
                continue
            full = os.path.join(dirpath, f)
            z.write(full, os.path.relpath(full, src))
print("wrote", out)
for n in zipfile.ZipFile(out).namelist(): print(" ", n)
PY`, { stdio: 'inherit' });
