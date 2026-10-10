import test from 'node:test';
import assert from 'node:assert/strict';
import {simulatedDisplays,demoSets} from '../js/data/catalog.js';
import {buildDisplayOverview,displayOverviewMarkup} from '../js/ui/display-overview.js';

const sets=demoSets();

test('applied Gaming shows physical examples without claiming unused screens are off',()=>{
  const gaming=sets[0];
  const applied={modeId:gaming.id,name:gaming.name,app:gaming.app,
    preserve:false,displayIds:[...gaming.displayIds],
    primaryDisplayId:gaming.primaryDisplayId};
  const overview=buildDisplayOverview(applied,gaming,simulatedDisplays);
  assert.equal(overview.count,3);
  assert.equal(overview.selectedCount,2);
  assert.equal(overview.primaryId,'tv');
  assert.equal(overview.pending,false);
  assert.match(overview.title,/Gaming · 2 de 3 en uso/);
  assert.deepEqual(overview.displays.map(d=>d.state),
    ['En uso','En uso','No usada por el modo']);
  const html=displayOverviewMarkup(overview);
  assert.match(html,/Principal/);
  assert.doesNotMatch(html,/Apagada|Desconectada|Restaurar/);
  assert.equal((html.match(/class="overview-display/g)||[]).length,3);
  assert.equal((html.match(/overview-identify-number/g)||[]).length,3);
});

test('no applied Couchset never claims a monitor is currently in use',()=>{
  const overview=buildDisplayOverview(null,null,simulatedDisplays);
  assert.equal(overview.selectedCount,0);
  assert.equal(overview.hasSession,false);
  assert.ok(overview.displays.every(d=>d.state==='Sin sesión'));
  assert.match(overview.title,/Ningún modo aplicado/);
});

test('preserved modes report preserved layout without inventing a hardware action',()=>{
  const saved={...sets[0],preserve:true};
  const applied={modeId:saved.id,name:saved.name,app:saved.app,preserve:true,
    displayIds:['main'],primaryDisplayId:'main'};
  const overview=buildDisplayOverview(applied,saved,simulatedDisplays);
  assert.equal(overview.selectedCount,1);
  assert.match(overview.detail,/Conserva la configuración/);
});

test('current state mismatches saved mode without claiming which was edited',()=>{
  const edited={...sets[0],displayIds:['main','aux'],primaryDisplayId:'main'};
  const applied={modeId:edited.id,name:edited.name,app:edited.app,preserve:false,
    displayIds:['tv','main'],primaryDisplayId:'tv'};
  const overview=buildDisplayOverview(applied,edited,simulatedDisplays);
  assert.equal(overview.pending,true);
  assert.match(overview.detail,/guardado no cambió/);
  assert.equal(overview.displays[0].primary,true);
  assert.equal(overview.displays[2].used,false);
});

test('unknown display identifiers are catalog mismatches, not proof of disconnection',()=>{
  const applied={modeId:21,name:'Prueba',app:'Ninguna',preserve:false,
    displayIds:['tv','missing-id'],primaryDisplayId:'tv'};
  const overview=buildDisplayOverview(applied,null,simulatedDisplays);
  assert.deepEqual(overview.missing,['missing-id']);
  assert.match(overview.detail,/este ejemplo/);
  assert.equal(overview.selectedCount,1);
});

test('display names are escaped in read-only markup',()=>{
  const overview=buildDisplayOverview(
    {modeId:1,name:'Demo',app:'Ninguna',preserve:false,
      displayIds:['x'],primaryDisplayId:'x'},
    null,
    [{id:'x',number:1,kind:'monitor',name:'<script>alert(1)</script>',model:'<bad>'}]
  );
  const html=displayOverviewMarkup(overview);
  assert.doesNotMatch(html,/<script>|<bad>/);
  assert.match(html,/&lt;script&gt;/);
});

test('edit mode exposes accessible controls without nested buttons',()=>{
  const gaming=sets[0];
  const overview=buildDisplayOverview({modeId:gaming.id,name:gaming.name,app:gaming.app,
    preserve:false,displayIds:[...gaming.displayIds],
    primaryDisplayId:gaming.primaryDisplayId},gaming,simulatedDisplays);
  const html=displayOverviewMarkup(overview,{editing:true});
  assert.equal((html.match(/class="overview-toggle"/g)||[]).length,3);
  assert.equal((html.match(/class="overview-make-primary/g)||[]).length,3);
  assert.equal((html.match(/aria-pressed="true"/g)||[]).length,3);
  assert.match(html,/Elegir Monitor 2 como principal/);
});
