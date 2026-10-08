// Browser-level smoke test. Run from the repo root while the local server is up:
// npm install --no-save playwright && node tests/browser-smoke.mjs
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({
  channel:'chrome',
  headless:true,
  args:['--no-sandbox','--disable-dev-shm-usage']
});
const page=await browser.newPage({viewport:{width:1280,height:900}});
const errors=[];
page.on('pageerror',error=>errors.push(error.message));

async function stable(){
  await page.waitForFunction(()=>{
    const board=document.querySelector('.mode-workbench');
    return board&&!board.hasAttribute('inert')&&
      document.querySelectorAll('.mode-transition-snapshot').length===0&&
      !document.querySelector('.main.layout-motion-active');
  },{timeout:5000});
}

async function check(label,action){
  try{
    await action();
    await stable();
    assert.deepEqual(errors,[],label+': browser errors');
    console.log('PASS '+label);
  }catch(error){
    console.error('FAIL '+label+': '+error.message);
    console.error('Browser errors:',JSON.stringify(errors));
    console.error('DOM state:',JSON.stringify(await page.evaluate(()=>({
      expanded:!!document.querySelector('#expandedMode'),
      expandedVisible:!!document.querySelector('#expandedMode')?.checkVisibility(),
      snapshots:document.querySelectorAll('.mode-transition-snapshot').length,
      busy:document.querySelector('.mode-workbench')?.getAttribute('aria-busy'),
      cards:document.querySelectorAll('.saved-mode-card:not(.mode-expanded)').length,
      modeListText:document.querySelector('#modeList')?.innerText.slice(0,160)
    }))));
    throw error;
  }
}

try{
  await page.goto('http://127.0.0.1:8123/',{waitUntil:'networkidle'});
  await page.waitForSelector('.saved-mode-card:not(.mode-expanded)');
  assert.equal(await page.locator('.saved-mode-card:not(.mode-expanded)').count(),3);
  await stable();

  // Touch feedback must not transform the element that Morph measures.
  const current=page.locator('[data-expand-source="current"]');
  const rect=await current.boundingBox();
  await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);
  await page.mouse.down();
  const transform=await current.evaluate(element=>getComputedStyle(element).transform);
  assert.equal(transform,'none','Press feedback changes bounding geometry');
  await page.mouse.up();
  await stable();
  console.log('PASS stable current-card geometry on pointerdown');

  await check('open saved Couchset',async()=>{
    await page.locator('[data-mode-row="1"] .open-mode').click();
    await page.waitForSelector('#expandedMode',{timeout:5000});
  });
  assert.equal(await page.locator('#expandedName').innerText(),'Gaming');
  assert.equal(await page.locator('#expandedMode').isVisible(),true);

  await check('switch expanded Couchset',async()=>{
    await page.locator('[data-mode-row="2"] .open-mode').click();
    await page.waitForFunction(()=>document.querySelector('#expandedName')?.textContent==='Películas');
  });

  await check('close expanded Couchset',async()=>{
    await page.locator('#expandedClose').click();
    await page.waitForFunction(()=>!document.querySelector('#expandedMode'));
  });

  await check('change to compact density',async()=>{
    await page.locator('.density-button[data-density="compact"]').click();
    await page.waitForFunction(()=>document.querySelector('#modeList')?.dataset.density==='compact');
  });

  await check('change back to detailed density',async()=>{
    await page.locator('.density-button[data-density="detailed"]').click();
    await page.waitForFunction(()=>document.querySelector('#modeList')?.dataset.density==='detailed');
  });

  await check('expand current desktop',async()=>{
    await page.locator('[data-expand-source="current"]').click();
    await page.waitForSelector('#expandedMode.new-mode-expanded',{timeout:5000});
  });

  await check('create Couchset and close editor',async()=>{
    await page.locator('#expandedSave').click();
    await page.waitForFunction(()=>
      !document.querySelector('#expandedMode')&&
      document.querySelectorAll('.saved-mode-card:not(.mode-expanded)').length===4
    );
  });

  await check('resize during active Morph cleans snapshots and lock',async()=>{
    await page.locator('[data-mode-row="1"] .open-mode').click();
    await page.setViewportSize({width:970,height:700});
  });

  await check('reduced-motion branch opens/closes correctly',async()=>{
    await page.emulateMedia({reducedMotion:'reduce'});
    const button=page.locator('#expandedClose');
    if(await button.count())await button.click();
    await page.locator('[data-mode-row="1"] .open-mode').click();
    await page.locator('#expandedClose').click();
  });

  assert.equal(await page.locator('.mode-transition-snapshot').count(),0);
  assert.equal(await page.locator('.main.layout-motion-active').count(),0);
  assert.equal(await page.locator('.mode-workbench[inert]').count(),0);
  console.log('PASS final cleanup: no stuck animations or inert UI');
}finally{
  await browser.close();
}
