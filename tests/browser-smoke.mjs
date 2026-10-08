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
      document.querySelectorAll('.mode-transition-portal').length===0&&
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
    console.error('Event trace:',JSON.stringify(await page.evaluate(()=>window.__motionTrace)));
    console.error('DOM state:',JSON.stringify(await page.evaluate(()=>({
      expanded:!!document.querySelector('#expandedMode'),
      expandedVisible:!!document.querySelector('#expandedMode')?.checkVisibility(),
      snapshots:document.querySelectorAll('.mode-transition-portal').length,
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
  // Release away from the trigger: this test is about pointer feedback,
  // and must not itself open a Couchset before the navigation checks.
  await page.mouse.move(1,1);
  await page.mouse.up();
  await stable();
  assert.equal(await page.locator('#expandedMode').count(),0);
  console.log('PASS stable current-card geometry on pointerdown');

  await page.evaluate(()=>{
    window.__motionTrace=[];
    const list=document.querySelector('#modeList');
    list.addEventListener('click',event=>{
      window.__motionTrace.push({
        type:'capture',tag:event.target.tagName,
        classes:event.target.getAttribute('class'),
        open:!!event.target.closest('.open-mode'),
        modeRow:event.target.closest('[data-mode-row]')?.dataset.modeRow
      });
    },true);
    list.addEventListener('click',event=>{
      window.__motionTrace.push({type:'bubble',open:!!event.target.closest('.open-mode')});
    });
    window.__motionObserver=new MutationObserver(()=>{
      window.__motionTrace.push({
        type:'mutation',
        expanded:!!document.querySelector('#expandedMode'),
        busy:document.querySelector('.mode-workbench')?.getAttribute('aria-busy')
      });
    });
    window.__motionObserver.observe(list,{childList:true,subtree:true});
  });

  await check('open saved Couchset',async()=>{
    await page.locator('[data-mode-row="1"] .open-mode').click();
    await page.waitForSelector('#expandedMode',{timeout:5000});
  });
  assert.equal(await page.locator('#expandedName').innerText(),'Gaming');
  assert.equal(await page.locator('#expandedMode').isVisible(),true);
  await page.evaluate(()=>window.__motionObserver?.disconnect());

  await check('switch expanded Couchset',async()=>{
    await page.locator('[data-mode-row="2"] .open-mode').click();
    await page.waitForFunction(()=>document.querySelector('#expandedName')?.textContent==='Películas');
  });

  await check('close expanded Couchset',async()=>{
    await page.locator('#expandedClose').click();
    await page.waitForFunction(()=>!document.querySelector('#expandedMode'));
  });

  await check('quick display editor opens and closes',async()=>{
    await page.locator('[data-mode-row="1"] .quick-display').click();
    await page.waitForSelector('#displayPop.open',{timeout:3000});
    await page.locator('#closeDisplays').click();
  });
  assert.equal(await page.locator('#displayPop.open').count(),0);

  await check('quick app editor opens and closes',async()=>{
    await page.locator('[data-mode-row="1"] .quick-app').click();
    await page.waitForSelector('#appPop.open',{timeout:3000});
    await page.locator('#appPop [data-app="Steam"]').click();
  });

  await check('quick shortcut editor cancels correctly',async()=>{
    await page.locator('[data-mode-row="1"] .quick-shortcut').click();
    await page.waitForSelector('#shortcutOverlay.open',{timeout:3000});
    await page.locator('#capCancel').click();
  });

  await check('delete confirmation cancels without deleting',async()=>{
    await page.locator('[data-mode-row="3"] .trash-mode').click();
    await page.waitForSelector('#deletePop.open',{timeout:3000});
    await page.locator('#deleteCancel').click();
  });
  assert.equal(await page.locator('.saved-mode-card:not(.mode-expanded)').count(),3);

  await check('change to compact density',async()=>{
    await page.locator('.density-button[data-density-option="compact"]').click();
    await page.waitForFunction(()=>document.querySelector('#modeList')?.dataset.density==='compact');
  });

  await check('change back to detailed density',async()=>{
    await page.locator('.density-button[data-density-option="detailed"]').click();
    await page.waitForFunction(()=>document.querySelector('#modeList')?.dataset.density==='detailed');
  });

  await check('scroll during Morph keeps text unscaled and the shell aligned',async()=>{
    const scroller=page.locator('.main');
    await scroller.evaluate(el=>{el.scrollTop=0});
    await page.locator('[data-mode-row="1"] .open-mode').click();
    await page.waitForFunction(()=>!!document.querySelector('.mode-transition-portal'));

    const sample=await page.evaluate(()=>{
      const portal=document.querySelector('.mode-transition-portal');
      const shell=portal.querySelector('.mode-transition-shell');
      const main=document.querySelector('.main');
      const before=main.scrollTop;
      main.scrollTop+=110;
      main.dispatchEvent(new Event('scroll'));
      const delta=main.scrollTop-before;
      const shellFrames=shell.getAnimations().flatMap(a=>a.effect?.getKeyframes()||[]);
      const contentFrames=[...shell.querySelectorAll('.mode-transition-content')]
        .flatMap(el=>el.getAnimations().flatMap(a=>a.effect?.getKeyframes()||[]));
      return {
        delta,
        portalTransform:portal.style.transform,
        geometryOwnedByShell:shellFrames.some(frame=>frame.width&&frame.height),
        noTransformOnContent:contentFrames.every(frame=>frame.transform===undefined),
        sourceTransform:getComputedStyle(shell.querySelector('.mode-transition-content-source')).transform,
        destinationTransform:getComputedStyle(shell.querySelector('.mode-transition-content-destination')).transform
      };
    });
    assert.ok(sample.delta>0,'The viewport must actually scroll during the transition');
    assert.equal(sample.portalTransform,'translate3d(0px,'+(-sample.delta)+'px,0)');
    assert.equal(sample.geometryOwnedByShell,true);
    assert.equal(sample.noTransformOnContent,true);
    assert.equal(sample.sourceTransform,'none');
    assert.equal(sample.destinationTransform,'none');
  });
  await page.locator('#expandedClose').click();
  await stable();

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

  await check('delayed activation cannot destroy an in-flight Morph',async()=>{
    await page.locator('[data-mode-row="2"] .activate').click();
    // Activation completes after 850 ms. Opening at 650 ms makes the
    // timer expire during the connected transition.
    await page.waitForTimeout(650);
    await page.locator('[data-mode-row="1"] .open-mode').click();
    await page.waitForSelector('#expandedMode',{timeout:5000});
    await page.waitForTimeout(200);
  });
  assert.equal(await page.locator('#expandedMode').isVisible(),true);
  assert.equal(await page.locator('[data-mode-row="2"] .mode-list-badge').count(),1);
  await page.locator('#expandedClose').click();
  await stable();

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

  assert.equal(await page.locator('.mode-transition-portal').count(),0);
  assert.equal(await page.locator('.main.layout-motion-active').count(),0);
  assert.equal(await page.locator('.mode-workbench[inert]').count(),0);
  console.log('PASS final cleanup: no stuck animations or inert UI');
}finally{
  await browser.close();
}
