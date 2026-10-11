// End-to-end Control journeys against the REAL HTML prototype. The
// scenario sandbox restores the original browser data after each exercise.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({channel:'chrome',headless:true,
  args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:1280,height:900}});
const errors=[];
page.on('pageerror',error=>errors.push(error.message));

async function check(name,callback){
  try{
    await callback();
    assert.deepEqual(errors,[],name+' must not cause JS errors');
    console.log('PASS '+name);
  }catch(error){
    console.error('FAIL '+name+': '+error.stack);
    console.error('STATE '+JSON.stringify(await page.evaluate(()=>({
      view:[...document.querySelectorAll('.shell-view')].filter(x=>!x.hidden).map(x=>x.id),
      modeCount:document.querySelectorAll('.saved-mode-card:not(.mode-expanded)').length,
      scenario:document.querySelector('#demoScenario')?.value,
      dialog:document.querySelector('#couchoDialogTitle')?.textContent,
      expanded:!!document.querySelector('#expandedMode')
    }))));
    throw error;
  }
}

async function selectScenario(value){
  await page.locator('#demoScenario').selectOption(value);
  await Promise.all([
    page.waitForEvent('load',{timeout:12000}),
    page.locator('#demoStart').click()
  ]);
  assert.equal(await page.locator('#demoScenario').inputValue(),value);
  assert.equal(await page.locator('#demoExit').isVisible(),true);
}
async function leave(){
  await Promise.all([
    page.waitForEvent('load',{timeout:12000}),
    page.locator('#demoExit').click()
  ]);
  assert.equal(await page.locator('#demoExit').isVisible(),false);
}

try{
  await page.goto('http://127.0.0.1:8123/',{waitUntil:'networkidle'});
  await page.locator('#testBtn').click();

  await check('first use is genuinely empty and isolated',async()=>{
    await selectScenario('first-use');
    assert.equal(await page.locator('.saved-mode-card:not(.mode-expanded)').count(),0);
    assert.match(await page.locator('[data-expand-source="current"]').innerText(),/Crear tu primer Couchset/);
    await page.locator('[data-nav-view="apps"]').click();
    assert.equal(await page.locator('#appsList .managed-app-row').count(),0);
    await page.locator('#appsAdd').click();
    await page.locator('#couchoDialog input[value="Steam"]').check();
    await page.locator('#couchoDialog [data-dialog-confirm]').click();
    assert.equal(await page.locator('[data-managed-app="Steam"]').count(),1);
  });

  await check('first-use journey creates and activates its first Couchset',async()=>{
    await page.locator('[data-nav-view="modes"]').click();
    await page.locator('[data-expand-source="current"]').click();
    await page.waitForSelector('#expandedMode.new-mode-expanded',{timeout:6000});
    await page.locator('#expandedSave').click();
    await page.waitForFunction(()=>!document.querySelector('#expandedMode')&&
      document.querySelectorAll('.saved-mode-card:not(.mode-expanded)').length===1,null,{timeout:6000});
    await page.locator('.saved-mode-card:not(.mode-expanded) .activate').click();
    await page.waitForTimeout(1100);
    assert.equal(await page.locator('.mode-list-badge').count(),1);
    assert.equal(await page.locator('#couchoDialog').isVisible(),false);
    await leave();
    assert.equal(await page.locator('.saved-mode-card:not(.mode-expanded)').count(),3);
    await page.locator('[data-nav-view="apps"]').click();
    assert.equal(await page.locator('#appsList .managed-app-row').count(),3);
  });

  await check('monitor disconnection is visible, blocks activation and recovers',async()=>{
    await page.locator('[data-nav-view="modes"]').click();
    await selectScenario('missing-screen');
    await page.locator('[data-nav-view="displays"]').click();
    assert.equal(await page.locator('.overview-display.unavailable').count(),1);
    assert.equal(await page.locator('#displayRecovery').isVisible(),true);
    await page.locator('[data-nav-view="modes"]').click();
    await page.locator('[data-mode-row="2"] .activate').click();
    assert.match(await page.locator('#couchoDialogTitle').innerText(),/Pantalla no disponible/);
    assert.equal(await page.locator('[data-mode-row="2"] .mode-list-badge').count(),0);
    await page.locator('#couchoDialog [data-dialog-confirm]').click();
    await page.waitForTimeout(1100);
    assert.equal(await page.locator('[data-mode-row="2"] .mode-list-badge').count(),1);
    await leave();
  });

  await check('no monitors available has an actionable recovery state',async()=>{
    await selectScenario('no-displays');
    await page.locator('[data-nav-view="displays"]').click();
    assert.equal(await page.locator('.overview-display').count(),0);
    assert.equal(await page.locator('#displayRecovery').isVisible(),true);
    assert.equal(await page.locator('#displayTopologyStatus').innerText(),'Sin pantallas');
    assert.equal(await page.locator('#editDesktopDisplays').isVisible(),false);
    await page.locator('#displayRetry').click();
    assert.equal(await page.locator('.overview-display').count(),3);
    assert.equal(await page.locator('#displayRecovery').isVisible(),false);
    await leave();
  });

  await check('missing app is discoverable and retry restores availability',async()=>{
    await selectScenario('missing-app');
    await page.locator('[data-nav-view="apps"]').click();
    assert.equal(await page.locator('[data-managed-app="Steam"] .managed-app-status').innerText(),'No encontrada');
    await page.locator('[data-nav-view="modes"]').click();
    assert.equal((await page.locator('[data-mode-row="1"] .mode-list-badge').innerText()).toLowerCase(),'atención');
    assert.equal(await page.locator('[data-mode-row="1"] .activate').innerText(),'Comprobar');
    await page.locator('[data-nav-view="apps"]').click();
    await page.locator('#appsRetry').click();
    assert.equal(await page.locator('[data-managed-app="Steam"] .managed-app-status').count(),0);
    await leave();
  });

  await check('simulated application failure never announces success prematurely',async()=>{
    await selectScenario('apply-error');
    const before=await page.evaluate(()=>localStorage.getItem('coucho-applied-session-v1'));
    await page.locator('[data-mode-row="2"] .activate').click();
    await page.waitForSelector('#couchoDialog.open',{timeout:5500});
    assert.match(await page.locator('#couchoDialogTitle').innerText(),/No se pudo activar/);
    assert.equal(await page.evaluate(()=>localStorage.getItem('coucho-applied-session-v1')),before);
    await page.locator('#couchoDialog [data-dialog-confirm]').click();
    await page.waitForTimeout(1100);
    assert.equal(await page.locator('[data-mode-row="2"] .mode-list-badge').count(),1);
    await leave();
  });

  await check('shortcut conflict is prevented inline and a free key can be saved',async()=>{
    await page.locator('[data-mode-row="2"] .quick-shortcut').click();
    await page.locator('#capA').click();
    assert.match(await page.locator('#captureResult').innerText(),/Lo usa Gaming/);
    assert.equal(await page.locator('#capUse').isVisible(),false);
    await page.locator('#capX').click();
    assert.equal(await page.locator('#capUse').isVisible(),true);
    await page.locator('#capUse').click();
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('coucho-test-sets')));
    assert.equal(saved.find(mode=>mode.id===2).shortcut,'Guide + X');
    assert.equal(saved.find(mode=>mode.id===1).shortcut,'Guide + A');
  });
}finally{
  await browser.close();
}
