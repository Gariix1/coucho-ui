import {q,qa,esc,setCssVars,closestWithin} from './core/dom.js';
import {iconMarkup,modeIconMarkup} from './core/icons.js';
import {
  autoMeta,
  demoSets,
  getDisplay,
  loadSets,
  saveSets as persistSets,
  simulatedDisplays
} from './data/catalog.js';
import {
  cloneModeConfig,
  applyDisplayConfig,
  toggleSelectedDisplay,
  selectPrimaryDisplay,
  displayConfig,
  displaySummary,
  displayMarkup,
  shortcutCardLabel,
  logo,
  shortcutMarkup,
  modeChangeCount,
  modeConfigEqual
} from './model.js';

import {runMotionTransaction} from './motion-transaction.js';
import {createMotionScheduler} from './motion-scheduler.js';
import {installMotionTokens,MOTION_DURATION,prefersReducedMotion} from './motion-settings.js';
import {bindPressFeedback,celebrateSurface} from './ui/interaction-motion.js';
import {toast} from './ui/feedback.js';
import {bindTouchRename,editInlineText} from './ui/inline-edit.js';
import {positionPopover} from './ui/popover.js';
import {openModal,closeModal,createDialog} from './ui/modal.js';
import {expandedModeMarkup,modeCardMarkup,currentDesktopMarkup} from './ui/mode-markup.js';
import {buildDisplayOverview,displayOverviewMarkup} from './ui/display-overview.js';
import {initTheme} from './features/theme.js';
import {initSettings} from './features/settings.js';
import {initApps} from './features/apps.js';
import {SAMPLE_APPS} from './data/app-catalog.js';
import {readAppliedSession,writeAppliedSession} from './data/session-store.js';
import {
  layoutKeyForMode,
  modesForRender
} from './features/mode-layout.js';

const TEST_MODE_KEY='coucho-test-mode';
const CARD_DENSITY_KEY='coucho-card-density';
const ACTIVATION_DELAY_MS=850;
const TEST_PROGRESS_INTERVAL_MS=340;
const TEST_COUNTDOWN_INTERVAL_MS=1000;
const TEST_TIMEOUT_RESTORE_MS=420;
const MANUAL_RESTORE_STEP_MS=380;
const MANUAL_RESTORE_FINISH_MS=220;
const INTERACTIVE_SELECTOR='button,a,input,select,textarea,[contenteditable="true"]';
const EXPANDED_TOGGLE_EXCLUDE_SELECTOR=INTERACTIVE_SELECTOR+',.mode-name-edit';

// Persistent mode/session state.
let sets=loadSets();
let appliedSession=readAppliedSession(sets,simulatedDisplays);
let activatingId=null;
let activationTimer=null;

// Expanded mode state.
let expandedModeId=null;
let expandedOpen=false;
let cardDensity=localStorage.getItem(CARD_DENSITY_KEY)==='compact'?'compact':'detailed';
let expandedConfig=null;
let newModeBase=null;
let createAutoNamed=true;
let modeTransitioning=false;
const motionScheduler=createMotionScheduler();

function resetExpandedState(){
  expandedOpen=false;
  expandedModeId=null;
  expandedConfig=null;
  newModeBase=null;
  createAutoNamed=true;
}

// Transient picker / overlay state.
let displayEditModeId=null;
let displayDraft=null;
let appEditTarget=null;
let shortcutEditTarget=null;
let captured=null;

// Test flow state.
let testContext=null;
let progressTimer=null;
let countdownTimer=null;
let restoreTimer=null;

function clearTestTimers(){
  clearInterval(progressTimer);
  clearInterval(countdownTimer);
  clearTimeout(restoreTimer);
  progressTimer=null;
  countdownTimer=null;
  restoreTimer=null;
}

function scheduleTestRestore(callback,delay){
  restoreTimer=setTimeout(function(){
    restoreTimer=null;
    callback();
  },delay);
}

// Mode/session domain helpers.
function byId(id){return sets.find(function(x){return x.id===id})||null}
function active(){return sets.find(function(x){return x.active})||null}
function resolveId(raw){
  var a=active();
  return raw==='active'?(a?a.id:null):Number(raw);
}
function commitSets(){
  normalizeActive();
  persistSets(sets);
  writeAppliedSession(appliedSession);
}
function normalizeActive(){
  var kept=false;
  sets.forEach(function(s){
    if(s.active&&!kept){kept=true;return}
    if(s.active)s.active=false;
  });
}
function sessionFromMode(mode){
  if(!mode)return null;

  var preservedIds=appliedSession&&appliedSession.displayIds.length
    ?appliedSession.displayIds.slice()
    :['main','aux'];
  var preservedPrimary=appliedSession&&appliedSession.primaryDisplayId
    ?appliedSession.primaryDisplayId
    :'main';

  return {
    modeId:mode.id,
    name:mode.name,
    icon:mode.icon,
    app:mode.app,
    preserve:!!mode.preserve,
    displayIds:mode.preserve
      ?preservedIds
      :(Array.isArray(mode.displayIds)?mode.displayIds.slice():[]),
    primaryDisplayId:mode.preserve
      ?preservedPrimary
      :(mode.primaryDisplayId||null)
  };
}

function ensureAppliedSession(){
  if(appliedSession)return;
  var mode=active();
  if(mode){
    appliedSession=sessionFromMode(mode);
    writeAppliedSession(appliedSession);
  }
}

function sessionMatchesMode(session,mode){
  if(!session||!mode||session.modeId!==mode.id)return false;
  if(session.app!==mode.app||session.preserve!==!!mode.preserve)return false;
  if(mode.preserve)return true;
  if(session.primaryDisplayId!==(mode.primaryDisplayId||null))return false;
  var a=session.displayIds.slice().sort().join('|');
  var b=(mode.displayIds||[]).slice().sort().join('|');
  return a===b;
}
function newModeConfigFromApplied(){
  ensureAppliedSession();
  var ids=appliedSession&&appliedSession.displayIds.length
    ?appliedSession.displayIds.slice()
    :['main','aux'];
  var primary=appliedSession&&appliedSession.primaryDisplayId
    ?appliedSession.primaryDisplayId
    :(ids[0]||'main');
  return {
    id:null,name:'Nuevo modo',icon:'desktop',preserve:false,
    displayIds:ids,primaryDisplayId:primary,app:'Ninguna',shortcut:'Manual'
  };
}

// Apps owns its own list and Hop-visibility settings; modes only provide usage.
const appLibrary=initApps({getModes:()=>sets});
function renderResourceViews(){
  appLibrary.render();
}

