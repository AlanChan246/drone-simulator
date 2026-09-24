/* Loaded before styles and rendering dependencies to avoid a light first paint. */
(function () {
    'use strict';
    const key = 'drone-simulator-theme';
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const valid = value => ['system', 'light', 'dark'].includes(value);
    let preference = 'system';
    let workspace;
    const themes = {};
    try {
        const saved = localStorage.getItem(key);
        if (valid(saved)) preference = saved;
    } catch (_) { /* Storage may be disabled; keep the in-memory preference. */ }

    function blocklyTheme() {
        const name = root.dataset.theme;
        if (!themes[name]) {
            const css = getComputedStyle(root);
            const color = token => css.getPropertyValue('--v2-' + token).trim();
            themes[name] = Blockly.Theme.defineTheme('rescue_' + name, {
                base: Blockly.Themes.Classic,
                blockStyles: {
                    colour_blocks:{colourPrimary:'#96630c'}, list_blocks:{colourPrimary:'#75518e'},
                    logic_blocks:{colourPrimary:'#356b8b'}, loop_blocks:{colourPrimary:'#3c7045'},
                    math_blocks:{colourPrimary:'#46689e'}, procedure_blocks:{colourPrimary:'#86528d'},
                    text_blocks:{colourPrimary:'#21776c'}, variable_blocks:{colourPrimary:'#915278'},
                    variable_dynamic_blocks:{colourPrimary:'#915278'}
                },
                componentStyles: {
                    workspaceBackgroundColour: color('surface'),
                    toolboxBackgroundColour: color('toolbox'), toolboxForegroundColour: color('text'),
                    flyoutBackgroundColour: color('toolbox'), flyoutForegroundColour: color('text'),
                    flyoutOpacity: 1, scrollbarColour: color('text-muted')
                }
            });
        }
        return themes[name];
    }
    function syncControls() {
        document.querySelectorAll('[data-theme-toggle]').forEach(button => {
            const label = root.dataset.theme === 'dark' ? '切換至淺色模式' : '切換至深色模式';
            button.setAttribute('aria-label', label);
            button.title = label;
        });
    }
    function apply() {
        const theme = preference === 'system' ? (media.matches ? 'dark' : 'light') : preference;
        const changed = root.dataset.theme !== theme;
        root.dataset.theme = theme;
        root.style.colorScheme = theme;
        if (changed && workspace) workspace.setTheme(blocklyTheme());
        syncControls();
    }
    function setPreference(value) {
        if (!valid(value)) return;
        preference = value;
        try { localStorage.setItem(key, value); } catch (_) { /* Session-only choice. */ }
        apply();
    }
    window.DroneTheme = {
        setPreference, blocklyTheme,
        attachWorkspace(value) { workspace = value; workspace.setTheme(blocklyTheme()); }
    };
    media.addEventListener('change', () => { if (preference === 'system') apply(); });
    window.addEventListener('storage', event => {
        if (event.key === key || event.key === null) {
            preference = valid(event.newValue) ? event.newValue : 'system';
            apply();
        }
    });
    document.addEventListener('DOMContentLoaded', () => {
        syncControls();
        document.querySelectorAll('[data-theme-toggle]').forEach(button => {
            button.addEventListener('click', () => setPreference(root.dataset.theme === 'dark' ? 'light' : 'dark'));
        });
    });
    apply();
})();
