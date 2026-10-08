import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSettings,SETTINGS_DEFAULTS} from '../js/features/settings.js';

test('new users receive understandable, safe preference defaults',()=>{
  assert.deepEqual(normalizeSettings(null),SETTINGS_DEFAULTS);
  assert.equal(SETTINGS_DEFAULTS.hopExit,'control');
});

test('saved settings reject unknown language, surfaces and invalid values',()=>{
  const value=normalizeSettings({
    language:'not-valid',startupSurface:'unknown',hopExit:'broken',
    startWithWindows:'yes',trayIcon:123,
    controlOpacity:-600,hopOpacity:Infinity
  });
  assert.equal(value.language,'system');
  assert.equal(value.startupSurface,SETTINGS_DEFAULTS.startupSurface);
  assert.equal(value.hopExit,'control');
  assert.equal(value.startWithWindows,false);
  assert.equal(value.trayIcon,true);
  assert.equal(value.controlOpacity,20);
  assert.equal(value.hopOpacity,85);
});

test('legitimate languages and appearance levels are preserved',()=>{
  const value=normalizeSettings({
    language:'es-419',startupSurface:'control',startWithWindows:true,
    controlOpacity:65,hopOpacity:95,hopExit:'background',trayIcon:true
  });
  assert.deepEqual(value,{
    language:'es-419',startupSurface:'control',startWithWindows:true,
    controlOpacity:65,hopOpacity:95,hopExit:'background',trayIcon:true
  });
});

test('closing tray access forces Hop to return to Control',()=>{
  const value=normalizeSettings({hopExit:'background',trayIcon:false});
  assert.equal(value.hopExit,'control');
  assert.equal(value.trayIcon,false);
});