// Modes list and inline expanded visualizer.
function hasTextSelection(){
  var selection=window.getSelection&&window.getSelection();
  return !!(selection&&String(selection).trim());
}


function hasPendingCreateChanges(){
  return !!(
    expandedOpen&&
    expandedModeId===null&&
    expandedConfig&&
    newModeBase&&
    !modeConfigEqual(expandedConfig,newModeBase)
  );
}

function confirmDiscardDraft(onDiscard){
  createDialog(q('#couchoDialog')).open({
    heading:'¿Descartar el nuevo modo?',
    message:'Los cambios sin guardar se perderán.',
    confirmText:'Descartar',
    confirmStyle:'danger',
    onConfirm:onDiscard
  });
}

function guardExpandedSwitch(nextId){
  if(!expandedOpen||expandedModeId===nextId||!hasPendingCreateChanges())return true;
  confirmDiscardDraft(async()=>{
    await collapseExpandedMode(false,null,true);
    const source=elementForMode(nextId);
    if(source)await expandModeSurface(nextId,source);
  });
  return false;
}

function setModeTransitioning(value){
  modeTransitioning=!!value;
  const workbench=q('.mode-workbench');
  if(workbench){
    if(modeTransitioning){
      workbench.setAttribute('inert','');
      workbench.setAttribute('aria-busy','true');
    }else{
      workbench.removeAttribute('inert');
      workbench.removeAttribute('aria-busy');
    }
  }
  // Flush delayed state updates only after the motion-owned DOM is released.
  motionScheduler.setBusy(modeTransitioning);
}

function elementForMode(id){
  return id===null
    ?q('[data-expand-source="current"]')
    :q('[data-mode-row="'+id+'"]');
}

function setExpandedTarget(targetId){
  var mode=targetId===null?null:byId(targetId);

  expandedOpen=true;
  expandedModeId=targetId;

  if(mode){
    expandedConfig=cloneModeConfig(mode);
    newModeBase=null;
    createAutoNamed=false;
  }else{
    expandedConfig=newModeConfigFromApplied();
    newModeBase=cloneModeConfig(expandedConfig);
    createAutoNamed=true;
  }
}

async function setCardDensity(next){
  if(next!=='compact'&&next!=='detailed')return;
  if(next===cardDensity||modeTransitioning)return;

  const root=q('#modeList');
  const anchorKey=expandedOpen?layoutKeyForMode(expandedModeId):null;

  await runMotionTransaction({
    root,
    layout:{
      anchorKey,
      scrollElement:q('.main'),
      excludeKeys:anchorKey?[anchorKey]:[],
      duration:MOTION_DURATION.density
    },
    onBusy:setModeTransitioning,
    mutate(){
      cardDensity=next;
      localStorage.setItem(CARD_DENSITY_KEY,cardDensity);
      renderWorkbench();
    }
  });

  q('.density-button[data-density-option="'+next+'"]')?.focus({preventScroll:true});
}

async function switchExpandedSurface(targetId,source){
  if(!expandedOpen||modeTransitioning)return false;
  if(expandedModeId===targetId)return true;
  if(!guardExpandedSwitch(targetId))return false;

  const previousId=expandedModeId;
  const previousKey=layoutKeyForMode(previousId);
  const targetKey=layoutKeyForMode(targetId);
  const previousSurface=q('.mode-expanded');
  if(!previousSurface||!source)return false;

  closePops();
  await runMotionTransaction({
    root:q('#modeList'),
    surfaces:[
      {source:previousSurface,destination:()=>elementForMode(previousId),direction:'close'},
      {source,destination:()=>q('.mode-expanded'),direction:'open'}
    ],
    layout:{
      anchorKey:targetKey,
      scrollElement:q('.main'),
      excludeKeys:[previousKey,targetKey],
      duration:MOTION_DURATION.open
    },
    onBusy:setModeTransitioning,
    mutate(){
      setExpandedTarget(targetId);
      renderWorkbench();
    }
  });

  q('#expandedClose')?.focus({preventScroll:true});
  return true;
}

async function expandModeSurface(targetId,source){
  if(modeTransitioning)return false;

  if(expandedOpen){
    if(expandedModeId===targetId){
      q('.mode-expanded')?.focus({preventScroll:true});
      return true;
    }
    return switchExpandedSurface(targetId,source);
  }

  if(targetId!==null&&!byId(targetId))return false;
  if(!source)return false;

  const targetKey=layoutKeyForMode(targetId);
  closePops();

  await runMotionTransaction({
    root:q('#modeList'),
    surfaces:[{source,destination:()=>q('.mode-expanded'),direction:'open'}],
    layout:{
      anchorKey:targetKey,
      scrollElement:q('.main'),
      excludeKeys:[targetKey],
      duration:MOTION_DURATION.open
    },
    onBusy:setModeTransitioning,
    mutate(){
      setExpandedTarget(targetId);
      renderWorkbench();
    }
  });

  q('#expandedClose')?.focus({preventScroll:true});
  return true;
}

function expandCurrentDesktop(rawId){
  if(rawId!=='current')return;
  expandModeSurface(null,q('[data-expand-source="current"]'));
}

function expandSavedMode(id,source){
  var mode=byId(id);
  if(!mode)return false;
  return expandModeSurface(mode.id,source);
}

async function collapseExpandedMode(restore,afterClose,discardConfirmed=false){
  if(!expandedOpen||modeTransitioning)return false;
  if(hasPendingCreateChanges()&&!discardConfirmed){
    confirmDiscardDraft(()=>collapseExpandedMode(restore,afterClose,true));
    return false;
  }

  closePops();
  const closingId=expandedModeId;
  const closingKey=layoutKeyForMode(closingId);

  await runMotionTransaction({
    root:q('#modeList'),
    surfaces:[{
      source:q('.mode-expanded'),
      destination:()=>elementForMode(closingId),
      direction:'close'
    }],
    layout:{
      anchorKey:closingKey,
      scrollElement:q('.main'),
      excludeKeys:[closingKey],
      duration:MOTION_DURATION.close
    },
    onBusy:setModeTransitioning,
    mutate(){
      resetExpandedState();
      renderWorkbench();
    }
  });

  if(typeof afterClose==='function'){
    afterClose();
    return true;
  }

  if(restore){
    const focusTarget=closingId===null
      ?q('[data-expand-source="current"]')
      :q('[data-mode-row="'+closingId+'"] .open-mode');
    focusTarget?.focus({preventScroll:true});
  }
  return true;
}

function focusOrExpandMode(card){
  if(!card)return;
  var id=Number(card.dataset.modeRow);
  if(!id)return;
  expandSavedMode(id,card);
}

