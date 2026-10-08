// Run: node --experimental-default-type=module --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {modeSurfaceTransition} from '../js/motion.js';
import {bindPressFeedback} from '../js/ui/interaction-motion.js';
import {runMotionTransaction} from '../js/motion-transaction.js';
import {MOTION_DURATION,MOTION_EASING} from '../js/motion-settings.js';

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
    this.events=eventHub();
  }

  addEventListener(type,fn){this.events.addEventListener(type,fn)}
  removeEventListener(type,fn){this.events.removeEventListener(type,fn)}
  dispatch(type,event={}){this.events.dispatch(type,event)}
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
      ['120','124']);
    assert.ok(host.children.every(portal=>portal.children.length===1));
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

test('one choreography synchronizes outgoing, incoming and neighboring FLIP',async()=>{
  await fakeBrowser(async({host,doc})=>{
    const cardA=new FakeElement();
    const cardB=new FakeElement({left:30,top:220,width:120,height:60});
    const editor=new FakeElement({left:30,top:150,width:500,height:340});
    const closedCard=new FakeElement({left:30,top:40,width:120,height:60});

    const root=new FakeElement();
    const sibling=new FakeElement({left:20,top:320,width:300,height:100});
    sibling.dataset.layoutKey='mode:neighbor';
    root.querySelectorAll=()=>[sibling];

    const transaction=runMotionTransaction({
      root,
      surfaces:[
        {source:editor,destination:()=>closedCard,direction:'close'},
        {source:cardB,destination:()=>editor,direction:'open'}
      ],
      layout:{scrollElement:host,duration:MOTION_DURATION.open},
      mutate(){
        sibling.rect={left:40,top:390,width:300,height:100};
      }
    });

    assert.equal(sibling.animations.length,1);
    assert.equal(sibling.animations[0].options.easing,MOTION_EASING.open);
    assert.equal(sibling.animations[0].options.duration,MOTION_DURATION.open);

    const shells=host.children.map(portal=>portal.children[0]);
    const tracks=shells.flatMap(shell=>[
      ...shell.animations,
      ...shell.children.flatMap(layer=>layer.animations)
    ]);
    assert.equal(tracks.length,6);
    assert.ok(tracks.every(track=>track.options.duration===MOTION_DURATION.open));

    // One geometry animation per surface, two opacity-only content layers.
    assert.equal(shells.filter(shell=>shell.animations.length===1).length,2);
    assert.ok(shells.every(shell=>shell.animations[0].options.easing===MOTION_EASING.open));
    assert.ok(tracks.every(track=>track.frames.every(frame=>!('scale' in frame)&&!('transform' in frame))),
      'No layer may scale card content');

    doc.hidden=true;
    doc.dispatch('visibilitychange');
    await transaction;
    assert.equal(host.children.length,0);
    assert.equal(host.classes.has('layout-motion-active'),false);
  });
});

test('tactile feedback does not alter geometry of a morph trigger',async()=>{
  await fakeBrowser(async({doc,win})=>{
    const root=eventHub();
    bindPressFeedback(root);
    const trigger=new FakeElement({left:24,top:72,width:300,height:72});
    const target={closest:()=>trigger};
    const before=trigger.getBoundingClientRect();

    root.dispatch('pointerdown',{button:0,pointerId:1,target});
    win.dispatch('pointerup',{pointerId:1});
    assert.equal(trigger.animations.length,2);
    assert.ok(trigger.animations.every(animation=>
      animation.frames.every(frame=>!Object.hasOwn(frame,'transform'))),
      'A press must never overwrite the transform owned by Morph/FLIP'
    );
    assert.deepEqual(trigger.getBoundingClientRect(),before);

    // The same source is now captured for opening, while feedback is releasing.
    const transition=modeSurfaceTransition.prepare(trigger);
    const destination=new FakeElement({left:35,top:90,width:640,height:340});
    const running=transition.play(destination,'open');
    assert.equal(doc.body.children.length,1);
    const shell=doc.body.children[0].children[0];
    assert.equal(shell.animations.length,1);
    assert.ok(shell.animations[0].frames.every(frame=>
      typeof frame.width==='string'&&typeof frame.height==='string'&&!frame.transform));

    doc.hidden=true;
    doc.dispatch('visibilitychange');
    await running;
    assert.equal(doc.body.children.length,0);
    assert.equal(destination.classes.has('mode-transition-live-hidden'),false);
  });
});

test('fixed viewport snapshots never become children of the scrollable main',async()=>{
  await fakeBrowser(async({host,doc})=>{
    const main=new FakeElement({left:100,top:30,width:600,height:450});
    const source=new FakeElement({left:150,top:120,width:120,height:68});
    source.closest=()=>main;
    const transition=modeSurfaceTransition.prepare(source);
    assert.equal(main.children.length,0);
    assert.equal(host.children.length,1);
    const shell=host.children[0].children[0];
    assert.equal(shell.styles['--motion-left'],'150px');
    assert.equal(shell.styles['--motion-top'],'120px');

    const destination=new FakeElement({left:130,top:95,width:400,height:350});
    const running=transition.play(destination,'open');
    assert.equal(main.children.length,0);
    assert.equal(host.children.length,1);
    doc.hidden=true;
    doc.dispatch('visibilitychange');
    await running;
    assert.equal(host.children.length,0);
  });
});

test('scroll affects only portal translation, never shell geometry or content scale',async()=>{
  await fakeBrowser(async({host,doc,win})=>{
    const source=new FakeElement({left:50,top:130,width:160,height:80});
    source.closest=()=>host;
    const destination=new FakeElement({left:40,top:170,width:640,height:480});
    const transition=modeSurfaceTransition.prepare(source);
    const running=transition.play(destination,'open');
    const portal=host.children[0];
    const shell=portal.children[0];
    const originalFrames=JSON.stringify(shell.animations[0].frames);
    host.scrollTop=95;
    host.dispatch('scroll');
    assert.equal(portal.style.transform,'translate3d(0px,-95px,0)');
    assert.equal(JSON.stringify(shell.animations[0].frames),originalFrames);
    assert.ok(shell.children.every(layer=>
      layer.animations.every(a=>a.frames.every(frame=>frame.transform===undefined))));

    doc.hidden=true;
    doc.dispatch('visibilitychange');
    await running;
    assert.equal(host.children.length,0);
    assert.equal(host.events.count('scroll'),0);
    assert.equal(win.count('scroll'),0);
  });
});
