import test from 'node:test';
import assert from 'node:assert/strict';
import {
  enterScenario,leaveScenario,getScenario,scenarioIsActive,
  recoverOrphanedScenario,getControlStorage,
  displayAvailable,appAvailable,validateActivation,setScenarioWithoutReload
} from '../js/demo/scenarios.js';

function storage(values={}){
  const map=new Map(Object.entries(values));
  return {
    getItem:key=>map.has(key)?map.get(key):null,
    setItem:(key,value)=>map.set(key,String(value)),
    removeItem:key=>map.delete(key)
  };
}
test('first-use uses a private store and leaves real data untouched',()=>{
  const data=storage({
    'coucho-test-sets':'[{"id":8}]',
    'coucho-apps-demo-v1':'[{"id":"Steam"}]',
    'coucho-settings-preview-v1':'{"language":"es-419"}',
    'coucho-theme':'dark'
  });
  const session=storage();
  assert.equal(enterScenario('first-use',{session,data}),true);
  const demo=getControlStorage({session,data});
  assert.equal(demo.getItem('coucho-test-sets'),'[]');
  assert.equal(demo.getItem('coucho-apps-demo-v1'),'[]');
  assert.equal(demo.getItem('coucho-applied-session-v1'),null);
  demo.setItem('coucho-test-sets','[{"id":55}]');
  demo.setItem('coucho-settings-preview-v1','{"language":"en-US"}');
  assert.equal(data.getItem('coucho-test-sets'),'[{"id":8}]');
  assert.equal(data.getItem('coucho-settings-preview-v1'),'{"language":"es-419"}');
  leaveScenario({session,data});
  assert.equal(demo.getItem('coucho-test-sets'),'[{"id":8}]');
  assert.equal(data.getItem('coucho-theme'),'dark');
  assert.equal(scenarioIsActive(session),false);
});

test('switching scenarios restores their own initial baseline',()=>{
  const data=storage({'coucho-test-sets':'[1]'});
  const session=storage();
  enterScenario('first-use',{session,data});
  const demo=getControlStorage({session,data});
  demo.setItem('coucho-test-sets','[8]');
  enterScenario('missing-app',{session,data});
  assert.equal(demo.getItem('coucho-test-sets'),'[1]');
  assert.equal(getScenario(session),'missing-app');
  setScenarioWithoutReload('normal',session);
  assert.equal(getScenario(session),'normal');
  leaveScenario({session,data});
  assert.equal(data.getItem('coucho-test-sets'),'[1]');
});

test('different tabs cannot overwrite each other through the sandbox',()=>{
  const data=storage({'coucho-test-sets':'[1]'});
  const first=storage(),second=storage();
  enterScenario('first-use',{session:first,data});
  const a=getControlStorage({session:first,data});
  const b=getControlStorage({session:second,data});
  a.setItem('coucho-test-sets','[300]');
  b.setItem('coucho-test-sets','[200]');
  assert.equal(a.getItem('coucho-test-sets'),'[300]');
  assert.equal(data.getItem('coucho-test-sets'),'[200]');
  leaveScenario({session:first,data});
  assert.equal(data.getItem('coucho-test-sets'),'[200]');
});

test('closing a test tab never leaves demo data in normal storage',()=>{
  const data=storage({'coucho-test-sets':'[1]'});
  const first=storage();
  enterScenario('first-use',{session:first,data});
  getControlStorage({session:first,data}).setItem('coucho-test-sets','[9000]');
  const second=storage();
  assert.equal(recoverOrphanedScenario({session:second,data}),false);
  assert.equal(getControlStorage({session:second,data}).getItem('coucho-test-sets'),'[1]');
});

test('old demo recovery data is migrated once',()=>{
  const data=storage({
    'coucho-test-sets':'[77]',
    'coucho-control-scenario-recovery-v1':JSON.stringify({'coucho-test-sets':'[1]'})
  });
  assert.equal(recoverOrphanedScenario({session:storage(),data}),true);
  assert.equal(data.getItem('coucho-test-sets'),'[1]');
  assert.equal(recoverOrphanedScenario({session:storage(),data}),false);
});

test('outages and validation produce concrete recoverable errors',()=>{
  assert.equal(displayAvailable('tv','missing-screen'),false);
  assert.equal(displayAvailable('main','no-displays'),false);
  assert.equal(appAvailable('Steam','missing-app'),false);
  const mode={preserve:false,displayIds:['tv','main'],primaryDisplayId:'tv',app:'Steam'};
  assert.equal(validateActivation(mode,'normal'),null);
  assert.equal(validateActivation(mode,'missing-screen').title,'Pantalla no disponible');
  assert.equal(validateActivation(mode,'ambiguous-screen').title,'Pantalla sin identificar');
  assert.equal(validateActivation(mode,'missing-app').title,'App no encontrada');
  assert.equal(validateActivation(mode,'no-displays').title,'No hay pantallas');
  assert.equal(validateActivation({...mode,preserve:true},'missing-screen'),null);
});

test('unknown demo scenarios cannot change stored data',()=>{
  const data=storage({'coucho-test-sets':'[1]'}),session=storage();
  assert.equal(enterScenario('whatever',{session,data}),false);
  assert.equal(data.getItem('coucho-test-sets'),'[1]');
  assert.equal(scenarioIsActive(session),false);
});