function renderModeList(){
  var modeList=q('#modeList');
  if(!modeList)return;

  modeList.dataset.density=cardDensity;
  if(currentPopAnchor&&modeList.contains(currentPopAnchor))closePops();

  var currentExpanded=expandedOpen&&expandedModeId===null;
  var current=currentExpanded
    ?expandedModeMarkup({
      kind:'new',
      id:null,
      layoutKey:layoutKeyForMode(null)
    })
    :currentDesktopMarkup(appliedSession);

  var saved=modesForRender(sets,{
    expandedOpen:expandedOpen,
    expandedModeId:expandedModeId,
    modeList:modeList
  }).map(function(mode){
    if(expandedOpen&&expandedModeId===mode.id){
      return expandedModeMarkup({
        kind:'mode',
        id:mode.id,
        layoutKey:layoutKeyForMode(mode.id)
      });
    }
    return modeCardMarkup(mode,{
      applying:activatingId===mode.id,
      density:cardDensity,
      layoutKey:layoutKeyForMode(mode.id)
    });
  }).join('');

  modeList.innerHTML=
    '<div class="mode-list-group source-group">'+
      '<div class="mode-list-label">Crear desde</div>'+
      current+
    '</div>'+
    '<div class="mode-list-group saved-group">'+
      '<div class="mode-list-group-head" data-layout-key="saved-head">'+
        '<div class="mode-list-label">Tus modos</div>'+
        '<div class="density-toggle" role="group" aria-label="Vista de modos">'+
          '<button class="density-button" data-density-option="compact" aria-pressed="'+(cardDensity==='compact'?'true':'false')+'" title="Vista compacta" aria-label="Vista compacta">'+iconMarkup('grid')+'</button>'+
          '<button class="density-button" data-density-option="detailed" aria-pressed="'+(cardDensity==='detailed'?'true':'false')+'" title="Vista detallada" aria-label="Vista detallada">'+iconMarkup('list')+'</button>'+
        '</div>'+
      '</div>'+
      '<div class="mode-grid '+cardDensity+'">'+
        (saved||'<div class="mode-list-empty">Aún no has guardado modos.</div>')+
      '</div>'+
    '</div>';


}

function renderExpandedScreens(){
  var stage=q('#expandedScreens');
  if(!stage||!expandedConfig)return;

  var ordered=simulatedDisplays.slice().sort(function(a,b){
    var al=a.layout&&a.layout.left!=null?a.layout.left:a.number;
    var bl=b.layout&&b.layout.left!=null?b.layout.left:b.number;
    return al-bl;
  });

  stage.innerHTML=ordered.map(function(d){
    var selected=expandedConfig.displayIds.indexOf(d.id)>=0;
    var primary=selected&&expandedConfig.primaryDisplayId===d.id;
    return '<div class="mode-expanded-display '+(selected?'on':'off')+(primary?' primary':'')+'" data-display-layout="'+d.id+'">'+
      '<button class="mode-expanded-display-screen" data-expanded-display="'+d.id+'" aria-pressed="'+(selected?'true':'false')+'" title="'+(selected?'Apagar ':'Activar ')+esc(d.name)+'">'+
        '<span class="mode-expanded-display-state">'+(selected?'Activa':'Apagada')+'</span>'+
        '<span class="mode-expanded-display-number">'+d.number+'</span>'+
      '</button>'+
      '<button class="mode-expanded-display-primary" data-expanded-primary="'+d.id+'" aria-pressed="'+(primary?'true':'false')+'" title="'+(primary?'Pantalla principal':'Hacer principal')+'" aria-label="'+(primary?d.name+' es principal':'Hacer '+d.name+' principal')+'">'+iconMarkup(primary?'star-filled':'star')+'</button>'+
      '<div class="mode-expanded-display-info">'+
        '<div class="mode-expanded-display-copy"><b>'+esc(d.name)+'</b><small>'+esc(d.model)+'</small></div>'+
        '<div class="mode-expanded-display-tech">'+esc(d.resolution)+'<br>'+esc(d.hz)+'</div>'+
      '</div>'+
    '</div>';
  }).join('');

  qa('[data-display-layout]').forEach(function(element){
    var display=getDisplay(element.dataset.displayLayout);
    var layout=display&&display.layout?display.layout:{width:28,aspect:1.78};
    setCssVars(element,{
      '--display-width':layout.width,
      '--display-aspect':layout.aspect
    });
  });

}

function syncExpandedSavedMode(){
  if(expandedModeId===null||!expandedConfig)return;

  var mode=byId(expandedModeId);
  if(!mode)return;

  mode.name=expandedConfig.name;
  mode.icon=expandedConfig.icon;
  applyDisplayConfig(mode,expandedConfig);
  mode.app=expandedConfig.app;
  mode.shortcut=expandedConfig.shortcut;
  commitSets();
}

function renderExpandedMode(){
  if(!expandedOpen||!expandedConfig)return;

  var surface=q('.mode-expanded');
  if(!surface)return;

  renderExpandedScreens();

  var isNew=expandedModeId===null;
  var changeCount=isNew?modeChangeCount(expandedConfig,newModeBase):0;
  var dirty=changeCount>0;
  var mode=isNew?null:byId(expandedModeId);
  var pending=!!(mode&&mode.active&&appliedSession&&!sessionMatchesMode(appliedSession,mode));

  var profileIcon=q('#expandedProfileIcon');
  if(profileIcon)profileIcon.innerHTML=modeIconMarkup(expandedConfig.icon);
  q('#expandedName').textContent=expandedConfig.name;
  q('#expandedAppName').textContent=expandedConfig.app;
  q('#expandedShortcutName').textContent=shortcutCardLabel(expandedConfig.shortcut);

  var state=q('#expandedState');
  var activeState=!!(mode&&mode.active&&!pending);
  state.hidden=!(dirty||pending||activeState);
  state.textContent=dirty
    ?(changeCount===1?'1 cambio':changeCount+' cambios')
    :(pending?'Pendiente':activeState?'Activo':'');
  state.classList.toggle('dirty',dirty||pending);
  state.classList.toggle('active',activeState);

  var resetButton=q('#expandedReset');
  if(resetButton)resetButton.hidden=!dirty;

  var activateButton=q('#expandedActivate');
  if(activateButton){
    var applying=!!(mode&&activatingId===mode.id);
    activateButton.hidden=!!(mode&&mode.active&&!pending);
    activateButton.disabled=applying;
    activateButton.setAttribute('aria-busy',applying?'true':'false');
    activateButton.textContent=applying?'…':pending?'Aplicar':'Activar';
  }
  q('#expandedClose').title=isNew?'Cancelar':'Compactar';
  q('#expandedClose').setAttribute('aria-label',isNew?'Cancelar':'Compactar');

  bindExpandedRename();
}

