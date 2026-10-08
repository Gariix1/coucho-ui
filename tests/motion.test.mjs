// Run with: node --experimental-default-type=module --test tests/motion.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MOTION_DURATION,MOTION_EASING,usableRect,installMotionTokens
} from '../js/motion-settings.js';
import {
  applyDisplayConfig,toggleSelectedDisplay,selectPrimaryDisplay
} from '../js/model.js';
import {runMotionTransaction} from '../js/motion-transaction.js';

test('motion geometry rejects collapsed/invisible rectangles',()=>{
  assert.equal(usableRect({width:10,height:20}),true);
  assert.equal(usableRect({width:0,height:20}),false);
  assert.equal(usableRect({width:10,height:0}),false);
  assert.equal(usableRect(null),false);
});

test('CSS timing tokens share the JavaScript motion configuration',()=>{
  const values=new Map();
  installMotionTokens({style:{setProperty:(key,value)=>values.set(key,value)}});
  assert.equal(values.get('--motion-press-duration'),MOTION_DURATION.press+'ms');
  assert.equal(values.get('--motion-feedback-duration'),MOTION_DURATION.feedback+'ms');
  assert.equal(values.get('--motion-feedback-easing'),MOTION_EASING.layout);
});

test('display selection is consistent, preserves one active display',()=>{
  const config={preserve:false,displayIds:['main','aux'],primaryDisplayId:'main'};
  assert.equal(toggleSelectedDisplay(config,'main'),true);
  assert.deepEqual(config.displayIds,['aux']);
  assert.equal(config.primaryDisplayId,'aux');
  assert.equal(toggleSelectedDisplay(config,'aux'),false);
  assert.deepEqual(config.displayIds,['aux']);
  selectPrimaryDisplay(config,'tv');
  assert.deepEqual(config.displayIds,['aux','tv']);
  assert.equal(config.primaryDisplayId,'tv');
  assert.deepEqual(applyDisplayConfig({},config),config);
  const copy=applyDisplayConfig({},config);
  copy.displayIds.push('new');
  assert.deepEqual(config.displayIds,['aux','tv']);
});

test('motion transaction renders before resolving its destination',async()=>{
  const events=[];
  await runMotionTransaction({
    surfaces:[{
      source:null,
      destination:()=>{events.push('destination');return null}
    }],
    mutate:()=>events.push('mutate'),
    onBusy:value=>events.push(value?'busy':'idle')
  });
  assert.deepEqual(events,['busy','mutate','destination','idle']);
});

test('motion transaction releases interaction lock if mutation throws',async()=>{
  const events=[];
  await assert.rejects(runMotionTransaction({
    mutate:()=>{events.push('mutate');throw new Error('interrupted')},
    onBusy:value=>events.push(value?'busy':'idle')
  }),/interrupted/);
  assert.deepEqual(events,['busy','mutate','idle']);
});
