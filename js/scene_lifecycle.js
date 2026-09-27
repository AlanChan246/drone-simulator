(function (root, factory) {
    const exported = factory();
    if (typeof module === 'object' && module.exports) module.exports = exported;
    if (root) root.SceneLifecycle = exported;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    // Each adapter owns its preload/build/dispose requirements. The registry owns
    // ordering, failed-build cleanup and invalidation of pending async entries.
    function createRegistry(adapters, { beforeEnter = () => {}, clear = () => {}, afterEnter = () => {} } = {}) {
        let active = null, revision = 0;
        function get(type) {
            if (!Object.prototype.hasOwnProperty.call(adapters, type)) throw new Error(`Unknown scene adapter: ${type}`);
            return adapters[type];
        }
        function commit(type) {
            const next = get(type);
            const previous = active;
            active = null;
            if (previous) get(previous).dispose?.();
            beforeEnter(type);
            clear(type);
            try {
                next.prepare?.();
                next.build();
                active = type;
                afterEnter(type);
            } catch (error) {
                active = null;
                try { next.dispose?.(); } finally { clear(type); }
                throw error;
            }
            return true;
        }
        return Object.freeze({
            get,
            names: Object.freeze(Object.keys(adapters)),
            forMission(id) {
                const numeric = id === 'training' ? 1 : Number(id);
                return Object.keys(adapters).find(type => adapters[type].missionId === numeric) || 'free';
            },
            async enter(type) {
                const next = get(type), ticket = ++revision;
                await next.preload?.();
                if (ticket !== revision) return false;
                return commit(type);
            },
            enterSync(type) { get(type); revision++; return commit(type); },
            cancelPending() { revision++; },
            get active() { return active; }
        });
    }
    return Object.freeze({ createRegistry });
});