function refreshExpandedConfig(){
  if(expandedModeId!==null)syncExpandedSavedMode();
  renderResourceViews();
  renderDisplayOverview();
  renderWorkbench();
}

function renderWorkbench(){
  renderModeList();
  if(expandedOpen)renderExpandedMode();
}

function render(){
  ensureAppliedSession();
  renderResourceViews();
  renderDisplayOverview();
  renderWorkbench();
}

function toggleExpandedDisplay(id){
  if(!expandedConfig)return;

  expandedConfig.preserve=false;
  if(!toggleSelectedDisplay(expandedConfig,id)){
    toast('Pantallas','Debe quedar al menos una activa');
    return;
  }
  refreshExpandedConfig();
}

function makeExpandedPrimary(id){
  if(!expandedConfig)return;
  expandedConfig.preserve=false;
  selectPrimaryDisplay(expandedConfig,id);
  refreshExpandedConfig();
}

function removeSet(id){
  var removed=byId(id);
  if(!removed||removed.active)return false;

  if(activatingId===id){
    clearTimeout(activationTimer);
    activationTimer=null;
    motionScheduler.cancel('activation');
    activatingId=null;
  }

  sets=sets.filter(function(s){return s.id!==id});

  if(expandedModeId===id){
    resetExpandedState();
  }
  commitSets();
  render();
  toast('Modo eliminado',removed.name);
  return true;
}

function completeActivation(id){
  if(activatingId!==id)return;
  const current=byId(id);
  if(!current){
    activatingId=null;
    renderWorkbench();
    return;
  }

  sets.forEach(function(s){s.active=s.id===id});
  desktopDisplayDraft=null;
  appliedSession=sessionFromMode(current);
  commitSets();
  activatingId=null;
  render();
  celebrateSurface(q('[data-mode-row="'+id+'"]'));
  toast(current.name,'Activo');
}

function activate(id,force){
  const target=byId(id);
  if(!target||(!force&&target.active)||activatingId!==null||modeTransitioning)return;
  activatingId=id;
  motionScheduler.cancel('activation');
  clearTimeout(activationTimer);
  renderWorkbench();

  activationTimer=setTimeout(function(){
    activationTimer=null;
    motionScheduler.whenIdle('activation',()=>completeActivation(id));
  },ACTIVATION_DELAY_MS);
}

// Anchored popovers and inline mode actions.
let currentPop=null;
let currentPopAnchor=null;

function openAnchoredPop(pop,anchor){
  if(!pop||!anchor||!anchor.isConnected)return false;
  currentPop=pop;
  currentPopAnchor=anchor;
  pop.classList.add('open');
  if(!positionPopover(pop,anchor)){
    closePops();
    return false;
  }
  return true;
}

function closePops(){
  q('#displayPop').classList.remove('open');
  q('#appPop').classList.remove('open');

  displayDraft=null;
  displayEditModeId=null;
  appEditTarget=null;
  currentPop=null;
  currentPopAnchor=null;
}

function syncOpenPopPosition(){
  if(!currentPop||!currentPopAnchor)return;
  if(!currentPopAnchor.isConnected){
    closePops();
    return;
  }
  if(!positionPopover(currentPop,currentPopAnchor))closePops();
}

window.addEventListener('resize',syncOpenPopPosition);
q('.main').addEventListener('scroll',syncOpenPopPosition,{passive:true});

function openDeletePop(_anchor,rawId){
  const id=resolveId(rawId);
  const mode=byId(id);
  if(!mode)return;

  if(mode.active){
    toast('Modo activo','Activa otro modo antes de eliminarlo');
    return;
  }
  closePops();
  const message='Este modo se eliminará. No se puede deshacer.';

  createDialog(q('#couchoDialog')).open({
    heading:'¿Eliminar “'+mode.name+'”?',
    message,
    confirmText:'Eliminar modo',
    confirmStyle:'danger',
    onConfirm:()=>{
      if(!byId(id))return;
      removeSet(id);
      const next=q('.saved-mode-card:not(.mode-expanded) .open-mode')||
        q('[data-expand-source="current"]');
      next?.focus({preventScroll:true});
    }
  });
}

// Displays overview and display picker. Editing changes ONLY the current
// desktop session, never the active Couchset's saved configuration.
let displayIdentificationVisible=false;
let desktopDisplayDraft=null;

function desktopDraftIsChanged(){
  if(!desktopDisplayDraft)return false;
  const current=appliedSession;
  if(!current)return true;
  return desktopDisplayDraft.preserve!==!!current.preserve||
    desktopDisplayDraft.primaryDisplayId!==current.primaryDisplayId||
    desktopDisplayDraft.displayIds.slice().sort().join('|')!==
      (current.displayIds||[]).slice().sort().join('|');
}

function renderDisplayOverview(){
  const stage=q('#displayOverviewStage');
  if(!stage)return;

  const editing=desktopDisplayDraft!==null;
  const session=editing
    ?{...(appliedSession||{}),...desktopDisplayDraft}
    :appliedSession;
  const overview=buildDisplayOverview(session,active(),simulatedDisplays);
  stage.innerHTML=displayOverviewMarkup(overview,{editing});
  stage.dataset.identifying=String(!editing&&displayIdentificationVisible);
  q('#displayIdentifyHelp').hidden=editing||!displayIdentificationVisible;
  q('#displayTopologyStatus').textContent=editing
    ?overview.selectedCount+' de '+overview.count+' seleccionadas'
    :overview.title;

  const detail=q('#displayTopologyDetail');
  detail.hidden=editing||!overview.detail;
  detail.textContent=editing?'':overview.detail;

  q('#editDesktopDisplays').hidden=editing;
  q('#displayReadActions').hidden=editing;
  q('#displayEditActions').hidden=!editing;
  q('#applyDesktopDisplays').disabled=!editing||!desktopDraftIsChanged();
  q('#displayEditHint').textContent='Los Couchsets guardados no cambian.';

  const button=q('#identifyDisplays');
  button.setAttribute('aria-pressed',String(!editing&&displayIdentificationVisible));
  button.textContent=displayIdentificationVisible?'Ocultar números':'Identificar pantallas';
  button.disabled=overview.count===0;
}

function openDisplayPop(anchor,rawId){
  closePops();
  displayEditModeId=resolveId(rawId);
  var source=byId(displayEditModeId);
  if(!source)return;
  displayDraft=displayConfig(source);
  if(!displayDraft.preserve&&displayDraft.displayIds.length===0){
    displayDraft.displayIds=['main'];
    displayDraft.primaryDisplayId='main';
  }
  renderDisplayEditor();
  q('#tryDisplays').hidden=false;
  q('#saveDisplays').textContent='Guardar';
  openAnchoredPop(q('#displayPop'),anchor);
}

