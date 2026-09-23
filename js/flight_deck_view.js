(function (root, factory) {
    const exported = factory();
    if (typeof module === 'object' && module.exports) module.exports = exported;
    if (root) root.FlightDeckView = exported;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    function create(documentRef) {
        const byId = id => documentRef.getElementById(id);
        return Object.freeze({
            showScreen(name) {
                const screens = {
                    main: byId('main-menu'),
                    missions: byId('mission-select-menu'),
                    deck: byId('game-interface')
                };
                Object.entries(screens).forEach(([key, element]) => {
                    if (element) element.style.display = key === name ? 'flex' : 'none';
                });
            },
            setText(id, text) {
                const element = byId(id);
                if (element) element.textContent = text;
            },
            setVisible(id, visible, displayValue = 'flex') {
                const element = byId(id);
                if (element) element.style.display = visible ? displayValue : 'none';
            }
        });
    }

    return Object.freeze({ create });
});
