import test from 'node:test';
import assert from 'node:assert/strict';
import {demoSets,simulatedDisplays} from '../js/data/catalog.js';
import {shortcutOwner,validateCouchset} from '../js/features/shortcut-validation.js';

const modes=demoSets();

test('portable shoulder combinations are exclusive between Couchsets',()=>{
  assert.equal(shortcutOwner(modes,'LB + RB + A').name,'Gaming');
  assert.equal(shortcutOwner(modes,'LB + RB + A',1),null);
  assert.equal(shortcutOwner(modes,'Manual'),null);
  assert.equal(shortcutOwner(modes,'LB + RB + X'),null);
});

test('Couchset creation requires a name and valid primary monitor',()=>{
  const mode={name:'Trabajo',preserve:false,displayIds:['main'],primaryDisplayId:'main',shortcut:'Manual'};
  const context={modes,displays:simulatedDisplays};
  assert.equal(validateCouchset(mode,context),null);
  assert.match(validateCouchset({...mode,name:'  '},context),/nombre/);
  assert.match(validateCouchset({...mode,displayIds:[]},context),/pantalla/);
  assert.match(validateCouchset({...mode,primaryDisplayId:'tv'},context),/principal/);
  assert.match(validateCouchset({...mode,displayIds:['gone'],primaryDisplayId:'gone'},context),/desconocidas/);
  assert.equal(validateCouchset({...mode,preserve:true,displayIds:[],primaryDisplayId:null},context),null);
});

test('duplicate shortcut validation never modifies an existing mode',()=>{
  const config={name:'Películas',preserve:false,displayIds:['tv'],primaryDisplayId:'tv',shortcut:'LB + RB + A'};
  assert.match(validateCouchset(config,{modes,displays:simulatedDisplays,excludeId:2}),/Gaming/);
  assert.equal(modes[0].shortcut,'LB + RB + A');
});


test('unsupported shortcuts cannot arrive through imported configurations',()=>{
  const valid={name:'Gaming nuevo',preserve:false,displayIds:['main'],primaryDisplayId:'main'};
  assert.match(validateCouchset({...valid,shortcut:'LB + RB + B'},{modes:[],displays:simulatedDisplays}),/no es compatible/);
  assert.match(validateCouchset({...valid,shortcut:'Control + F'},{modes:[],displays:simulatedDisplays}),/no es compatible/);
});

