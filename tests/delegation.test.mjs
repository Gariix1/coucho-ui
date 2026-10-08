import test from 'node:test';
import assert from 'node:assert/strict';
import {closestWithin} from '../js/core/dom.js';

function element(parent,selectors=[]){
  const node={
    parent,selectors:new Set(selectors),
    contains(child){
      for(let current=child;current;current=current.parent){
        if(current===this)return true;
      }
      return false;
    },
    closest(selector){
      for(let current=this;current;current=current.parent){
        if(current.selectors.has(selector))return current;
      }
      return null;
    }
  };
  return node;
}

test('root data-density state cannot intercept a Couchset open action',()=>{
  const root=element(null,['[data-density]']);
  const card=element(root,['[data-mode-row]']);
  const button=element(card,['.open-mode']);
  const icon=element(button);

  assert.equal(closestWithin(icon,'[data-density]',root),null);
  assert.equal(closestWithin(icon,'.open-mode',root),button);
  assert.equal(closestWithin(icon,'[data-mode-row]',root),card);
});

test('the density option button is actionable, not its stateful container',()=>{
  const root=element(null,['[data-density]']);
  const option=element(root,['button[data-density-option]']);
  const icon=element(option);
  assert.equal(closestWithin(icon,'button[data-density-option]',root),option);
});

test('delegation cannot escape its own root or treat root as a button',()=>{
  const outside=element(null,['.open-mode']);
  const root=element(null,['.open-mode']);
  const child=element(root);
  assert.equal(closestWithin(outside,'.open-mode',root),null);
  assert.equal(closestWithin(child,'.open-mode',root),null);
});
