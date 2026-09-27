const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function readOfflineResources(root) {
    const context = vm.createContext({ self: { addEventListener() {} } });
    context.importScripts = file => vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
    vm.runInContext(fs.readFileSync(path.join(root, 'sw.js'), 'utf8') + '\nthis.resources = APP_SHELL;', context);
    return Array.from(context.resources);
}
module.exports = { readOfflineResources };
