import {getThemePreference,setThemePreference} from './theme.js';

const KEY='coucho-settings-preview-v1';
const LANGUAGES=new Set(['system','es-419','es-ES','en-US','pt-BR','pt-PT','fr-FR','de-DE','it-IT']);
const SURFACES=new Set(['control','hop']);
const EXITS=new Set(['control','background']);
const CLOSE_BEHAVIORS=new Set(['minimize','exit']);

export const SETTINGS_DEFAULTS=Object.freeze({
  language:'system',
  startupSurface:'hop',
  startWithWindows:false,
  closeBehavior:'minimize',
  hopEnabled:true,
  controlOpacity:85,
  hopOpacity:85,
  hopExit:'control',
  trayIcon:true
});

function safeNumber(value,fallback){
  return typeof value==='number'&&Number.isFinite(value)
    ?Math.max(20,Math.min(100,Math.round(value/5)*5))
    :fallback;
}

export function normalizeSettings(raw){
  const value=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
  const safe={
    language:LANGUAGES.has(value.language)?value.language:SETTINGS_DEFAULTS.language,
    startupSurface:SURFACES.has(value.startupSurface)?value.startupSurface:SETTINGS_DEFAULTS.startupSurface,
    startWithWindows:typeof value.startWithWindows==='boolean'?value.startWithWindows:SETTINGS_DEFAULTS.startWithWindows,
    closeBehavior:CLOSE_BEHAVIORS.has(value.closeBehavior)?value.closeBehavior:SETTINGS_DEFAULTS.closeBehavior,
    hopEnabled:typeof value.hopEnabled==='boolean'?value.hopEnabled:SETTINGS_DEFAULTS.hopEnabled,
    controlOpacity:safeNumber(value.controlOpacity,SETTINGS_DEFAULTS.controlOpacity),
    hopOpacity:safeNumber(value.hopOpacity,SETTINGS_DEFAULTS.hopOpacity),
    hopExit:EXITS.has(value.hopExit)?value.hopExit:SETTINGS_DEFAULTS.hopExit,
    trayIcon:typeof value.trayIcon==='boolean'?value.trayIcon:SETTINGS_DEFAULTS.trayIcon
  };
  if(!safe.trayIcon&&safe.hopExit==='background')safe.hopExit='control';
  return safe;
}

function loadSettings(){
  try{return normalizeSettings(JSON.parse(localStorage.getItem(KEY)))}
  catch{return normalizeSettings(null)}
}

