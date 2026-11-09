const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1000,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://dropdown.test/**',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname==='/scripts/app.js')return route.fulfill({contentType:'text/javascript',body:'export const app={registerExtension(e){window.extension=e;}};'});
  if(url.pathname.startsWith('/web/'))return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(__dirname,'..',url.pathname),'utf8')});
  return route.fulfill({contentType:'text/html',body:`<html><body style="background:#151515"><div id="host" style="width:520px;height:680px"></div><script type="module">
import '/web/magik_dropdown.js';
class Node {
 constructor(){this.properties={};this.widgets=[{name:'selected',value:'Entry 1'},{name:'entries',value:'Entry 1\\nEntry 2'},{name:'selection_mode',value:'manual'}];this.size=[500,530];this.graph={beforeChange(){},afterChange(){}};}
 setDirtyCanvas(){} setSize(size){this.size=size;}
 addDOMWidget(name,type,element,options){this.widgets.push({name,type,options,element});document.querySelector('#host').replaceChildren(element);}
 onConfigure(data){data.widgets_values.forEach((v,i)=>this.widgets[i].value=v);this.properties=data.properties||{};}
}
await window.extension.beforeRegisterNodeDef(Node,{name:'MagikDropdown'});window.Node=Node;window.node=new Node();node.onNodeCreated();window.ready=true;
</script></body></html>`});
 });
 await page.goto('http://dropdown.test/');await page.waitForFunction(()=>window.ready);
 await page.getByRole('button',{name:'Add an entry',exact:true}).click();
 assert.equal(await page.getByPlaceholder('Display label').count(),3);
 await page.getByPlaceholder('Display label').nth(2).fill('Portrait');
 await page.getByPlaceholder('Display label').nth(2).press('Tab');
 await page.getByRole('textbox',{name:'Output value for Portrait',exact:true}).fill('A long prompt\nwith {literal|text}');
 await page.getByRole('textbox',{name:'Output value for Portrait',exact:true}).press('Tab');
 const id=await page.evaluate(()=>JSON.parse(node.widgets[1].value).items[2].id);
 await page.getByRole('combobox',{name:'Selected entry',exact:true}).selectOption(id);
 await page.getByRole('button',{name:'Move entry up',exact:true}).nth(2).click();
 assert.equal(await page.getByPlaceholder('Display label').nth(1).inputValue(),'Portrait');
 await page.getByRole('button',{name:'Undo last node edit',exact:true}).click();
 assert.equal(await page.getByPlaceholder('Display label').nth(2).inputValue(),'Portrait');
 await page.getByRole('button',{name:'Redo last node edit',exact:true}).click();
 await page.getByPlaceholder('Search labels or values').fill('Portrait');
 assert.equal(await page.locator('.picker option').count(),1);
 await page.getByPlaceholder('Search labels or values').fill('');
 await page.getByPlaceholder('Preset name').fill('Test preset');await page.getByRole('button',{name:'Save a named preset',exact:true}).click();
 await page.getByRole('button',{name:'Remove entry',exact:true}).nth(1).click();
 await page.getByRole('button',{name:'Load selected preset',exact:true}).click();
 assert.equal(await page.getByPlaceholder('Display label').count(),3);
 await page.getByRole('combobox',{name:'Selection mode',exact:true}).selectOption('random');
 assert.equal(await page.evaluate(()=>node.widgets[2].value),'random');
 await page.evaluate(()=>node.onExecuted({selected_id:[JSON.parse(node.widgets[1].value).items[1].id],selected_index:[1],selected_label:['Portrait']}));
 assert.match(await page.locator('.status').first().textContent(),/Last executed: Portrait/);
 const saved=await page.evaluate(()=>({widgets_values:node.widgets.slice(0,3).map(w=>w.value),properties:JSON.parse(JSON.stringify(node.properties))}));
 await page.evaluate(data=>{node.onRemoved();window.node=new Node();node.onNodeCreated();node.onConfigure(data);},saved);
 assert.equal(await page.getByPlaceholder('Display label').nth(1).inputValue(),'Portrait');
 assert.equal(await page.getByRole('combobox',{name:'Selected entry',exact:true}).inputValue(),saved.widgets_values[0]);
 await page.getByRole('button',{name:'Toggle entry editor',exact:true}).click();assert.equal(await page.locator('.editor').isVisible(),false);
 await page.getByRole('button',{name:'Toggle entry editor',exact:true}).click();assert.equal(await page.locator('.editor').isVisible(),true);
 // Previous releases stored only two widget values.
 await page.evaluate(()=>node.onConfigure({widgets_values:['Entry 2','Entry 1\nEntry 2']}));
 assert.equal(await page.getByRole('combobox',{name:'Selected entry',exact:true}).inputValue(),'legacy-1');
 assert.deepEqual(errors,[]);
 console.log('Browser UI checks passed: editing, selection, reorder, undo/redo, search, presets, execution messages, reload, compact mode, legacy migration.');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
