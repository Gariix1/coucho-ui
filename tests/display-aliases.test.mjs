import test from 'node:test';
import assert from 'node:assert/strict';
import {applyDisplayAliases,renameDisplay,DISPLAY_ALIASES_KEY} from '../js/features/display-aliases.js';

function storage(){
  const data=new Map();
  return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,String(value)),removeItem:key=>data.delete(key)};
}
const source=()=>[
  {id:'tv',name:'TV Sala',model:'LG OLED42C3'},
  {id:'main',name:'Monitor 1',model:'LG 27GP850-B'}
];
test('display alias is persisted without changing model or identity',()=>{
  const displays=source(),store=storage();
  applyDisplayAliases(displays,store);
  assert.equal(renameDisplay(displays,'main','Monitor Gaming',store),true);
  assert.equal(displays[1].name,'Monitor Gaming');
  assert.equal(displays[1].model,'LG 27GP850-B');
  const reload=source();
  applyDisplayAliases(reload,store);
  assert.equal(reload[1].name,'Monitor Gaming');
  assert.match(store.getItem(DISPLAY_ALIASES_KEY),/Monitor Gaming/);
  assert.equal(renameDisplay(reload,'main','Monitor 1',store),true);
  assert.equal(source()[1].name,reload[1].name);
});
test('display aliases reject blanks, duplicates and unknown identities',()=>{
  const displays=source(),store=storage();
  applyDisplayAliases(displays,store);
  for(const value of ['', '  ', 'x'.repeat(51),'TV Sala']){
    assert.equal(renameDisplay(displays,'main',value,store),false);
  }
  assert.equal(renameDisplay(displays,'not-a-display','Gaming',store),false);
  assert.equal(displays[1].name,'Monitor 1');
});
test('malformed stored aliases cannot override real display metadata',()=>{
  const displays=source(),store=storage();
  store.setItem(DISPLAY_ALIASES_KEY,JSON.stringify({main:'',tv:'TV Favorita'}));
  applyDisplayAliases(displays,store);
  assert.equal(displays[0].name,'TV Favorita');
  assert.equal(displays[1].name,'Monitor 1');
});