function renderDisplayEditor(){
  if(!displayDraft)return;
  var map=q('#screenMap');
  map.classList.toggle('preserve',displayDraft.preserve);
  q('#preserveDisplays').classList.toggle('selected',displayDraft.preserve);
  map.innerHTML=simulatedDisplays.map(function(d){
    var selected=displayDraft.displayIds.indexOf(d.id)>=0;
    var primary=selected&&displayDraft.primaryDisplayId===d.id;
    return '<div class="screen-device '+d.kind+(selected?' selected':' off')+(primary?' primary':'')+'" data-display="'+d.id+'">'+
      '<button class="screen-face screen-toggle" data-display="'+d.id+'" aria-pressed="'+(selected?'true':'false')+'">'+
        '<span class="screen-number">'+d.number+'</span>'+
        '<span class="screen-shape"></span>'+
        '<span class="screen-copy"><b>'+esc(d.name)+'</b><small>'+esc(d.detail)+'</small><em class="screen-visibility">'+(selected?'Activa':'Apagada')+'</em></span>'+
      '</button>'+
      '<button class="primary-screen-btn" data-primary="'+d.id+'" aria-pressed="'+(primary?'true':'false')+'" title="'+(primary?'Pantalla principal':'Hacer principal')+'" aria-label="'+(primary?d.name+' es la pantalla principal':'Hacer '+d.name+' principal')+'">'+iconMarkup(primary?'star-filled':'star')+'</button>'+
    '</div>';
  }).join('');

  var summary=displayDraft.preserve?'No cambiar las pantallas al activar':displaySummary(displayDraft);
  var primary=getDisplay(displayDraft.primaryDisplayId);
  q('#displayEditorSummary').innerHTML=displayDraft.preserve
    ?'<b>Las pantallas quedan como están</b>'
    :'<b>'+summary+'</b>'+(primary?' · '+iconMarkup('star-filled')+' '+esc(primary.name):'');
}

function handleDisplayEditorClick(event){
  var target=event.target;
  if(!(target instanceof Element))return;

  var toggle=target.closest('.screen-toggle');
  if(toggle){
    toggleDisplay(toggle.dataset.display);
    return;
  }

  var primary=target.closest('.primary-screen-btn');
  if(primary)makePrimary(primary.dataset.primary);
}

function bindDisplayEditorEvents(){
  var map=q('#screenMap');
  if(map)map.addEventListener('click',handleDisplayEditorClick);
}

function toggleDisplay(id){
  if(displayDraft.preserve)return;
  if(!toggleSelectedDisplay(displayDraft,id)){
    toast('Pantallas','Debe quedar al menos una activa');
    return;
  }
  renderDisplayEditor();
}

function makePrimary(id){
  if(displayDraft.preserve)return;
  selectPrimaryDisplay(displayDraft,id);
  renderDisplayEditor();
}

function syncAppOptions(selectedApp){
  const managedIds=new Set(appLibrary.getManagedApps().map(app=>app.id));
  // Legacy Couchsets may refer to an app not yet in the demo library.
  // Show the current selection without offering other unmanaged apps.
  const options=[
    {id:'Ninguna',name:'Ninguna',monogram:'—'},
    ...SAMPLE_APPS.filter(app=>managedIds.has(app.id)||app.id===selectedApp)
  ];
  q('#appPop .app-options').innerHTML=options.map(option=>
    '<button class="app-option'+(option.id===selectedApp?' selected':'')+
      '" data-app="'+esc(option.id)+'" aria-pressed="'+String(option.id===selectedApp)+'">'+
    '<div><div class="app-logo">'+esc(option.monogram)+'</div><b>'+esc(option.name)+'</b></div></button>'
  ).join('');
}

function openAppPop(anchor,rawId){
  closePops();
  appEditTarget={kind:'mode',id:resolveId(rawId)};
  var mode=byId(appEditTarget.id);
  if(!mode)return;
  syncAppOptions(mode.app);
  openAnchoredPop(q('#appPop'),anchor);
}

q('#preserveDisplays').onclick=function(){
  displayDraft.preserve=!displayDraft.preserve;
  renderDisplayEditor();
};

function isValidDisplayDraft(){
  if(!displayDraft)return false;
  if(!displayDraft.preserve&&displayDraft.displayIds.length===0){
    toast('Pantallas','Elige al menos una pantalla');
    return false;
  }
  return true;
}

q('#closeDisplays').onclick=closePops;

q('#saveDisplays').onclick=function(){
  if(!isValidDisplayDraft())return;
  var s=byId(displayEditModeId);
  if(!s)return;
  applyDisplayConfig(s,displayDraft);
  commitSets();
  closePops();
  render();
  toast('Pantallas','Guardadas sin probar');
};

q('#tryDisplays').onclick=function(){
  if(!isValidDisplayDraft())return;
  var mode=byId(displayEditModeId);
  if(!mode)return;
  var ctx={
    kind:'display',
    id:displayEditModeId,
    preserve:displayDraft.preserve,
    displayIds:displayDraft.displayIds.slice(),
    primaryDisplayId:displayDraft.primaryDisplayId,
    app:mode.app,
    name:mode.name,
    icon:mode.icon
  };
  closePops();
  startTest(ctx);
};

q('#appPop').addEventListener('click',function(event){
  const b=event.target.closest('.app-option');
  if(!b||!q('#appPop').contains(b))return;
    var app=b.dataset.app;
    var target=appEditTarget;
    closePops();
    if(!target)return;

    if(target.kind==='expanded'){
      expandedConfig.app=app;
      if(expandedModeId===null&&createAutoNamed){
        var wm=autoMeta(app);
        expandedConfig.name=app==='Ninguna'?'Nuevo modo':wm.name;
        expandedConfig.icon=wm.icon;
      }
      refreshExpandedConfig();
      return;
    }

    var s=byId(target.id);
    if(!s)return;
    s.app=app;
    commitSets();
    render();
    toast('Apps',app);
});

// Settings controls are owned by the dedicated settings component.

let testMode=localStorage.getItem(TEST_MODE_KEY)==='1';
function syncTestMode(){
  document.body.classList.toggle('test-mode',testMode);
  q('#testBtn').classList.toggle('active',testMode);
  q('#testBtn').title=testMode?'Salir del modo de prueba':'Modo de prueba';
  q('#testBtn').setAttribute('aria-label',q('#testBtn').title);
}

