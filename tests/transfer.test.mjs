import test from 'node:test';
import assert from 'node:assert/strict';
import {demoSets,simulatedDisplays} from '../js/data/catalog.js';
import {exportPreview,importPreview} from '../js/features/transfer.js';

test('portable preview can roundtrip Couchsets and manually added apps',()=>{
  const manual={id:'manual:abc123',name:'OBS Studio',showInHop:true,source:'manual'};
  const modes=demoSets().map(m=>({...m,active:false}));
  modes.push({...modes[2],id:25,name:'Streaming',app:manual.id,shortcut:'Guide + X'});
  const exportText=exportPreview({
    modes,apps:[{id:'Steam',showInHop:true},{id:'Plex',showInHop:false},manual],
    settings:{language:'en-US',trayIcon:true},theme:'light'
  });
  const parsed=importPreview(exportText,simulatedDisplays);
  assert.equal(parsed.modes.length,4);
  assert.equal(parsed.modes.find(m=>m.id===25).app,manual.id);
  assert.equal(parsed.apps.find(a=>a.id===manual.id).name,'OBS Studio');
  assert.equal(parsed.settings.language,'en-US');
  assert.equal(parsed.theme,'light');
  assert.ok(parsed.modes.every(m=>m.active===false));
});
test('import rejects corrupt and incompatible content without partial changes',()=>{
  assert.throws(()=>importPreview('{bad',simulatedDisplays),/válido/);
  assert.throws(()=>importPreview(JSON.stringify({format:'native-coucho',version:2,couchsets:[],apps:[]}),simulatedDisplays),/compatible/);
  assert.throws(()=>importPreview(' '.repeat(170000),simulatedDisplays),/grande/);
  const base={format:'coucho-control-preview',version:1,couchsets:[],apps:[]};
  assert.throws(()=>importPreview(JSON.stringify({...base,couchsets:[{id:1,name:'Incompleto'}]}),simulatedDisplays),/pantalla/);
  const unknown={id:15,name:'Broken',preserve:false,displayIds:['tv'],primaryDisplayId:'tv',app:'Unknown',shortcut:'Manual'};
  assert.throws(()=>importPreview(JSON.stringify({...base,couchsets:[unknown]}),simulatedDisplays),/vincular/);
  const duplicate={...demoSets()[0],active:false};
  assert.throws(()=>importPreview(JSON.stringify({...base,apps:[{id:'Steam',showInHop:true}],couchsets:[duplicate,duplicate]}),simulatedDisplays),/duplicados/);
});
