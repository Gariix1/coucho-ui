import test from 'node:test';
import assert from 'node:assert/strict';
import {createMotionScheduler} from '../js/motion-scheduler.js';

test('a delayed update waits until the active morph has fully released',()=>{
  const scheduler=createMotionScheduler();
  const events=[];
  scheduler.setBusy(true);
  scheduler.whenIdle('activation',()=>events.push('activation'));
  assert.deepEqual(events,[]);
  assert.equal(scheduler.isBusy(),true);
  scheduler.setBusy(false);
  assert.deepEqual(events,['activation']);
  assert.equal(scheduler.isBusy(),false);
});

test('repeated queued work with the same key runs once with latest values',()=>{
  const scheduler=createMotionScheduler();
  const events=[];
  scheduler.setBusy(true);
  scheduler.whenIdle('activation',()=>events.push('stale'));
  scheduler.whenIdle('activation',()=>events.push('current'));
  scheduler.setBusy(false);
  assert.deepEqual(events,['current']);
});

test('cancellation prevents a removed mode from activating after morph',()=>{
  const scheduler=createMotionScheduler();
  let activated=false;
  scheduler.setBusy(true);
  scheduler.whenIdle('activation',()=>{activated=true});
  scheduler.cancel('activation');
  scheduler.setBusy(false);
  assert.equal(activated,false);
});

test('idle work runs immediately',()=>{
  const scheduler=createMotionScheduler();
  let completed=false;
  scheduler.whenIdle('save',()=>{completed=true});
  assert.equal(completed,true);
});