q('#testBtn').onclick=function(){
  testMode=!testMode;
  localStorage.setItem(TEST_MODE_KEY,testMode?'1':'0');
  syncTestMode();
};

function beginExpandedRename(){
  var element=q('#expandedName');
  if(!element||element.isContentEditable)return;

  var original=expandedConfig.name;
  editInlineText(element,original,function(next){
    expandedConfig.name=next;
    createAutoNamed=false;
    refreshExpandedConfig();
  });
}

async function createModeFromExpanded(){
  if(!expandedConfig||expandedModeId!==null||modeTransitioning)return;

  const created=cloneModeConfig(expandedConfig);
  created.id=Date.now();
  created.active=false;

  await runMotionTransaction({
    root:q('#modeList'),
    surfaces:[{
      source:q('.mode-expanded'),
      destination:()=>q('[data-mode-row="'+created.id+'"]'),
      direction:'close'
    }],
    layout:{
      anchorKey:layoutKeyForMode(null),
      scrollElement:q('.main'),
      excludeKeys:[layoutKeyForMode(null),layoutKeyForMode(created.id)],
      duration:MOTION_DURATION.close
    },
    onBusy:setModeTransitioning,
    mutate(){
      sets.push(created);
      commitSets();
      resetExpandedState();
      render();
    }
  });

  const card=q('[data-mode-row="'+created.id+'"]');
  celebrateSurface(card);
  toast(created.name,'Modo creado');
  requestAnimationFrame(function(){
    card?.scrollIntoView({
      behavior:prefersReducedMotion()?'auto':'smooth',
      block:'nearest'
    });
  });
}

function openExpandedAppPicker(anchor){
  closePops();
  appEditTarget={kind:'expanded'};

  syncAppOptions(expandedConfig.app);
  openAnchoredPop(q('#appPop'),anchor);
}

function testExpandedMode(){
  if(!expandedConfig)return;

  startTest({
    kind:expandedModeId===null?'new-mode':'saved-mode',
    existingId:expandedModeId,
    preserve:expandedConfig.preserve,
    displayIds:expandedConfig.displayIds.slice(),
    primaryDisplayId:expandedConfig.primaryDisplayId,
    app:expandedConfig.app,
    shortcut:expandedConfig.shortcut,
    name:expandedConfig.name,
    icon:expandedConfig.icon
  });
}

function bindExpandedRename(){
  var name=q('#expandedName');
  if(!name)return;

  name.ondblclick=function(event){
    event.preventDefault();
    beginExpandedRename();
  };

  name.onkeydown=function(event){
    if(name.isContentEditable)return;
    if(event.key==='F2'||event.key==='Enter'){
      event.preventDefault();
      beginExpandedRename();
    }
  };

  bindTouchRename(name,beginExpandedRename);
}

function handleModeListClick(event){
  const target=event.target;
  if(!(target instanceof Element))return;
  // Use a scoped resolver: data attributes on #modeList describe state,
  // never user actions, and must not capture descendant clicks.
  const find=selector=>closestWithin(target,selector,event.currentTarget);

  var expandedDisplay=find('[data-expanded-display]');
  if(expandedDisplay){
    toggleExpandedDisplay(expandedDisplay.dataset.expandedDisplay);
    return;
  }

  var expandedPrimary=find('[data-expanded-primary]');
  if(expandedPrimary){
    makeExpandedPrimary(expandedPrimary.dataset.expandedPrimary);
    return;
  }

  var density=find('button[data-density-option]');
  if(density){
    setCardDensity(density.dataset.densityOption);
    return;
  }

  var current=find('[data-expand-source]');
  if(current){
    expandCurrentDesktop(current.dataset.expandSource);
    return;
  }

  var activateButton=find('.activate');
  if(activateButton){
    activate(Number(activateButton.dataset.id));
    return;
  }

  var openButton=find('.open-mode');
  if(openButton){
    focusOrExpandMode(openButton.closest('[data-mode-row]'));
    return;
  }

  var trashButton=find('.trash-mode');
  if(trashButton){
    openDeletePop(trashButton,trashButton.dataset.id);
    return;
  }

  var displayButton=find('.quick-display');
  if(displayButton){
    openDisplayPop(displayButton,displayButton.dataset.id);
    return;
  }

  var appButton=find('.quick-app');
  if(appButton){
    openAppPop(appButton,appButton.dataset.id);
    return;
  }

  var shortcutButton=find('.quick-shortcut');
  if(shortcutButton){
    openShortcut(shortcutButton.dataset.id);
    return;
  }

  if(find('#expandedClose')){
    collapseExpandedMode(true);
    return;
  }

  var expandedApp=find('#expandedApp');
  if(expandedApp){
    openExpandedAppPicker(expandedApp);
    return;
  }

  if(find('#expandedShortcut')){
    openShortcut('expanded');
    return;
  }

  if(find('#expandedReset')){
    expandedConfig=cloneModeConfig(newModeBase);
    refreshExpandedConfig();
    return;
  }

  if(find('#expandedSave')){
    createModeFromExpanded();
    return;
  }

  if(find('#expandedActivate')){
    if(expandedModeId!==null)activate(expandedModeId,true);
    return;
  }

  if(find('#expandedTest')){
    testExpandedMode();
    return;
  }

  var toggleSurface=find('[data-expanded-toggle]');
  if(toggleSurface){
    if(find(EXPANDED_TOGGLE_EXCLUDE_SELECTOR)||hasTextSelection())return;
    collapseExpandedMode(true);
    return;
  }

  var card=find('.saved-mode-card:not(.mode-expanded)');
  if(!card)return;
  if(find(INTERACTIVE_SELECTOR)||hasTextSelection())return;

  focusOrExpandMode(card);
}

function bindModeListEvents(){
  var modeList=q('#modeList');
  if(!modeList)return;
  modeList.addEventListener('click',handleModeListClick);
}


function resetDemoModes(next){
  // Do not allow pending asynchronous activation to reinsert a state after reset.
  clearTimeout(activationTimer);
  activationTimer=null;
  motionScheduler.cancel('activation');
  activatingId=null;
  desktopDisplayDraft=null;
  clearTestTimers();
  sets=next;
  appliedSession=null;
  resetExpandedState();
  commitSets();
  render();
}

q('#clearModes').onclick=function(){
  if(q('#testOverlay').classList.contains('open')||modeTransitioning)return;
  createDialog(q('#couchoDialog')).open({
    heading:'¿Vaciar todos los modos?',
    message:'Se eliminarán todos tus Couchsets de esta demo.',
    confirmText:'Vaciar modos',
    confirmStyle:'danger',
    onConfirm:()=>resetDemoModes([])
  });
};

