(function (root, factory) {
    const exported = factory();
    if (typeof module === 'object' && module.exports) module.exports = exported;
    if (root) root.SceneLifecycle = exported;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    async function enter(sceneType, collaborators) {
        const {
            ensureRenderer, beforeEnter, loadScene, afterEnter
        } = collaborators;
        await ensureRenderer();
        if (beforeEnter) await beforeEnter(sceneType);
        await loadScene(sceneType);
        if (afterEnter) await afterEnter(sceneType);
        return sceneType;
    }

    function enterSync(sceneType, collaborators) {
        const { beforeEnter, loadScene, afterEnter } = collaborators;
        if (beforeEnter) beforeEnter(sceneType);
        loadScene(sceneType);
        if (afterEnter) afterEnter(sceneType);
        return sceneType;
    }

    function createRegistry(sceneAdapters) {
        return Object.freeze({
            get(sceneType) {
                const adapter = sceneAdapters[sceneType];
                if (!adapter) throw new Error(`Unknown scene adapter: ${sceneType}`);
                return adapter;
            },
            names: Object.freeze(Object.keys(sceneAdapters))
        });
    }

    return Object.freeze({ enter, enterSync, createRegistry });
});
