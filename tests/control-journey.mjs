// End-to-end Control journeys against the REAL HTML prototype. The
// scenario sandbox restores the original browser data after each exercise.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {demoSets} from '../js/data/catalog.js';

const browser=await chromium.launch({channel:'chrome',headless:true,
  args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:1280,height:900},locale:'es-EC'});
await page.addInitScript(({modes,apps})=>{
  if(localStorage.getItem('coucho-test-sets')===null)
    localStorage.setItem('coucho-test-sets',JSON.stringify(modes));
  if(localStorage.getItem('coucho-apps-demo-v1')===null)
    localStorage.setItem('coucho-apps-demo-v1',JSON.stringify(apps));
},{modes:demoSets(),apps:[
  {id:'Steam',showInHop:true},
  {id:'Playnite',showInHop:false},
  {id:'Plex',showInHop:true}
]});
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
  const clean=await browser.newPage({locale:'es-EC'});
  await clean.goto('http://127.0.0.1:8123/',{waitUntil:'networkidle'});
  assert.equal(await clean.locator('.saved-mode-card:not(.mode-expanded)').count(),0);
  assert.equal(await clean.locator('[data-create-couchset]').isVisible(),true);
  assert.match(await clean.locator('[data-create-couchset]').innerText(),/Crear tu primer Couchset/);
  assert.match(await clean.locator('[data-expand-source="current"]').innerText(),/Escritorio actual/);
  await clean.locator('[data-nav-view="apps"]').click();
  assert.equal(await clean.locator('#appsList .managed-app-row').count(),0);
  assert.equal(await clean.locator('#appsFoundList .discovered-app').count(),5);
  await clean.close();
  console.log('PASS actual first launch without demo presets');

  await page.goto('http://127.0.0.1:8123/',{waitUntil:'networkidle'});
  await page.locator('#testBtn').click();

  await check('first use is genuinely empty and isolated',async()=>{
    await selectScenario('first-use');
    assert.equal(await page.locator('.saved-mode-card:not(.mode-expanded)').count(),0);
    assert.match(await page.locator('[data-create-couchset]').innerText(),/Crear tu primer Couchset/);
    await page.locator('[data-nav-view="apps"]').click();
    assert.equal(await page.locator('#appsList .managed-app-row').count(),0);
    const otherContext=await browser.newContext({locale:'es-EC',storageState:await page.context().storageState()});
    const otherTab=await otherContext.newPage();
    await otherTab.goto('http://127.0.0.1:8123/',{waitUntil:'networkidle'});
    assert.equal(await otherTab.locator('.saved-mode-card:not(.mode-expanded)').count(),3);
    await otherContext.close();
    await page.locator('[data-add-detected="Steam"]').click();
    assert.equal(await page.locator('[data-managed-app="Steam"]').count(),1);
  });

  await check('first-use journey creates and activates its first Couchset',async()=>{
    await page.locator('[data-nav-view="modes"]').click();
    await page.locator('[data-create-couchset]').click();
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

  await check('newly connected monitor is editable and safe to discard',async()=>{
    await selectScenario('new-screen');
    await page.locator('[data-nav-view="displays"]').click();
    assert.equal(await page.locator('.overview-display').count(),4);
    assert.equal(await page.locator('[data-display-id="projector"] .overview-monitor-state').innerText(),'Nueva');
    await page.locator('#editDesktopDisplays').click();
    await page.locator('[data-toggle-desktop="projector"]').click();
    await page.locator('[data-primary-desktop="projector"]').click();
    assert.equal(await page.locator('#applyDesktopDisplays').isEnabled(),true);
    await page.locator('#applyDesktopDisplays').click();
    await page.waitForSelector('#confirm.show',{timeout:7000});
    await page.locator('#keep').click();
    assert.equal(await page.locator('.overview-display.primary').getAttribute('data-display-id'),'projector');
    await leave();
    await page.locator('[data-nav-view="displays"]').click();
    assert.equal(await page.locator('.overview-display').count(),3);
  });

  await check('external Windows display change is observed without changing saved Couchsets',async()=>{
    await selectScenario('external-change');
    const before=await page.evaluate(()=>localStorage.getItem('coucho-test-sets'));
    await page.locator('[data-nav-view="displays"]').click();
    assert.equal(await page.locator('.overview-display.primary').getAttribute('data-display-id'),'aux');
    assert.match(await page.locator('#displayTopologyDetail').innerText(),/fuera de Coucho/);
    assert.equal(await page.locator('.overview-display.on').count(),2);
    await page.locator('[data-nav-view="modes"]').click();
    assert.match(await page.locator('[data-expand-source="current"]').innerText(),/Monitor 1 \+ Monitor 2/);
    assert.match(await page.locator('[data-mode-row="1"] .mode-list-badge').innerText(),/cambió fuera de coucho/i);
    assert.equal(await page.evaluate(()=>localStorage.getItem('coucho-test-sets')),before);
    await page.locator('[data-mode-row="1"] .activate').click();
    await page.waitForTimeout(1200);
    assert.match(await page.locator('[data-mode-row="1"] .mode-list-badge').innerText(),/activo/i);
    await leave();
  });

  await check('ambiguous monitor identity blocks operations until checked',async()=>{
    await selectScenario('ambiguous-screen');
    await page.locator('[data-nav-view="displays"]').click();
    assert.equal(await page.locator('#displayRecovery').isVisible(),true);
    assert.match(await page.locator('#displayRecovery').innerText(),/sin identificar/);
    await page.locator('#displayRetry').click();
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

  await check('partial activation is never reported as completed',async()=>{
    await selectScenario('partial-apply');
    await page.locator('[data-mode-row="2"] .activate').click();
    await page.waitForSelector('#couchoDialog.open',{timeout:5500});
    assert.match(await page.locator('#couchoDialogTitle').innerText(),/Activación parcial/);
    assert.equal(await page.locator('[data-mode-row="2"] .mode-list-badge').count(),0);
    await page.locator('#couchoDialog [data-dialog-confirm]').click();
    assert.equal(await page.locator('#view-displays').isVisible(),true);
    assert.match(await page.locator('#displayRecovery').innerText(),/Resultado parcial/);
    await page.locator('[data-nav-view="modes"]').click();
    assert.equal(await page.locator('[data-mode-row="2"] .mode-list-badge').count(),0);
    assert.match(await page.locator('[data-mode-row="1"] .mode-list-badge').innerText(),/estado sin verificar/i);
    await leave();
  });

  await check('unverified restoration surfaces a recoverable warning',async()=>{
    await selectScenario('restore-error');
    await page.locator('[data-nav-view="displays"]').click();
    await page.locator('#editDesktopDisplays').click();
    await page.locator('[data-toggle-desktop="aux"]').click();
    await page.locator('#applyDesktopDisplays').click();
    await page.waitForSelector('#confirm.show',{timeout:7000});
    await page.locator('#revert').click();
    await page.waitForSelector('#couchoDialog.open',{timeout:7000});
    assert.match(await page.locator('#couchoDialogTitle').innerText(),/Restauración sin verificar/);
    await page.locator('#couchoDialog [data-dialog-confirm]').click();
    assert.equal(await page.locator('#view-displays').isVisible(),true);
    assert.match(await page.locator('#displayRecovery').innerText(),/Restauración sin verificar/);
    await leave();
  });

  await check('language preview switches Control labels and restores Spanish',async()=>{
    await page.locator('[data-nav-view="settings"]').click();
    await page.locator('#settingsLanguage').selectOption('en-US');
    assert.equal(await page.locator('[data-nav-view="modes"]').innerText(),'Modes');
    assert.equal(await page.locator('html').getAttribute('lang'),'en');
    await page.locator('#settingsLanguage').selectOption('es-419');
    assert.equal(await page.locator('[data-nav-view="modes"]').innerText(),'Modos');
    assert.equal(await page.locator('html').getAttribute('lang'),'es');
    await page.locator('[data-nav-view="modes"]').click();
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

  await check('configuration export and import require confirmation',async()=>{
    const {readFile}=await import('node:fs/promises');
    await page.locator('[data-nav-view="settings"]').click();
    await page.locator('#settingsTabAdvanced').click();
    const downloadWait=page.waitForEvent('download',{timeout:6000});
    await page.locator('#settingsExport').click();
    const download=await downloadWait;
    assert.equal(download.suggestedFilename(),'coucho-control-demo.json');
    const copy=await readFile(await download.path(),'utf8');
    const parsed=JSON.parse(copy);
    assert.equal(parsed.format,'coucho-control-preview');
    assert.ok(parsed.couchsets.length>=3);

    await page.locator('#settingsImportFile').setInputFiles({
      name:'configuration.json',mimeType:'application/json',
      buffer:Buffer.from(copy)
    });
    await page.waitForSelector('#couchoDialog.open',{timeout:4000});
    assert.match(await page.locator('#couchoDialogTitle').innerText(),/Importar/);
    await page.locator('#couchoDialog [data-dialog-cancel]').click();
    assert.ok((await page.locator('.saved-mode-card:not(.mode-expanded)').count())>=3);
    await page.locator('#settingsImportFile').setInputFiles({
      name:'configuration.json',mimeType:'application/json',
      buffer:Buffer.from(copy)
    });
    await Promise.all([
      page.waitForEvent('load',{timeout:8000}),
      page.locator('#couchoDialog [data-dialog-confirm]').click()
    ]);
    assert.equal(await page.locator('.saved-mode-card:not(.mode-expanded)').count(),parsed.couchsets.length);
    assert.equal(await page.locator('.mode-list-badge').count(),0);
  });
}finally{
  await browser.close();
}