q('#restoreDemo').onclick=function(){
  if(q('#testOverlay').classList.contains('open')||modeTransitioning)return;
  createDialog(q('#couchoDialog')).open({
    heading:'¿Restaurar modos de ejemplo?',
    message:'Se reemplazarán tus Couchsets actuales.',
    confirmText:'Restaurar ejemplos',
    confirmStyle:'danger',
    onConfirm:()=>resetDemoModes(demoSets())
  });
};


function closeShortcutOverlay(){
  closeModal(q('#shortcutOverlay'));
  shortcutEditTarget=null;
  captured=null;
  q('#capUse').hidden=true;
}

function syncShortcutKeys(selectedKey){
  qa('[data-shortcut-key]').forEach(function(button){
    var selected=button.dataset.shortcutKey===selectedKey;
    button.classList.toggle('selected',selected);
    button.setAttribute('aria-pressed',selected?'true':'false');
  });
}

function openShortcut(rawId){
  closePops();
  shortcutEditTarget=rawId==='expanded'
    ?{kind:'expanded'}
    :{kind:'mode',id:resolveId(rawId)};

  if(shortcutEditTarget.kind==='mode'&&!byId(shortcutEditTarget.id)){
    shortcutEditTarget=null;
    return;
  }

  captured=null;
  q('#captureResult').innerHTML='<span class="capture-placeholder">Guide + …</span>';
  q('#capUse').hidden=true;
  syncShortcutKeys(null);
  openModal(q('#shortcutOverlay'),{
    initialFocus:q('#capA'),
    onCancel:closeShortcutOverlay
  });
}

function capture(v){
  captured='Guide + '+v;
  q('#captureResult').innerHTML=shortcutMarkup(captured);
  q('#capUse').hidden=false;

  syncShortcutKeys(v);
}

q('#capA').onclick=function(){capture('A')};
q('#capX').onclick=function(){capture('X')};
q('#capY').onclick=function(){capture('Y')};
q('#capCancel').onclick=closeShortcutOverlay;

q('#capManual').onclick=function(){
  var target=shortcutEditTarget;
  if(!target)return;

  if(target.kind==='expanded'){
    expandedConfig.shortcut='Manual';
    closeShortcutOverlay();
    refreshExpandedConfig();
    return;
  }

  var mode=byId(target.id);
  closeShortcutOverlay();
  if(!mode)return;
  mode.shortcut='Manual';
  commitSets();
  render();
  toast('Atajo','Sin atajo');
};

q('#capUse').onclick=function(){
  if(!captured||!shortcutEditTarget)return;
  var value=captured;
  var target=shortcutEditTarget;

  if(target.kind==='expanded'){
    expandedConfig.shortcut=value;
    closeShortcutOverlay();
    refreshExpandedConfig();
    return;
  }

  var mode=byId(target.id);
  closeShortcutOverlay();
  if(!mode)return;
  mode.shortcut=value;
  commitSets();
  render();
  toast('Atajo',value);
};


// Safe test/apply flow.
function setTestProgress(percent){
  var value=Math.max(0,Math.min(100,Number(percent)||0));
  setCssVars(q('#progress'),{'--test-progress':value+'%'});
}

function startTest(ctx){
  closePops();
  closeShortcutOverlay();
  clearTestTimers();
  testContext=ctx;
  q('#testDisplay').innerHTML='<div class="displays">'+displayMarkup(ctx)+'</div>';
  q('#testApp').textContent=logo(ctx.app);
  q('#testText').textContent='Probando '+ctx.name+'…';
  q('#keep').textContent=ctx.kind==='desktop-display'?'Conservar cambios':ctx.kind==='saved-mode'?'Activar':ctx.kind==='new-mode'?'Guardar y activar':'Guardar';
  setTestProgress(0);q('#confirm').classList.remove('show');q('#testOverlay').classList.add('open');

  var pct=0;
  progressTimer=setInterval(function(){
    pct+=25;setTestProgress(pct);
    if(pct>=100){
      clearInterval(progressTimer);progressTimer=null;
      q('#testText').textContent='Listo';q('#confirm').classList.add('show');
      var left=15;q('#count').textContent=left;
      countdownTimer=setInterval(function(){
        left--;q('#count').textContent=left;
        if(left<=0){
          clearInterval(countdownTimer);
          countdownTimer=null;
          q('#confirm').classList.remove('show');
          q('#testText').textContent='Restaurando…';
          setTestProgress(100);
          scheduleTestRestore(finishRestore,TEST_TIMEOUT_RESTORE_MS);
        }
      },TEST_COUNTDOWN_INTERVAL_MS);
    }
  },TEST_PROGRESS_INTERVAL_MS);
}

q('#keep').onclick=function(){
  clearTestTimers();
  var kind=testContext&&testContext.kind;

  if(kind==='desktop-display'){
    const base=appliedSession||{
      modeId:null,name:'Escritorio actual',icon:'desktop',app:'Ninguna',
      preserve:false,displayIds:[],primaryDisplayId:null
    };
    appliedSession=applyDisplayConfig({...base},testContext);
    writeAppliedSession(appliedSession);
    desktopDisplayDraft=null;
    q('#testOverlay').classList.remove('open');
    render();
    toast('Pantallas','Escritorio actualizado · Couchsets sin cambios');
    testContext=null;
    return;
  }

  if(kind==='display'){
    var s=byId(testContext.id);
    if(s){
      applyDisplayConfig(s,testContext);
      if(s.active)appliedSession=sessionFromMode(s);
    }
    q('#testOverlay').classList.remove('open');
    commitSets();
    render();
    celebrateSurface(q('[data-mode-row="'+testContext.id+'"]'));
    toast(testContext.name,'Pantallas guardadas');
    testContext=null;
    return;
  }

  if(kind==='new-mode'){
    var created={
      id:Date.now(),name:testContext.name,icon:testContext.icon,
      preserve:testContext.preserve,displayIds:testContext.displayIds.slice(),
      primaryDisplayId:testContext.primaryDisplayId,app:testContext.app,
      shortcut:testContext.shortcut||'Manual',active:true
    };
    sets.forEach(function(s){s.active=false});
    sets.push(created);
    appliedSession=sessionFromMode(created);
    resetExpandedState();
    q('#testOverlay').classList.remove('open');
    commitSets();
    render();
    celebrateSurface(q('[data-mode-row="'+created.id+'"]'));
    toast(created.name,'Guardado y activo');
    testContext=null;
    return;
  }

  if(kind==='saved-mode'){
    var edited=byId(testContext.existingId);
    var editedName=testContext.name;
    if(edited){
      edited.name=testContext.name;
      edited.icon=testContext.icon;
      applyDisplayConfig(edited,testContext);
      edited.app=testContext.app;
      edited.shortcut=testContext.shortcut||'Manual';
      sets.forEach(function(s){s.active=s.id===edited.id});
      appliedSession=sessionFromMode(edited);
      expandedOpen=true;
      expandedModeId=edited.id;
      expandedConfig=cloneModeConfig(edited);
      newModeBase=null;
    }
    q('#testOverlay').classList.remove('open');
    commitSets();
    render();
    if(edited)celebrateSurface(q('[data-mode-row="'+edited.id+'"]'));
    toast(editedName,'Activo');
    testContext=null;
    return;
  }


};

