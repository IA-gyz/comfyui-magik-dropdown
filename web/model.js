export const VERSION = 2;
export function normalize(data) {
    if (typeof data === 'string') {
        try { const parsed = JSON.parse(data); if (parsed && typeof parsed === 'object') data = parsed; } catch {}
        if (typeof data === 'string') {
            return [...new Set(data.split(/\r?\n/).map(v => v.trim()).filter(Boolean))]
                .map((v, i) => ({id: `legacy-${i}`, label: v, value: v}));
        }
    }
    if (Array.isArray(data)) data = {version: VERSION, items: data.map((v, i) => typeof v === 'string' ? {id: `import-${i}`, label: v, value: v} : v)};
    if (data?.version !== VERSION || !Array.isArray(data.items)) throw Error('Unsupported entry format or version.');
    const ids = new Set();
    return data.items.map(item => {
        if (!item || ['id', 'label', 'value'].some(k => typeof item[k] !== 'string') || !item.id || !item.label.trim() || ids.has(item.id)) throw Error('Entries require unique IDs, nonempty labels and string values.');
        ids.add(item.id);
        return {id: item.id, label: item.label, value: item.value};
    });
}
export function encode(items) { return JSON.stringify({version: VERSION, items: normalize({version: VERSION, items})}); }
export class DropdownController {
    constructor(node, selected, entries, mode) {
        Object.assign(this, {node, selected, entries, mode, undoStack: [], redoStack: [], query: ''});
    }
    get items() { return normalize(this.entries.value); }
    get settings() { return this.node.properties.magikDropdown ??= {version: VERSION, compact: false, loop: true}; }
    sync() {
        const items = this.items;
        if (!items.some(i => i.id === this.selected.value)) this.selected.value = (items.find(i => i.value === this.selected.value) ?? items[0])?.id ?? '';
        return items;
    }
    snapshot() { return JSON.stringify({entries: this.entries.value, selected: this.selected.value, mode: this.mode.value, settings: this.settings}); }
    restore(snapshot) {
        const data = JSON.parse(snapshot);
        this.entries.value = data.entries; this.selected.value = data.selected; this.mode.value = data.mode;
        this.node.properties.magikDropdown = data.settings; this.sync();
    }
    change(action, history = true) {
        const before = this.snapshot();
        this.node.graph?.beforeChange?.();
        try {
            action(); this.sync();
            if (history && before !== this.snapshot()) { this.undoStack.push(before); if (this.undoStack.length > 100) this.undoStack.shift(); this.redoStack = []; }
        } catch (error) { this.restore(before); throw error; }
        finally { this.node.graph?.afterChange?.(); }
        this.render?.(); this.node.setDirtyCanvas(true, true);
    }
    undo() { if (this.undoStack.length) { const target = this.undoStack.pop(); this.redoStack.push(this.snapshot()); this.change(() => this.restore(target), false); } }
    redo() { if (this.redoStack.length) { const target = this.redoStack.pop(); this.undoStack.push(this.snapshot()); this.change(() => this.restore(target), false); } }
    write(items, selected = this.selected.value) { const text = encode(items); this.change(() => {this.entries.value = text; this.selected.value = selected;}); }
    choose(id) { this.change(() => {this.selected.value = id;}); }
    step(delta) {
        const items = this.sync(); if (!items.length) return;
        let i = items.findIndex(v => v.id === this.selected.value) + delta;
        i = this.settings.loop ? (i + items.length) % items.length : Math.max(0, Math.min(items.length - 1, i));
        this.choose(items[i].id);
    }
    random() { const items = this.items; if (items.length) { const n = new Uint32Array(1); crypto.getRandomValues(n); this.choose(items[Math.floor((n[0] / 4294967296) * items.length)].id); } }
    add() { const items = this.items; items.push({id: crypto.randomUUID(), label: `Entry ${items.length + 1}`, value: ''}); this.write(items); }
    edit(id, patch) { this.write(this.items.map(item => item.id === id ? {...item, ...patch} : item)); }
    remove(id) { this.write(this.items.filter(item => item.id !== id)); }
    move(id, delta) { const items = this.items, i = items.findIndex(v => v.id === id), j = i + delta; if (i < 0 || j < 0 || j >= items.length) return; [items[i], items[j]] = [items[j], items[i]]; this.write(items); }
    import(text) { this.write(normalize(text)); }
    export() { return JSON.stringify({version: VERSION, items: this.items}, null, 2); }
    matches() { const q = this.query.toLowerCase(); return this.items.filter(i => `${i.label}\n${i.value}`.toLowerCase().includes(q)); }
}
export class PresetStore {
    constructor(storage) { this.storage = storage; this.key = 'Magik.Dropdown.presets.v2'; }
    read() {
        const text = this.storage.getItem(this.key); if (!text) return {};
        const data = JSON.parse(text);
        if (data.version !== VERSION || !data.presets || typeof data.presets !== 'object' || Array.isArray(data.presets)) throw Error('Invalid preset storage. Export entries before resetting browser storage.');
        return data.presets;
    }
    save(name, items) { name = name.trim(); if (!name) throw Error('Enter a preset name.'); const presets = this.read(); Object.defineProperty(presets, name, {value: normalize({version: VERSION, items}), enumerable: true, writable: true, configurable: true}); this.storage.setItem(this.key, JSON.stringify({version: VERSION, presets})); }
    remove(name) { const presets = this.read(); delete presets[name]; this.storage.setItem(this.key, JSON.stringify({version: VERSION, presets})); }
}
