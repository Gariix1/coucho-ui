import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SAMPLE_APPS,DEFAULT_MANAGED_APPS,normalizeManagedApps,addManagedApp,
  setAppVisibleInHop,removeManagedApp,appUsedByModes
} from '../js/data/app-catalog.js';

test('defaults show only known apps and preserve Hop visibility',()=>{
  assert.deepEqual(normalizeManagedApps(null),DEFAULT_MANAGED_APPS);
  assert.deepEqual(normalizeManagedApps([
    {id:'Steam',showInHop:true},{id:'Steam',showInHop:false},
    {id:'Untrusted',showInHop:true},null,
    {id:'Kodi',showInHop:'true'}
  ]),[{id:'Steam',showInHop:true},{id:'Kodi',showInHop:false}]);
});

test('adding an app is idempotent and does not mutate the catalog',()=>{
  const before=normalizeManagedApps(null);
  const added=addManagedApp(before,'Discord');
  assert.equal(added.length,before.length+1);
  assert.deepEqual(added.at(-1),{id:'Discord',showInHop:true});
  assert.equal(addManagedApp(added,'Discord'),added);
  assert.equal(addManagedApp(added,'unknown'),added);
  assert.equal(SAMPLE_APPS.length,5);
});

test('visibility changes affect only the chosen managed app',()=>{
  const before=normalizeManagedApps(null);
  const after=setAppVisibleInHop(before,'Steam',false);
  assert.equal(after.find(a=>a.id==='Steam').showInHop,false);
  assert.equal(before.find(a=>a.id==='Steam').showInHop,true);
  assert.equal(after.find(a=>a.id==='Plex').showInHop,true);
});

test('removal does not alter mode references',()=>{
  const modes=[{app:'Steam',name:'Gaming'},{app:'Steam',name:'Trabajo'},{app:'Plex',name:'Películas'}];
  const after=removeManagedApp(normalizeManagedApps(null),'Steam');
  assert.equal(after.some(a=>a.id==='Steam'),false);
  assert.deepEqual(appUsedByModes(modes,'Steam'),['Gaming','Trabajo']);
});

test('empty library is intentional and not silently reseeded',()=>{
  assert.deepEqual(normalizeManagedApps([]),[]);
});