export function initSettings(){
  const root=document.getElementById('view-settings');
  if(!root)return;
  let settings=loadSettings();
  const el=id=>document.getElementById(id);
  const panels=[...root.querySelectorAll('[data-settings-panel]')];
  const tabs=[...root.querySelectorAll('[data-settings-tab]')];

  function openTab(name,focus=false){
    tabs.forEach(tab=>{
      const active=tab.dataset.settingsTab===name;
      tab.classList.toggle('is-active',active);
      tab.setAttribute('aria-selected',String(active));
      tab.tabIndex=active?0:-1;
      if(focus&&active)tab.focus();
    });
    panels.forEach(panel=>{panel.hidden=panel.dataset.settingsPanel!==name});
    el('settingsResetConfirm').hidden=true;
    el('settingsShortcutInfo').hidden=true;
    el('settingsShortcutExplain').setAttribute('aria-expanded','false');
  }
  tabs.forEach((tab,index)=>{
    tab.addEventListener('click',()=>openTab(tab.dataset.settingsTab));
    tab.addEventListener('keydown',event=>{
      const delta=event.key==='ArrowRight'||event.key==='ArrowDown'?1:
        event.key==='ArrowLeft'||event.key==='ArrowUp'?-1:0;
      if(!delta)return;
      event.preventDefault();
      const next=tabs[(index+delta+tabs.length)%tabs.length];
      openTab(next.dataset.settingsTab,true);
    });
  });

  let statusTimer;
  function save(){
    localStorage.setItem(KEY,JSON.stringify(settings));
    const status=el('settingsSaveState');
    status.textContent='Guardado';
    clearTimeout(statusTimer);
    statusTimer=setTimeout(()=>{status.textContent='Se guarda automáticamente'},1600);
  }

  function render(){
    el('settingsLanguage').value=settings.language;
    el('settingsStartupSurface').value=settings.startupSurface;
    el('settingsStartupWindows').checked=settings.startWithWindows;
    el('settingsCloseBehavior').value=settings.closeBehavior;
    el('settingsHopEnabled').checked=settings.hopEnabled;
    el('settingsShortcutExplain').disabled=!settings.hopEnabled;
    el('settingsHopShortcutRow').classList.toggle('is-disabled',!settings.hopEnabled);
    if(!settings.hopEnabled){
      el('settingsShortcutInfo').hidden=true;
      el('settingsShortcutExplain').setAttribute('aria-expanded','false');
    }
    el('settingsThemeSelect').value=getThemePreference();
    for(const [input,value] of [
      ['settingsControlOpacity',settings.controlOpacity],
      ['settingsHopOpacity',settings.hopOpacity]
    ]){
      el(input).value=String(value);
      el(input+'Value').textContent=value+'%';
    }
    el('settingsControlPreview').style.setProperty('--preview-opacity',settings.controlOpacity+'%');
    el('settingsHopPreview').style.setProperty('--preview-opacity',settings.hopOpacity+'%');
    el('settingsHopExit').value=settings.hopExit;
    el('settingsTrayIcon').checked=settings.trayIcon;
    const background=el('settingsHopExit').querySelector('option[value="background"]');
    background.disabled=!settings.trayIcon;
    el('settingsHopHint').textContent=settings.trayIcon
      ?'El icono de la bandeja permite volver a Coucho si Hop se queda en segundo plano.'
      :'Sin icono en la bandeja, al salir de Hop siempre se vuelve a Control.';
  }

  const bindings=[
    ['settingsLanguage','language'],
    ['settingsStartupSurface','startupSurface'],
    ['settingsStartupWindows','startWithWindows'],
    ['settingsCloseBehavior','closeBehavior'],
    ['settingsHopEnabled','hopEnabled'],
    ['settingsControlOpacity','controlOpacity'],
    ['settingsHopOpacity','hopOpacity'],
    ['settingsHopExit','hopExit'],
    ['settingsTrayIcon','trayIcon']
  ];
  bindings.forEach(([id,key])=>{
    const input=el(id);
    const eventName=input.type==='range'?'input':'change';
    input.addEventListener(eventName,()=>{
      let value=input.type==='checkbox'?input.checked:input.value;
      if(input.type==='range')value=Number(value);
      settings=normalizeSettings({...settings,[key]:value});
      save();
      render();
    });
  });
  const transparencyToggle=el('settingsTransparencyToggle');
  transparencyToggle.addEventListener('click',()=>{
    const details=el('settingsTransparencyDetails');
    details.hidden=!details.hidden;
    transparencyToggle.setAttribute('aria-expanded',String(!details.hidden));
  });

  const shortcutButton=el('settingsShortcutExplain');
  shortcutButton.addEventListener('click',()=>{
    if(!settings.hopEnabled)return;
    const info=el('settingsShortcutInfo');
    info.hidden=!info.hidden;
    shortcutButton.setAttribute('aria-expanded',String(!info.hidden));
  });
  el('settingsShortcutClose').addEventListener('click',()=>{
    el('settingsShortcutInfo').hidden=true;
    shortcutButton.setAttribute('aria-expanded','false');
    shortcutButton.focus();
  });

  el('settingsThemeSelect').addEventListener('change',event=>{
    setThemePreference(event.target.value);
    render();
    el('settingsSaveState').textContent='Guardado';
    clearTimeout(statusTimer);
    statusTimer=setTimeout(()=>{
      el('settingsSaveState').textContent='Se guarda automáticamente';
    },1600);
  });

  el('settingsReset').addEventListener('click',()=>{
    el('settingsResetConfirm').hidden=false;
    el('settingsResetCancel').focus();
  });
  el('settingsResetCancel').addEventListener('click',()=>{
    el('settingsResetConfirm').hidden=true;
    el('settingsReset').focus();
  });
  el('settingsResetAccept').addEventListener('click',()=>{
    settings={...SETTINGS_DEFAULTS};
    setThemePreference('dark');
    save();
    render();
    el('settingsResetConfirm').hidden=true;
    el('settingsReset').focus();
  });

  render();
  openTab('general');
}
