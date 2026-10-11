import test from 'node:test';
import assert from 'node:assert/strict';
import {
  enterScenario,leaveScenario,getScenario,scenarioIsActive,
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

test('first-use is reversible, even after edits inside the scenario',()=>{
  const data=storage({'coucho-test-sets':'[{"id":8}]',
    'coucho-apps-demo-v1':'[{"id":"Steam"}]',
    'coucho-applied-session-v1':'{"modeId":8}'});
  const session=storage();
  assert.equal(enterScenario('first-use',{session,data}),true);
  assert.equal(scenarioIsActive(session),true);
  assert.equal(getScenario(session),'first-use');
  assert.equal(data.getItem('coucho-test-sets'),'[]');
  assert.equal(data.getItem('coucho-apps-demo-v1'),'[]');
  assert.equal(data.getItem('coucho-applied-session-v1'),null);
  data.setItem('coucho-test-sets','[{"id":22}]');
  leaveScenario({session,data});
  assert.equal(data.getItem('coucho-test-sets'),'[{"id":8}]');
  assert.equal(data.getItem('coucho-apps-demo-v1'),'[{"id":"Steam"}]');
  assert.equal(data.getItem('coucho-applied-session-v1'),'{"modeId":8}');
  assert.equal(scenarioIsActive(session),false);
});

test('switching scenarios restores baseline instead of accumulating corruption',()=>{
  const data=storage({'coucho-test-sets':'[1]'});
  const session=storage();
  enterScenario('first-use',{session,data});
  data.setItem('coucho-test-sets','[8]');
  enterScenario('missing-app',{session,data});
  assert.equal(data.getItem('coucho-test-sets'),'[1]');
  assert.equal(getScenario(session),'missing-app');
  setScenarioWithoutReload('normal',session);
  assert.equal(getScenario(session),'normal');
  leaveScenario({session,data});
  assert.equal(data.getItem('coucho-test-sets'),'[1]');
});

test('availability and application validation produce concrete recoverable errors',()=>{
  assert.equal(displayAvailable('tv','missing-screen'),false);
  assert.equal(displayAvailable('main','missing-screen'),true);
  assert.equal(displayAvailable('main','no-displays'),false);
  assert.equal(appAvailable('Steam','missing-app'),false);
  assert.equal(appAvailable('Plex','missing-app'),true);
  const mode={preserve:false,displayIds:['tv','main'],primaryDisplayId:'tv',app:'Steam'};
  assert.equal(validateActivation(mode,'normal'),null);
  assert.equal(validateActivation(mode,'missing-screen').title,'Pantalla no disponible');
  assert.equal(validateActivation(mode,'missing-app').title,'App no encontrada');
  assert.equal(validateActivation(mode,'no-displays').title,'No hay pantallas');
  assert.equal(validateActivation({...mode,preserve:true},'missing-screen'),null);
});

test('unknown demo scenarios cannot change stored data',()=>{
  const data=storage({'coucho-test-sets':'[1]'});
  const session=storage();
  assert.equal(enterScenario('whatever',{session,data}),false);
  assert.equal(data.getItem('coucho-test-sets'),'[1]');
  assert.equal(scenarioIsActive(session),false);
});
