// Run: node --experimental-default-type=module --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {modeSurfaceTransition} from '../js/motion.js';
import {bindPressFeedback} from '../js/ui/interaction-motion.js';

function eventHub(){
  const listeners=new Map();
  return {
    addEventListener(type,fn){
      const list=listeners.get(type)||new Set();
      list.add(fn);
      listeners.set(type,list);
    },
    removeEventListener(type,fn){listeners.get(type)?.delete(fn)},
    dispatch(type,event={}){for(const fn of [...(listeners.get(type)||[])])fn(event)},
    count(type){return listeners.get(type)?.size||0}
  };
}

class FakeElement{
  constructor(rect={left:20,top:30,width:120,height:60}){
    this.rect=rect;
    this.isConnected=true;
    this.children=[];
    this.dataset={};
    this.classes=new Set();
    this.styles={};
    this.style={
      setProperty:(key,value)=>{this.styles[key]=value}
    };
    this.classList={
      add:key=>this.classes.add(key),
      remove:key=>this.classes.delete(key),
      contains:key=>this.classes.has(key),
      toggle:(key,on)=>on?this.classes.add(key):this.classes.delete(key)
    };
    this.animations=[];
  }

  getBoundingClientRect(){return this.rect}
  closest(){return globalThis.document.body}
  hasAttribute(){return false}
  removeAttribute(){}
  setAttribute(){}
  querySelectorAll(){return []}
  cloneNode(){return new FakeElement({...this.rect})}

  appendChild(child){
    child.parent=this;
    this.children.push(child);
    return child;
  }

  remove(){
    this.isConnected=false;
    if(this.parent){
      this.parent.children=this.parent.children.filter(child=>child!==this);
    }
  }

  animate(frames,options){
    let resolve,reject;
    const finished=new Promise((res,rej)=>{resolve=res;reject=rej});
    const animation={
      frames,options,finished,
      cancel(){reject(new Error('canceled'))},
      finish(){resolve()}
    };
    this.animations.push(animation);
    return animation;
  }
}

async function fakeBrowser(callback){
  const original={
    document:globalThis.document,
    window:globalThis.window,
    Element:globalThis.Element,
    getComputedStyle:globalThis.getComputedStyle
  };
  const docEvents=eventHub(),winEvents=eventHub();
  const host=new FakeElement({left:0,top:0,width:900,height:640});
  Object.assign(host,{scrollLeft:0,scrollTop:0,clientLeft:0,clientTop:0});
  const doc={
    ...docEvents,
    body:host,
    documentElement:new FakeElement(),
    hidden:false,
    createElement:()=>new FakeElement(),
    querySelector:()=>host
  };
  const win={
    ...winEvents,
    scrollX:0,scrollY:0,
    matchMedia:()=>({matches:false})
  };
  globalThis.document=doc;
  globalThis.window=win;
  globalThis.Element=FakeElement;
  globalThis.getComputedStyle=()=>({transform:'matrix(.975, 0, 0, .975, 0, 0)'});
  try{
    await callback({host,doc,win});
  }finally{
    for(const [name,value] of Object.entries(original)){
      if(value===undefined)delete globalThis[name];
      else globalThis[name]=value;
    }
  }
}

test('simultaneous morphs keep incoming surface above outgoing and clean on hide',async()=>{
  await fakeBrowser(async({host,doc,win})=>{
    const source=new FakeElement();
    const destination=new FakeElement({left:45,top:160,width:400,height:320});
    const outgoing=modeSurfaceTransition.prepare(source,{layer:0});
    const incoming=modeSurfaceTransition.prepare(source,{layer:1});

    const first=outgoing.play(destination,'close');
    const second=incoming.play(destination,'open');

    assert.deepEqual(host.children.map(node=>node.style.zIndex),
      ['120','124','121','125']);
    assert.equal(destination.classes.has('mode-transition-live-hidden'),true);

    doc.hidden=true;
    doc.dispatch('visibilitychange');
    await Promise.all([first,second]);

    assert.equal(host.children.length,0);
    assert.equal(destination.classes.has('mode-transition-live-hidden'),false);
    assert.equal(doc.count('visibilitychange'),0);
    assert.equal(win.count('resize'),0);
  });
});

test('press feedback releases on window pointerup, keyboard and document hide',async()=>{
  await fakeBrowser(async({doc,win})=>{
    const root=eventHub();
    bindPressFeedback(root);
    const button=new FakeElement();

    const target={closest:()=>button};
    root.dispatch('pointerdown',{button:0,pointerId:8,target});
    assert.equal(button.animations.length,1);
    assert.equal(button.animations[0].options.fill,'forwards');

    win.dispatch('pointerup',{pointerId:9});
    assert.equal(button.animations.length,1,'Another pointer must not release');

    win.dispatch('pointerup',{pointerId:8});
    assert.equal(button.animations.length,2,'Pointerup outside root releases');

    root.dispatch('keydown',{key:'Enter',repeat:false,target});
    win.dispatch('keyup',{key:'Enter'});
    assert.equal(button.animations.length,4,'Keyboard press also releases');

    root.dispatch('pointerdown',{button:0,pointerId:10,target});
    doc.hidden=true;
    doc.dispatch('visibilitychange');
    assert.equal(button.animations.length,6,'Hide releases a held pointer');
  });
});
