(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.BlocklyWorkspaceIO = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    // Validate against the installed block definitions before touching a student's work.
    function replace(Blockly, workspace, xmlText) {
        const dom = Blockly.utils.xml.textToDom(xmlText);
        if (dom.nodeName.toLowerCase() !== 'xml') throw new Error('Expected Blockly XML');
        const staging = new Blockly.Workspace();
        try { Blockly.Xml.domToWorkspace(dom.cloneNode(true), staging); }
        finally { staging.dispose(); }
        const previous = Blockly.Xml.workspaceToDom(workspace);
        try {
            workspace.clear();
            Blockly.Xml.domToWorkspace(dom, workspace);
        } catch (error) {
            workspace.clear();
            Blockly.Xml.domToWorkspace(previous, workspace);
            throw error;
        }
    }
    return Object.freeze({ replace });
});