function finishRestore(){
  clearTestTimers();
  q('#testOverlay').classList.remove('open');
  testContext=null;
  renderWorkbench();
  toast('Restaurado','Configuración anterior');
}

q('#revert').onclick=function(){
  clearTestTimers();
  q('#confirm').classList.remove('show');
  q('#testText').textContent='Restaurando…';
  setTestProgress(35);
  scheduleTestRestore(function(){
    setTestProgress(100);
    scheduleTestRestore(finishRestore,MANUAL_RESTORE_FINISH_MS);
  },MANUAL_RESTORE_STEP_MS);
};

document.addEventListener('click',function(e){
  var path=typeof e.composedPath==='function'?e.composedPath():[];
  var insideDisplayPop=path.indexOf(q('#displayPop'))>=0;
  var insideAppPop=path.indexOf(q('#appPop'))>=0;
  if(!insideDisplayPop&&!insideAppPop&&!e.target.closest('.quick-display')&&!e.target.closest('.quick-app')&&!e.target.closest('#expandedApp')&&!e.target.closest('.trash-mode')){
    closePops();
  }
});

window.addEventListener('beforeunload',event=>{
  if(!hasPendingCreateChanges())return;
  event.preventDefault();
  event.returnValue='';
});

document.addEventListener('keydown',function(e){
  if(e.key!=='Escape')return;

  if(q('#displayPop').classList.contains('open')||q('#appPop').classList.contains('open')){
    closePops();
    return;
  }

  if(q('#shortcutOverlay').classList.contains('open')){
    closeShortcutOverlay();
    return;
  }

  // The safe display test is intentionally not dismissible with Escape.
  if(q('#testOverlay').classList.contains('open'))return;

  if(expandedOpen){
    collapseExpandedMode(true);
    return;
  }
});

let shellView='modes';

// Shell navigation and global event wiring.
function openShellView(viewName){
  if(modeTransitioning)return;
  if(viewName!==shellView&&hasPendingCreateChanges()){
    confirmDiscardDraft(async()=>{
      await collapseExpandedMode(false,null,true);
      openShellView(viewName);
    });
    return;
  }
  if(shellView==='displays'&&viewName!=='displays'&&desktopDisplayDraft){
    desktopDisplayDraft=null;
    renderDisplayOverview();
  }
  shellView=viewName;
  closePops();

  qa('.shell-view').forEach(function(view){
    var selected=view.dataset.shellView===shellView;
    view.classList.toggle('active',selected);
    view.hidden=!selected;
  });

  qa('[data-nav-view]').forEach(function(item){
    var selected=item.dataset.navView===shellView;
    item.classList.toggle('active',selected);
    if(selected)item.setAttribute('aria-current','page');
    else item.removeAttribute('aria-current');
  });

  q('.main').scrollTo({top:0,behavior:'auto'});
}

q('.nav-rail').addEventListener('click',function(event){
  var trigger=event.target.closest('[data-nav-view]');
  if(trigger)openShellView(trigger.dataset.navView);
});
q('#identifyDisplays').onclick=function(){
  displayIdentificationVisible=!displayIdentificationVisible;
  renderDisplayOverview();
};
q('#editDesktopDisplays').onclick=function(){
  if(q('#testOverlay').classList.contains('open'))return;
  ensureAppliedSession();
  const current=appliedSession;
  const initial=current&&current.displayIds.length?current.displayIds.slice():['main'];
  desktopDisplayDraft={
    preserve:false,
    displayIds:initial,
    primaryDisplayId:current&&initial.includes(current.primaryDisplayId)
      ?current.primaryDisplayId:initial[0]
  };
  displayIdentificationVisible=false;
  renderDisplayOverview();
  q('#cancelDesktopDisplays').focus({preventScroll:true});
};

q('#cancelDesktopDisplays').onclick=function(){
  desktopDisplayDraft=null;
  renderDisplayOverview();
  q('#editDesktopDisplays').focus({preventScroll:true});
};

// Match the exact Couchset display rules: at least one display, one primary.
// Rerender replaces the edited card, so restore keyboard focus to the action.
q('#displayOverviewStage').addEventListener('click',function(event){
  if(!desktopDisplayDraft||q('#testOverlay').classList.contains('open'))return;
  const target=event.target;
  if(!(target instanceof Element))return;
  const root=event.currentTarget;
  const primary=closestWithin(target,'[data-primary-desktop]',root);
  const toggle=closestWithin(target,'[data-toggle-desktop]',root);
  if(!primary&&!toggle)return;

  if(primary){
    selectPrimaryDisplay(desktopDisplayDraft,primary.dataset.primaryDesktop);
  }else if(!toggleSelectedDisplay(desktopDisplayDraft,toggle.dataset.toggleDesktop)){
    toast('Pantallas','Debe quedar al menos una pantalla activa');
    return;
  }
  const id=primary?primary.dataset.primaryDesktop:toggle.dataset.toggleDesktop;
  renderDisplayOverview();
  const selector=primary?'[data-primary-desktop="'+id+'"]':'[data-toggle-desktop="'+id+'"]';
  root.querySelector(selector)?.focus({preventScroll:true});
});

q('#applyDesktopDisplays').onclick=function(){
  if(!desktopDisplayDraft||!desktopDraftIsChanged()||
    q('#testOverlay').classList.contains('open'))return;
  const base=appliedSession;
  startTest({
    kind:'desktop-display',name:'Pantallas del escritorio',icon:base?.icon||'desktop',
    app:base?.app||'Ninguna',preserve:false,
    displayIds:desktopDisplayDraft.displayIds.slice(),
    primaryDisplayId:desktopDisplayDraft.primaryDisplayId
  });
};

q('#displayGoToModes').onclick=function(){
  openShellView('modes');
};

installMotionTokens();
bindPressFeedback();
bindModeListEvents();
bindDisplayEditorEvents();
openShellView('modes');
initTheme();
initSettings();
syncTestMode();
commitSets();
render();
