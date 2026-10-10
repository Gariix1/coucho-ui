import test from 'node:test';
import assert from 'node:assert/strict';
import {demoSets,simulatedDisplays} from '../js/data/catalog.js';
import {APPLIED_SESSION_KEY,normalizeAppliedSession,readAppliedSession,writeAppliedSession} from '../js/data/session-store.js';

const modes=demoSets();
const original={
  modeId:1,name:'Gaming',icon:'gaming',app:'Steam',preserve:false,
  displayIds:['tv','main'],primaryDisplayId:'tv'
};

function memoryStorage(){
  const values=new Map();
  return {
    getItem:key=>values.has(key)?values.get(key):null,
    setItem:(key,val)=>values.set(key,val),
    removeItem:key=>values.delete(key)
  };
}

test('applied desktop is stored independently of the Couchset collection',()=>{
  const storage=memoryStorage();
  const manual={...original,displayIds:['main','aux'],primaryDisplayId:'aux'};
  writeAppliedSession(manual,storage);
  assert.equal(storage.getItem(APPLIED_SESSION_KEY),JSON.stringify(manual));
  const fromDisk=readAppliedSession(modes,simulatedDisplays,storage);
  assert.deepEqual(fromDisk,manual);
  assert.deepEqual(modes[0].displayIds,['tv','main']);
  assert.equal(modes[0].primaryDisplayId,'tv');
});

test('stale and corrupt applied sessions never resurrect removed modes or wrong monitors',()=>{
  const storage=memoryStorage();
  for(const value of [
    {...original,modeId:55},
    {...original,displayIds:['tv','missing']},
    {...original,primaryDisplayId:'aux'},
    {...original,displayIds:[]}
  ]){
    storage.setItem(APPLIED_SESSION_KEY,JSON.stringify(value));
    assert.equal(readAppliedSession(modes,simulatedDisplays,storage),null);
  }
  storage.setItem(APPLIED_SESSION_KEY,'{bad');
  assert.equal(readAppliedSession(modes,simulatedDisplays,storage),null);
});

test('clearing stored desktop is explicit, no modes are silently modified',()=>{
  const storage=memoryStorage();
  writeAppliedSession(original,storage);
  writeAppliedSession(null,storage);
  assert.equal(storage.getItem(APPLIED_SESSION_KEY),null);
  assert.equal(readAppliedSession(modes,simulatedDisplays,storage),null);
});

test('manual desktop without an active Couchset remains identifiable',()=>{
  const manual={...original,modeId:null};
  const normalized=normalizeAppliedSession(manual,[],simulatedDisplays);
  assert.equal(normalized.modeId,null);
  assert.equal(normalized.name,'Escritorio actual');
  assert.equal(normalized.primaryDisplayId,'tv');
});
