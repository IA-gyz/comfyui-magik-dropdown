import { app } from '../../scripts/app.js';
import { DropdownController, PresetStore } from './model.js';

function hide(widget) {
    widget.type = 'converted-widget'; widget.computeSize = () => [0, -4];
    if (widget.inputEl) widget.inputEl.style.display = 'none';
    if (widget.element) widget.element.style.display = 'none';
}
function mount(c) {
    const el = (tag, cls, text) => {const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e;};
    const root = el('div', 'magik-dropdown');
    const style = el('style'); style.textContent = `
.magik-dropdown{box-sizing:border-box;display:flex;flex-direction:column;gap:8px;padding:10px;height:100%;overflow:auto;border-radius:8px;background:var(--comfy-menu-bg,#242424);color:var(--input-text,#eee);font:13px sans-serif}
.magik-dropdown *{box-sizing:border-box}.magik-dropdown .bar{display:flex;gap:5px;align-items:center;flex-wrap:wrap}.magik-dropdown input,.magik-dropdown textarea,.magik-dropdown select,.magik-dropdown button{font:inherit;color:inherit;background:var(--comfy-input-bg,#333);border:1px solid #666;border-radius:5px;padding:6px;min-width:0}.magik-dropdown button{cursor:pointer}.magik-dropdown button:disabled{opacity:.35;cursor:default}.magik-dropdown .grow{flex:1;min-width:100px}.magik-dropdown .picker{width:100%;font-weight:bold}.magik-dropdown .editor{display:flex;flex-direction:column;gap:8px;min-height:0}.magik-dropdown .rows{min-height:90px;max-height:340px;overflow:auto;display:flex;flex-direction:column;gap:7px}.magik-dropdown .entry{padding:6px;border:1px solid #555;border-radius:6px}.magik-dropdown .entry.active{border-color:#69a8eb}.magik-dropdown textarea{width:100%;resize:vertical;min-height:50px;margin-top:5px}.magik-dropdown .status{font-size:12px;opacity:.85;white-space:pre-wrap}.magik-dropdown .error{color:#ff9b90}.magik-dropdown [hidden]{display:none!important}
`;
    root.append(style);
    const error = el('div', 'status error'); error.setAttribute('role', 'alert');
    const run = fn => {try {error.textContent = ''; return fn();} catch(e) {error.textContent = e.message;}};
    const button = (text, title, fn) => {const b = el('button', '', text); b.type = 'button'; b.title = title; b.setAttribute('aria-label', title); b.addEventListener('click', () => run(fn)); return b;};
    const input = (placeholder, value = '') => {const e = el('input', 'grow'); e.placeholder = placeholder; e.value = value; e.setAttribute('aria-label', placeholder); return e;};
    const bar = (...children) => {const b = el('div', 'bar'); b.append(...children); return b;};
    // Keep editing/search keystrokes within the node, without cancelling native controls.
    root.addEventListener('keydown', e => e.stopPropagation());
    root.addEventListener('pointerdown', e => e.stopPropagation());
    const search = input('Search labels or values');
    search.addEventListener('input', () => {c.query = search.value; renderPicker();});
    const toggle = button('Compact', 'Toggle entry editor', () => {
        c.change(() => {
            if (!c.settings.compact) c.settings.expandedHeight = c.node.size[1];
            c.settings.compact = !c.settings.compact;
        });
    });
    root.append(bar(search, toggle));
    const picker = el('select', 'picker'); picker.setAttribute('aria-label', 'Selected entry');
    picker.addEventListener('change', () => run(() => c.choose(picker.value)));
    root.append(picker);
    const prev = button('◀', 'Previous entry', () => c.step(-1));
    const next = button('▶', 'Next entry', () => c.step(1));
    const random = button('Random', 'Select a random entry now', () => c.random());
    const undo = button('Undo', 'Undo last node edit', () => c.undo());
    const redo = button('Redo', 'Redo last node edit', () => c.redo());
    root.append(bar(prev, next, random, undo, redo));
    const status = el('div', 'status'); root.append(status, error);
    const editor = el('div', 'editor'); root.append(editor);
    const mode = el('select'); mode.setAttribute('aria-label', 'Selection mode');
    for (const [v,t] of [['manual','Keep selection'],['random','Random on each execution']]) {const o = el('option','',t); o.value=v; mode.append(o);}
    mode.addEventListener('change', () => run(() => c.change(() => {c.mode.value=mode.value;})));
    const loop = el('input'); loop.type='checkbox';
    loop.addEventListener('change', () => run(() => c.change(() => {c.settings.loop=loop.checked;})));
    const loopLabel=el('label'); loopLabel.append(loop,document.createTextNode(' Loop previous / next'));
    editor.append(bar(mode,loopLabel));
    const rows=el('div','rows'); editor.append(rows);
    editor.append(bar(button('+ Add entry','Add an entry',() => c.add())));
    const presets = new PresetStore({getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value)});
    const presetSelect=el('select','grow'); presetSelect.setAttribute('aria-label','Saved presets');
    const presetName=input('Preset name');
    function refreshPresets() {
        const selected=presetSelect.value; presetSelect.replaceChildren();
        const placeholder=el('option','','Choose a preset'); placeholder.value='';presetSelect.append(placeholder);
        Object.keys(presets.read()).sort().forEach(name=>{const o=el('option','',name);o.value=name;presetSelect.append(o);});
        presetSelect.value=selected;
    }
    editor.append(bar(presetSelect,button('Load','Load selected preset',()=>{const value=presets.read()[presetSelect.value];if(!value)throw Error('Choose a preset.');c.write(value);})),
        bar(presetName,button('Save','Save a named preset',()=>{const name=presetName.value.trim();if(Object.hasOwn(presets.read(),name)&&!confirm(`Replace preset “${name}”?`))return;presets.save(name,c.items);refreshPresets();presetSelect.value=name;}),
        button('Delete','Delete selected preset',()=>{const name=presetSelect.value;if(name&&confirm(`Delete preset “${name}”?`)){presets.remove(name);refreshPresets();}})));
    const bulk=el('details'), summary=el('summary','','Bulk edit / import / export');
    const text=el('textarea');text.setAttribute('aria-label','Bulk entries: JSON or one text value per line');
    const file=el('input'); file.type='file';file.accept='.json,.txt,application/json,text/plain';file.hidden=true;
    file.addEventListener('change',async()=>{const f=file.files[0];if(f){try {const t=await f.text();run(()=>c.import(f.name.toLowerCase().endsWith('.json')?JSON.parse(t):t));}catch(e){error.textContent=e.message;}file.value='';}});
    function download(format) {
        if(format==='txt'&&c.items.some(i=>/[\r\n]/.test(i.value)))throw Error('Multiline values need JSON export to preserve entries.');
        const blob=new Blob([format==='json'?c.export():c.items.map(i=>i.value).join('\n')],{type:format==='json'?'application/json':'text/plain'});
        const url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download=`Magik_Dropdown.${format}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
    bulk.append(summary,text,bar(button('Apply','Replace entries from bulk text',()=>c.import(text.value)),button('Import file','Import JSON or text file',()=>file.click()),button('Export JSON','Export labels and values as JSON',()=>download('json')),button('Export TXT','Export output values only',()=>download('txt'))),file);
    bulk.addEventListener('toggle',()=>{if(bulk.open)text.value=c.export();}); editor.append(bulk);
    function renderPicker() {
        const matches=c.matches(), current=c.items.find(i=>i.id===c.selected.value);
        picker.replaceChildren();
        if(current&&!matches.some(i=>i.id===current.id)){const o=el('option','',`${current.label} (current selection)`);o.value=current.id;picker.append(o);}
        for(const item of matches){const o=el('option','',item.label);o.value=item.id;picker.append(o);}
        if(!picker.options.length){const o=el('option','',c.items.length?'No matches':'No entries');o.value='';picker.append(o);}
        picker.value=c.selected.value; picker.disabled=!c.items.length;
    }
    function renderRows() {
        rows.replaceChildren();
        c.items.forEach((item,index,items)=>{
            const row=el('div',`entry${item.id===c.selected.value?' active':''}`);
            const label=input('Display label',item.label), value=el('textarea');value.value=item.value;value.setAttribute('aria-label',`Output value for ${item.label}`);
            label.addEventListener('change',()=>run(()=>{c.edit(item.id,{label:label.value});value.setAttribute('aria-label',`Output value for ${label.value}`);}));
            value.addEventListener('change',()=>run(()=>c.edit(item.id,{value:value.value})));
            const up=button('↑','Move entry up',()=>c.move(item.id,-1)), down=button('↓','Move entry down',()=>c.move(item.id,1));up.disabled=index===0;down.disabled=index===items.length-1;
            row.append(bar(label,up,down,button('×','Remove entry',()=>c.remove(item.id))),value);rows.append(row);
        });
    }
    let lastCompact;
    c.render=()=>{
        const items=c.sync();renderPicker();
        // A blur commit must not destroy the button that is about to receive a click.
        if(!rows.contains(document.activeElement))renderRows();
        const index=items.findIndex(i=>i.id===c.selected.value);
        status.textContent=`${items.length} entries · Index ${index}${c.mode.value==='random'?' · Random on execution':''}${c.lastExecution?`\nLast executed: ${c.lastExecution}`:''}`;
        const compact=!!c.settings.compact;
        if(lastCompact!==undefined && lastCompact!==compact)c.node.setSize([c.node.size[0],compact?225:(c.settings.expandedHeight||530)]);
        lastCompact=compact;
        editor.hidden=compact;toggle.textContent=c.settings.compact?'Edit entries':'Compact';
        mode.value=c.mode.value;loop.checked=c.settings.loop!==false;undo.disabled=!c.undoStack.length;redo.disabled=!c.redoStack.length;
        prev.disabled=!items.length||(!loop.checked&&index<=0);next.disabled=!items.length||(!loop.checked&&index>=items.length-1);random.disabled=!items.length;
    };
    const storageChanged=()=>run(refreshPresets);
    presetSelect.addEventListener('focus',storageChanged);
    window.addEventListener('storage',storageChanged);
    c.dispose=()=>window.removeEventListener('storage',storageChanged);
    c.safeRender=()=>run(()=>c.render());
    run(refreshPresets);c.safeRender();return root;
}
app.registerExtension({
    name:'Magik.Dropdown',
    async beforeRegisterNodeDef(nodeType,nodeData) {
        if(nodeData.name!=='MagikDropdown')return;
        const created=nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated=function(){
            const result=created?.apply(this,arguments);
            const get=name=>this.widgets.find(w=>w.name===name);
            const selected=get('selected'),entries=get('entries'),mode=get('selection_mode');
            if(!selected||!entries||!mode)return result;
            [selected,entries,mode].forEach(hide);this.properties??={};
            const c=new DropdownController(this,selected,entries,mode);
            const element=mount(c);
            this.addDOMWidget('magik_dropdown_editor','magik_dropdown_editor',element,{serialize:false,getMinHeight:()=>c.settings.compact?140:400});
            const configure=this.onConfigure;
            this.onConfigure=function(){const r=configure?.apply(this,arguments);c.undoStack=[];c.redoStack=[];c.lastExecution='';c.safeRender();return r;};
            const executed=this.onExecuted;
            this.onExecuted=function(message){const r=executed?.apply(this,arguments);const id=message?.selected_id?.[0];if(c.items.some(i=>i.id===id))selected.value=id;c.lastExecution=`${message?.selected_label?.[0]??''} (index ${message?.selected_index?.[0]??-1})`;c.render();return r;};
            const removed=this.onRemoved;this.onRemoved=function(){c.dispose();return removed?.apply(this,arguments);};
            this.size=[Math.max(this.size[0],500),Math.max(this.size[1],530)];return result;
        };
    },
});
