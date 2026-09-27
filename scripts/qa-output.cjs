const fs = require('node:fs');
const path = require('node:path');

// A fresh directory per invocation keeps historic audit runs and shipped images immutable.
function createRun(name, parent = path.resolve(__dirname, '../test-results')) {
    if (!/^[a-z0-9-]+$/.test(name)) throw new Error('Invalid QA run name');
    fs.mkdirSync(parent, { recursive: true });
    const directory = fs.mkdtempSync(path.join(parent, `${name}-`));
    console.log(`QA output: ${directory}`);
    return Object.freeze({ directory, file(name) {
        if (path.basename(name) !== name || name === '.' || name === '..') throw new Error('QA filenames must be basenames');
        return path.join(directory, name);
    }});
}
module.exports = { createRun };
