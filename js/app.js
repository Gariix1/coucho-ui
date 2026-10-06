import {q,qa,esc,setCssVars} from './core/dom.js';
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
  displayConfig,
  displayCountLabel,
  displayMarkup,
  displaySummary,
  logo,
  shortcutCardLabel,
  shortcutMarkup,
  modeChangeCount,
  modeConfigEqual
} from './model.js';

import {modeSheetTransition} from './motion.js';

import {toast} from './ui/feedback.js';
import {bindTouchRename,editInlineText} from './ui/inline-edit.js';
import {positionPopover} from './ui/popover.js';
import {initTheme,toggleTheme} from './features/theme.js';

const TEST_MODE_KEY='coucho-test-mode';
const CARD_DENSITY_KEY='coucho-card-density';
const ACTIVATION_DELAY_MS=850;
const TEST_PROGRESS_INTERVAL_MS=340;
const TEST_COUNTDOWN_INTERVAL_MS=1000;
const TEST_TIMEOUT_RESTORE_MS=420;
const MANUAL_RESTORE_STEP_MS=380;
const MANUAL_RESTORE_FINISH_MS=220;

// Persistent mode/session state.
let sets=loadSets();
let appliedSession=null;
let activatingId=null;
let activationTimer=null;

// Expanded mode state.
let expandedModeId=null;
let expandedOpen=false;
let cardDensity=localStorage.getItem(CARD_DENSITY_KEY)==='compact'?'compact':'detailed';
let expandedConfig=null;
let expandedBase=null;
let createAutoNamed=true;
let modeTransitioning=false;

// Transient picker / overlay state.
let displayEditModeId=null;
let displayDraft=null;
let appEditTarget=null;
let shortcutEditTarget=null;
let deleteTarget=null;
let captured=null;

// Test flow state.
let testContext=null;
let progressTimer=null;
let countdownTimer=null;

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
  if(mode)appliedSession=sessionFromMode(mode);
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

function appUsage(app){
  var matches=sets.filter(function(mode){return mode.app===app});
  if(matches.length===0)return {text:'Sin usar',empty:true};
  if(matches.length===1)return {text:matches[0].name,empty:false};
  return {text:matches.length+' modos',empty:false};
}

function renderResourceViews(){
  [
    ['Steam','#steamUsage'],
    ['Playnite','#playniteUsage'],
    ['Plex','#plexUsage']
  ].forEach(function(pair){
    var el=q(pair[1]);
    if(!el)return;
    var usage=appUsage(pair[0]);
    el.textContent=usage.text;
    el.classList.toggle('muted-chip',usage.empty);
  });
}

// Modes list and inline expanded visualizer.
function ensureExpandedConfig(){
  if(expandedConfig)return;
  expandedModeId=null;
  expandedConfig=newModeConfigFromApplied();
  expandedBase=cloneModeConfig(expandedConfig);
  createAutoNamed=true;
}

function newModeHasChanges(){
  return expandedModeId===null&&expandedConfig&&expandedBase&&!modeConfigEqual(expandedConfig,expandedBase);
}

function hasPendingCreateChanges(){
  return expandedOpen&&newModeHasChanges();
}

function guardExpandedSwitch(nextId){
  if(!expandedOpen||expandedModeId===nextId)return true;
  if(!hasPendingCreateChanges())return true;
  toast('Nuevo modo','Crea o restablece el borrador antes de cambiar');
  var surface=q('.mode-expanded');
  if(surface)surface.focus({preventScroll:true});
  return false;
}

function setModeTransitioning(value){
  modeTransitioning=!!value;
  var workbench=q('.mode-workbench');
  if(!workbench)return;
  if(modeTransitioning){
    workbench.setAttribute('inert','');
    workbench.setAttribute('aria-busy','true');
  }else{
    workbench.removeAttribute('inert');
    workbench.removeAttribute('aria-busy');
  }
}

function expandedModeMarkup(kind,id){
  var saved=kind==='mode';
  var rootTag=saved?'article':'section';
  var rootClass='mode-expanded '+(saved?'saved-mode-card saved-mode-expanded':'new-mode-expanded');
  var dataAttr=saved?' data-mode-row="'+id+'"':'';

  return '<'+rootTag+' class="'+rootClass+'" id="expandedMode" tabindex="-1" aria-labelledby="expandedName"'+dataAttr+'>'+
    '<header class="mode-expanded-head">'+
      '<div class="mode-expanded-title-block">'+
        '<div class="mode-expanded-profile-icon" id="expandedProfileIcon"></div>'+
        '<div class="mode-expanded-title-copy">'+
          '<span class="mode-expanded-eyebrow" id="expandedEyebrow"></span>'+
          '<h2 id="expandedName" class="mode-name-edit" tabindex="0"></h2>'+
        '</div>'+
      '</div>'+
      '<div class="mode-expanded-head-actions">'+
        '<span class="mode-expanded-state" id="expandedState" role="status" aria-live="polite" hidden></span>'+
        '<button class="mode-expanded-close" id="expandedClose" title="'+(saved?'Compactar':'Cancelar')+'" aria-label="'+(saved?'Compactar':'Cancelar')+'">'+iconMarkup(saved?'collapse':'close')+'</button>'+
      '</div>'+
    '</header>'+
    '<header class="mode-expanded-section-head"><b id="expandedScreenTitle">Pantallas</b></header>'+
    '<div class="mode-expanded-screen-stage" id="expandedScreens"></div>'+
    '<div class="mode-expanded-pieces">'+
      '<button class="mode-expanded-piece" id="expandedApp" title="Cambiar app">'+
        '<span class="mode-expanded-piece-icon">'+iconMarkup('play')+'</span>'+
        '<span><small>App</small><b id="expandedAppName"></b></span>'+
      '</button>'+
      '<button class="mode-expanded-piece" id="expandedShortcut" title="Cambiar atajo">'+
        '<span class="mode-expanded-piece-icon">'+iconMarkup('gamepad')+'</span>'+
        '<span><small>Atajo</small><b id="expandedShortcutName"></b></span>'+
      '</button>'+
    '</div>'+
    '<footer class="mode-expanded-footer">'+
      '<div class="mode-expanded-actions">'+
        '<button class="btn" id="expandedReset">Restablecer</button>'+
        '<button class="btn" id="expandedTest">Probar</button>'+
        '<button class="btn primary" id="expandedActivate" hidden>Activar</button>'+
        '<button class="btn primary" id="expandedSave">Crear modo</button>'+
      '</div>'+
    '</footer>'+
  '</'+rootTag+'>';
}

function setCardDensity(next){
  if(next!=='compact'&&next!=='detailed')return;
  cardDensity=next;
  localStorage.setItem(CARD_DENSITY_KEY,cardDensity);
  renderWorkbench();
}

async function expandModeSurface(targetId,source){
  if(modeTransitioning)return false;

  if(expandedOpen){
    if(expandedModeId===targetId){
      var current=q('.mode-expanded');
      if(current)current.focus({preventScroll:true});
      return true;
    }
    if(!guardExpandedSwitch(targetId))return false;
    await collapseExpandedMode(false);
    source=targetId===null
      ?q('[data-expand-source="current"]')
      :q('[data-mode-row="'+targetId+'"]');
    if(!source)return false;
  }

  var mode=targetId===null?null:byId(targetId);
  if(targetId!==null&&!mode)return false;

  closePops();
  setModeTransitioning(true);
  var transition=modeSheetTransition.prepare(source);

  try{
    expandedOpen=true;
    expandedModeId=targetId;

    if(mode){
      expandedConfig=cloneModeConfig(mode);
      expandedBase=cloneModeConfig(mode);
      createAutoNamed=false;
    }else{
      expandedConfig=newModeConfigFromApplied();
      expandedBase=cloneModeConfig(expandedConfig);
      createAutoNamed=true;
    }

    renderWorkbench();

    var destination=q('.mode-expanded');
    await transition.play(destination,'open');
  }finally{
    transition.cancel();
    setModeTransitioning(false);
  }

  var closeButton=q('#expandedClose');
  if(closeButton)closeButton.focus();
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

async function collapseExpandedMode(restore,afterClose){
  if(!expandedOpen||modeTransitioning)return false;

  closePops();

  var closingId=expandedModeId;
  var source=q('.mode-expanded');

  setModeTransitioning(true);
  var transition=modeSheetTransition.prepare(source);

  try{
    expandedOpen=false;
    expandedModeId=null;
    expandedConfig=newModeConfigFromApplied();
    expandedBase=cloneModeConfig(expandedConfig);
    createAutoNamed=true;
    renderWorkbench();

    var destination=closingId===null
      ?q('[data-expand-source="current"]')
      :q('[data-mode-row="'+closingId+'"]');

    await transition.play(destination,'close');
  }finally{
    transition.cancel();
    setModeTransitioning(false);
  }

  if(typeof afterClose==='function'){
    afterClose();
    return true;
  }

  if(restore){
    var focusTarget=closingId===null
      ?q('[data-expand-source="current"]')
      :q('[data-mode-row="'+closingId+'"] .open-mode');
    if(focusTarget)focusTarget.focus();
  }
  return true;
}

function focusOrExpandMode(card){
  if(!card)return;
  var id=Number(card.dataset.modeRow);
  if(!id)return;
  expandSavedMode(id,card);
}

function renderModeCard(mode){
  var applying=activatingId===mode.id;
  var safeName=esc(mode.name);
  var safeApp=esc(mode.app);
  var safeShortcut=esc(shortcutCardLabel(mode.shortcut));
  var titleId='mode-title-'+mode.id;

  return '<article class="saved-mode-card" data-mode-row="'+mode.id+'" aria-labelledby="'+titleId+'">'+
    '<div class="saved-mode-head">'+
      '<div class="saved-mode-name">'+
        '<span class="mode-list-icon">'+modeIconMarkup(mode.icon)+'</span>'+
        '<span class="saved-mode-name-copy"><b class="mode-list-name" id="'+titleId+'">'+safeName+'</b>'+
          (mode.active?'<small><span class="mode-list-badge">Activo</span></small>':'')+
        '</span>'+
      '</div>'+
      '<div class="saved-mode-actions">'+
        (!mode.active?'<button class="btn activate" data-id="'+mode.id+'"'+(applying?' disabled aria-busy="true"':'')+' title="Activar modo">'+(applying?'…':'Activar')+'</button>':'')+
        '<button class="open-mode" data-id="'+mode.id+'" aria-controls="expandedMode" title="Expandir '+safeName+'" aria-label="Expandir '+safeName+'">'+iconMarkup('expand')+'</button>'+
        '<button class="trash-mode" data-id="'+mode.id+'" title="Eliminar" aria-label="Eliminar '+safeName+'">'+iconMarkup('delete')+'</button>'+
      '</div>'+
    '</div>'+
    '<div class="saved-mode-body">'+
      '<button class="card-display quick-display" data-id="'+mode.id+'" title="Editar pantallas">'+
        '<span class="card-screen-row"><span class="displays card-displays">'+displayMarkup(mode)+'</span>'+
        '<span class="screen-count"><small>Pantallas</small>'+esc(displayCountLabel(mode))+'</span></span>'+
      '</button>'+
      '<div class="card-facts">'+
        '<button class="card-fact quick-app" data-id="'+mode.id+'" title="Cambiar app"><span class="fact-icon">'+iconMarkup('play')+'</span><span class="fact-copy"><small>App</small><b>'+safeApp+'</b></span></button>'+
        '<button class="card-fact quick-shortcut" data-id="'+mode.id+'" title="Cambiar atajo"><span class="fact-icon">'+iconMarkup('gamepad')+'</span><span class="fact-copy"><small>Atajo</small><b>'+safeShortcut+'</b></span></button>'+
      '</div>'+
    '</div>'+
  '</article>';
}

function renderModeList(){
  var modeList=q('#modeList');
  if(currentPopAnchor&&modeList&&modeList.contains(currentPopAnchor))closePops();

  var currentExpanded=expandedOpen&&expandedModeId===null;
  var current=currentExpanded
    ?expandedModeMarkup('new',null)
    :'<button class="mode-list-item current" data-expand-source="current" aria-controls="expandedMode">'+
      '<span class="mode-list-icon">'+iconMarkup('display')+'</span>'+
      '<span class="mode-list-copy"><b>Escritorio actual</b><small>'+esc(appliedSession?displaySummary(appliedSession):'Estado actual')+'</small></span>'+
      '<span class="mode-source-expand" aria-hidden="true">'+iconMarkup('expand')+'</span>'+
    '</button>';

  var saved=sets.map(function(mode){
    if(expandedOpen&&expandedModeId===mode.id){
      return expandedModeMarkup('mode',mode.id);
    }
    return renderModeCard(mode);
  }).join('');

  q('#modeList').innerHTML=
    '<div class="mode-list-group source-group">'+
      '<div class="mode-list-label">Crear desde</div>'+
      current+
    '</div>'+
    '<div class="mode-list-group saved-group">'+
      '<div class="mode-list-group-head">'+
        '<div class="mode-list-label">Tus modos</div>'+
        '<div class="density-toggle" role="group" aria-label="Vista de modos">'+
          '<button class="density-button" data-density="compact" aria-pressed="'+(cardDensity==='compact'?'true':'false')+'" title="Vista compacta" aria-label="Vista compacta">'+iconMarkup('grid')+'</button>'+
          '<button class="density-button" data-density="detailed" aria-pressed="'+(cardDensity==='detailed'?'true':'false')+'" title="Vista detallada" aria-label="Vista detallada">'+iconMarkup('list')+'</button>'+
        '</div>'+
      '</div>'+
      '<div class="mode-grid '+cardDensity+'">'+
        (saved||'<div class="mode-list-empty">Aún no has guardado modos.</div>')+
      '</div>'+
    '</div>';

  qa('[data-density]').forEach(function(button){
    button.onclick=function(event){
      event.stopPropagation();
      setCardDensity(button.dataset.density);
    };
  });

  qa('[data-expand-source]').forEach(function(element){
    element.onclick=function(){expandCurrentDesktop(element.dataset.expandSource)};
  });

  qa('#modeList .saved-mode-card:not(.mode-expanded)').forEach(function(card){
    card.onclick=function(event){
      if(event.target.closest('button,a,input,select,textarea,[contenteditable="true"]'))return;
      var selection=window.getSelection&&window.getSelection();
      if(selection&&String(selection).trim())return;
      focusOrExpandMode(card);
    };
  });

  qa('#modeList .activate').forEach(function(button){
    button.onclick=function(event){
      event.stopPropagation();
      activate(Number(button.dataset.id));
    };
  });

  qa('#modeList .open-mode').forEach(function(button){
    button.onclick=function(event){
      event.stopPropagation();
      focusOrExpandMode(q('[data-mode-row="'+button.dataset.id+'"]'));
    };
  });

  qa('#modeList .trash-mode').forEach(function(button){
    button.onclick=function(event){
      event.stopPropagation();
      openDeletePop(event.currentTarget,button.dataset.id);
    };
  });

  qa('#modeList .quick-display').forEach(function(button){
    button.onclick=function(event){openDisplayPop(event.currentTarget,button.dataset.id)};
  });

  qa('#modeList .quick-app').forEach(function(button){
    button.onclick=function(event){openAppPop(event.currentTarget,button.dataset.id)};
  });

  qa('#modeList .quick-shortcut').forEach(function(button){
    button.onclick=function(){openShortcut(button.dataset.id)};
  });
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

  qa('[data-expanded-display]').forEach(function(button){
    button.onclick=function(){toggleExpandedDisplay(button.dataset.expandedDisplay)};
  });

  qa('[data-expanded-primary]').forEach(function(button){
    button.onclick=function(){makeExpandedPrimary(button.dataset.expandedPrimary)};
  });
}

function syncExpandedSavedMode(){
  if(expandedModeId===null||!expandedConfig)return;

  var mode=byId(expandedModeId);
  if(!mode)return;

  mode.name=expandedConfig.name;
  mode.icon=expandedConfig.icon;
  mode.preserve=expandedConfig.preserve;
  mode.displayIds=expandedConfig.displayIds.slice();
  mode.primaryDisplayId=expandedConfig.primaryDisplayId;
  mode.app=expandedConfig.app;
  mode.shortcut=expandedConfig.shortcut;
  expandedBase=cloneModeConfig(expandedConfig);
  commitSets();
}

function renderExpandedMode(){
  if(!expandedOpen)return;

  ensureExpandedConfig();
  var surface=q('.mode-expanded');
  if(!surface)return;

  renderExpandedScreens();

  var isNew=expandedModeId===null;
  var changeCount=isNew?modeChangeCount(expandedConfig,expandedBase):0;
  var dirty=changeCount>0;
  var mode=isNew?null:byId(expandedModeId);
  var pending=!!(mode&&mode.active&&appliedSession&&!sessionMatchesMode(appliedSession,mode));

  q('#expandedProfileIcon').innerHTML=modeIconMarkup(expandedConfig.icon);
  q('#expandedEyebrow').hidden=!isNew;
  q('#expandedEyebrow').textContent=isNew?'Crear modo':'';
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

  q('#expandedReset').hidden=!isNew||!dirty;
  q('#expandedSave').hidden=!isNew;
  q('#expandedSave').disabled=false;
  q('#expandedTest').hidden=false;

  var activateButton=q('#expandedActivate');
  var applying=!!(mode&&activatingId===mode.id);
  activateButton.hidden=isNew||!!(mode&&mode.active&&!pending);
  activateButton.disabled=applying;
  activateButton.setAttribute('aria-busy',applying?'true':'false');
  activateButton.textContent=applying?'…':pending?'Aplicar':'Activar';
  q('#expandedClose').title=isNew?'Cancelar':'Compactar';
  q('#expandedClose').setAttribute('aria-label',isNew?'Cancelar':'Compactar');

  bindExpandedControls();
}

function refreshExpandedConfig(){
  if(expandedModeId!==null)syncExpandedSavedMode();
  renderResourceViews();
  renderDisplayOverview();
  renderWorkbench();
}

function renderWorkbench(){
  ensureExpandedConfig();
  renderModeList();
  if(expandedOpen)renderExpandedMode();
}

function render(){
  ensureAppliedSession();
  renderResourceViews();
  renderDisplayOverview();
  ensureExpandedConfig();
  renderWorkbench();
}

function toggleExpandedDisplay(id){
  if(!expandedConfig)return;

  expandedConfig.preserve=false;
  var index=expandedConfig.displayIds.indexOf(id);

  if(index>=0){
    if(expandedConfig.displayIds.length===1){
      toast('Pantallas','Debe quedar al menos una activa');
      return;
    }
    expandedConfig.displayIds.splice(index,1);
    if(expandedConfig.primaryDisplayId===id){
      expandedConfig.primaryDisplayId=expandedConfig.displayIds[0]||null;
    }
  }else{
    expandedConfig.displayIds.push(id);
    if(!expandedConfig.primaryDisplayId)expandedConfig.primaryDisplayId=id;
  }

  refreshExpandedConfig();
}

function makeExpandedPrimary(id){
  if(!expandedConfig)return;
  expandedConfig.preserve=false;
  if(expandedConfig.displayIds.indexOf(id)<0)expandedConfig.displayIds.push(id);
  expandedConfig.primaryDisplayId=id;
  refreshExpandedConfig();
}

function removeSet(id){
  var removed=byId(id);
  if(!removed)return;

  if(activatingId===id){
    clearTimeout(activationTimer);
    activationTimer=null;
    activatingId=null;
  }

  var wasActive=!!removed.active;
  sets=sets.filter(function(s){return s.id!==id});

  if(wasActive){
    sets.forEach(function(s){s.active=false});
    if(sets.length){
      sets[0].active=true;
      appliedSession=sessionFromMode(sets[0]);
    }else{
      appliedSession=null;
    }
  }

  if(expandedModeId===id){
    expandedOpen=false;
    expandedModeId=null;
    expandedConfig=newModeConfigFromApplied();
    expandedBase=cloneModeConfig(expandedConfig);
    createAutoNamed=true;
  }
  commitSets();
  render();
  toast('Modo eliminado',removed.name);
}

function activate(id,force){
  var target=byId(id);
  if(!target||(!force&&target.active)||activatingId!==null)return;

  activatingId=id;
  clearTimeout(activationTimer);
  renderWorkbench();

  activationTimer=setTimeout(function(){
    var current=byId(id);
    if(!current){
      activatingId=null;
      activationTimer=null;
      renderWorkbench();
      return;
    }

    sets.forEach(function(s){s.active=s.id===id});
    appliedSession=sessionFromMode(current);
    commitSets();

    if(expandedModeId===null&&!expandedOpen){
      expandedConfig=newModeConfigFromApplied();
      expandedBase=cloneModeConfig(expandedConfig);
    }

    activatingId=null;
    activationTimer=null;
    render();
    toast(current.name,'Activo');
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
  q('#deletePop').classList.remove('open');

  displayDraft=null;
  displayEditModeId=null;
  appEditTarget=null;
  deleteTarget=null;
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

function openDeletePop(anchor,rawId){
  var id=resolveId(rawId);
  var mode=byId(id);
  if(!mode)return;

  closePops();
  deleteTarget=id;
  var fallback=mode.active?sets.find(function(s){return s.id!==mode.id}):null;
  var deletingOpenDirty=expandedModeId===mode.id&&hasPendingCreateChanges();
  q('#deleteText').textContent=mode.active&&fallback
    ?'¿Eliminar “'+mode.name+'”? Se activará “'+fallback.name+'”.'+(deletingOpenDirty?' También se perderán los cambios sin guardar.':'')
    :'¿Eliminar “'+mode.name+'”? Esta acción no se puede deshacer.'+(deletingOpenDirty?' También se perderán los cambios sin guardar.':'');
  openAnchoredPop(q('#deletePop'),anchor);
  requestAnimationFrame(function(){q('#deleteCancel').focus()});
}

q('#deleteCancel').onclick=closePops;
q('#deleteConfirm').onclick=function(){
  var id=deleteTarget;
  if(id===null)return;
  closePops();
  removeSet(id);
};

// Displays overview and display picker.
function renderDisplayOverview(){
  var session=appliedSession;
  var mode=active();
  var stage=q('#displayOverviewStage');
  if(!stage)return;

  if(!session){
    stage.innerHTML='<div class="empty-state"><div><div class="empty-icon">'+iconMarkup('display')+'</div><h3>Sin sesión aplicada</h3><p>Activa o prueba un modo para ver el estado de tus pantallas.</p></div></div>';
    q('#displayStateMode').textContent='—';
    q('#displayStateIcon').innerHTML=iconMarkup('display');
    q('#displayStateApp').textContent='Sin sesión';
    q('#displayStateCount').textContent='0';
    q('#displayStatePrimary').textContent='—';
    q('#displayTopologyStatus').textContent='Sin configuración aplicada';
    return;
  }

  var ids=session.displayIds;
  var primary=getDisplay(session.primaryDisplayId);
  var hasPending=mode&&mode.id===session.modeId&&!sessionMatchesMode(session,mode);

  stage.innerHTML=simulatedDisplays.map(function(d){
    var on=ids.indexOf(d.id)>=0;
    var isPrimary=session.primaryDisplayId===d.id;
    var cls=d.kind==='tv'?'tv':'pc';
    var badge=isPrimary?iconMarkup('star-filled')+'<span>Principal</span>':on?(session.preserve?'Conservada':'Activa'):'Apagada';
    return '<div class="overview-display '+(on?'on':'off')+(isPrimary?' primary':'')+'">'+
      '<span class="overview-badge">'+badge+'</span>'+
      '<div class="monitor '+cls+(isPrimary?' primary':'')+'"></div>'+
      '<b>'+esc(d.name)+'</b><small>'+esc(d.detail)+'</small>'+
    '</div>';
  }).join('');

  q('#displayStateMode').textContent=session.name;
  q('#displayStateIcon').innerHTML=modeIconMarkup(session.icon);
  q('#displayStateApp').textContent=session.app;
  q('#displayStateCount').textContent=String(session.displayIds.length);
  q('#displayStatePrimary').textContent=primary?primary.name:'—';
  q('#displayTopologyStatus').textContent=hasPending
    ?'Cambios guardados pendientes de aplicar'
    :session.preserve?'Se conservó la configuración existente':displaySummary(session);
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
        '<span class="screen-copy"><b>'+d.name+'</b><small>'+d.detail+'</small></span>'+
      '</button>'+
      '<button class="primary-screen-btn" data-primary="'+d.id+'" aria-pressed="'+(primary?'true':'false')+'" title="'+(primary?'Pantalla principal':'Hacer principal')+'" aria-label="'+(primary?d.name+' es la pantalla principal':'Hacer '+d.name+' principal')+'">'+iconMarkup(primary?'star-filled':'star')+'</button>'+
    '</div>';
  }).join('');

  qa('.screen-toggle').forEach(function(b){
    b.onclick=function(e){
      e.stopPropagation();
      toggleDisplay(b.dataset.display);
    };
  });
  qa('.primary-screen-btn').forEach(function(b){
    b.onclick=function(e){e.stopPropagation();makePrimary(b.dataset.primary)};
  });

  var summary=displayDraft.preserve?'No cambiar las pantallas al activar':displaySummary(displayDraft);
  var primary=getDisplay(displayDraft.primaryDisplayId);
  q('#displayEditorSummary').innerHTML=displayDraft.preserve
    ?'<b>Las pantallas quedan como están</b>'
    :'<b>'+summary+'</b>'+(primary?' · '+iconMarkup('star-filled')+' '+esc(primary.name):'');
}

function toggleDisplay(id){
  if(displayDraft.preserve)return;
  var index=displayDraft.displayIds.indexOf(id);
  if(index>=0){
    if(displayDraft.displayIds.length===1){
      toast('Pantallas','Debe quedar al menos una activa');
      return;
    }
    displayDraft.displayIds.splice(index,1);
    if(displayDraft.primaryDisplayId===id){
      displayDraft.primaryDisplayId=displayDraft.displayIds[0]||null;
    }
  }else{
    displayDraft.displayIds.push(id);
    if(!displayDraft.primaryDisplayId)displayDraft.primaryDisplayId=id;
  }
  renderDisplayEditor();
}

function makePrimary(id){
  if(displayDraft.preserve)return;
  if(displayDraft.displayIds.indexOf(id)<0)displayDraft.displayIds.push(id);
  displayDraft.primaryDisplayId=id;
  renderDisplayEditor();
}

function openAppPop(anchor,rawId){
  closePops();
  appEditTarget={kind:'mode',id:resolveId(rawId)};
  var mode=byId(appEditTarget.id);
  if(!mode)return;
  var app=mode.app;
  qa('#appPop .app-option').forEach(function(x){
    var selected=x.dataset.app===app;
    x.classList.toggle('selected',selected);
    x.setAttribute('aria-pressed',selected?'true':'false');
  });
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

function copyDisplayDraft(target){
  target.preserve=displayDraft.preserve;
  target.displayIds=displayDraft.displayIds.slice();
  target.primaryDisplayId=displayDraft.primaryDisplayId;
}

q('#closeDisplays').onclick=closePops;

q('#saveDisplays').onclick=function(){
  if(!isValidDisplayDraft())return;
  var s=byId(displayEditModeId);
  if(!s)return;
  copyDisplayDraft(s);
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

qa('#appPop .app-option').forEach(function(b){
  b.onclick=function(){
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
  };
});

// Settings and prototype test-mode controls.
q('#settingsTheme').onclick=toggleTheme;

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
  if(!expandedConfig||expandedModeId!==null)return;

  var source=q('.mode-expanded');
  var transition=modeSheetTransition.prepare(source);
  setModeTransitioning(true);

  var created=cloneModeConfig(expandedConfig);
  created.id=Date.now();
  created.active=false;

  try{
    sets.push(created);
    commitSets();

    expandedOpen=false;
    expandedModeId=null;
    expandedConfig=newModeConfigFromApplied();
    expandedBase=cloneModeConfig(expandedConfig);
    createAutoNamed=true;

    render();

    var destination=q('[data-mode-row="'+created.id+'"]');
    await transition.play(destination,'close');
  }finally{
    transition.cancel();
    setModeTransitioning(false);
  }

  toast(created.name,'Modo creado');
  requestAnimationFrame(function(){
    var card=q('[data-mode-row="'+created.id+'"]');
    if(card)card.scrollIntoView({behavior:'smooth',block:'nearest'});
  });
}

function bindExpandedControls(){
  var close=q('#expandedClose');
  if(!close)return;

  close.onclick=function(){collapseExpandedMode(true)};

  q('#expandedApp').onclick=function(event){
    closePops();
    appEditTarget={kind:'expanded'};
    qa('#appPop .app-option').forEach(function(option){
      var selected=option.dataset.app===expandedConfig.app;
      option.classList.toggle('selected',selected);
      option.setAttribute('aria-pressed',selected?'true':'false');
    });
    openAnchoredPop(q('#appPop'),event.currentTarget);
  };

  q('#expandedShortcut').onclick=function(){openShortcut('expanded')};

  q('#expandedReset').onclick=function(){
    if(expandedModeId!==null)return;
    expandedConfig=cloneModeConfig(expandedBase);
    refreshExpandedConfig();
  };

  q('#expandedSave').onclick=createModeFromExpanded;

  q('#expandedActivate').onclick=function(){
    if(expandedModeId!==null)activate(expandedModeId,true);
  };

  q('#expandedTest').onclick=function(){
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
  };

  var name=q('#expandedName');
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

q('#clearModes').onclick=function(){
  sets=[];
  appliedSession=null;
  expandedOpen=false;
  expandedModeId=null;
  expandedConfig=null;
  expandedBase=null;
  commitSets();
  render();
  toast('Modos vaciados','Ya puedes probar el flujo desde cero');
};

q('#restoreDemo').onclick=function(){
  sets=demoSets();
  appliedSession=null;
  expandedOpen=false;
  expandedModeId=null;
  expandedConfig=null;
  expandedBase=null;
  commitSets();
  render();
  toast('Demo restaurada','3 modos');
};


function closeShortcutOverlay(){
  q('#shortcutOverlay').classList.remove('open');
  shortcutEditTarget=null;
  captured=null;
  q('#capUse').hidden=true;
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
  qa('[data-shortcut-key]').forEach(function(button){
    button.classList.remove('selected');
    button.setAttribute('aria-pressed','false');
  });
  q('#shortcutOverlay').classList.add('open');
  q('#capA').focus();
}

function capture(v){
  captured='Guide + '+v;
  q('#captureResult').innerHTML=shortcutMarkup(captured);
  q('#capUse').hidden=false;

  qa('[data-shortcut-key]').forEach(function(button){
    var selected=button.dataset.shortcutKey===v;
    button.classList.toggle('selected',selected);
    button.setAttribute('aria-pressed',selected?'true':'false');
  });
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
  testContext=ctx;clearInterval(progressTimer);clearInterval(countdownTimer);
  q('#testDisplay').innerHTML='<div class="displays">'+displayMarkup(ctx)+'</div>';
  q('#testApp').textContent=logo(ctx.app);
  q('#testText').textContent='Probando '+ctx.name+'…';
  q('#keep').textContent=ctx.kind==='mode-preview'||ctx.kind==='saved-mode'?'Activar':ctx.kind==='new-mode'?'Guardar y activar':'Guardar';
  setTestProgress(0);q('#confirm').classList.remove('show');q('#testOverlay').classList.add('open');

  var pct=0;
  progressTimer=setInterval(function(){
    pct+=25;setTestProgress(pct);
    if(pct>=100){
      clearInterval(progressTimer);q('#testText').textContent='Listo';q('#confirm').classList.add('show');
      var left=15;q('#count').textContent=left;
      countdownTimer=setInterval(function(){
        left--;q('#count').textContent=left;
        if(left<=0){
          clearInterval(countdownTimer);
          q('#confirm').classList.remove('show');
          q('#testText').textContent='Restaurando…';
          setTestProgress(100);
          setTimeout(finishRestore,TEST_TIMEOUT_RESTORE_MS);
        }
      },TEST_COUNTDOWN_INTERVAL_MS);
    }
  },TEST_PROGRESS_INTERVAL_MS);
}

q('#keep').onclick=function(){
  clearInterval(countdownTimer);
  var kind=testContext&&testContext.kind;

  if(kind==='display'){
    var s=byId(testContext.id);
    if(s){
      s.preserve=testContext.preserve;
      s.displayIds=testContext.displayIds.slice();
      s.primaryDisplayId=testContext.primaryDisplayId;
      if(s.active)appliedSession=sessionFromMode(s);
    }
    q('#testOverlay').classList.remove('open');
    commitSets();
    render();
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
    expandedOpen=false;
    expandedModeId=null;
    expandedConfig=newModeConfigFromApplied();
    expandedBase=cloneModeConfig(expandedConfig);
    createAutoNamed=true;
    q('#testOverlay').classList.remove('open');
    commitSets();
    render();
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
      edited.preserve=testContext.preserve;
      edited.displayIds=testContext.displayIds.slice();
      edited.primaryDisplayId=testContext.primaryDisplayId;
      edited.app=testContext.app;
      edited.shortcut=testContext.shortcut||'Manual';
      sets.forEach(function(s){s.active=s.id===edited.id});
      appliedSession=sessionFromMode(edited);
      expandedOpen=true;
      expandedModeId=edited.id;
      expandedConfig=cloneModeConfig(edited);
      expandedBase=cloneModeConfig(edited);
    }
    q('#testOverlay').classList.remove('open');
    commitSets();
    render();
    toast(editedName,'Activo');
    testContext=null;
    return;
  }

  if(kind==='mode-preview'){
    sets.forEach(function(s){s.active=s.id===testContext.existingId});
    appliedSession=sessionFromMode(byId(testContext.existingId));
    q('#testOverlay').classList.remove('open');
    commitSets();
    render();
    toast(testContext.name,'Activo después de probar');
    testContext=null;
    return;
  }
};

function finishRestore(){
  q('#testOverlay').classList.remove('open');
  testContext=null;
  renderWorkbench();
  toast('Restaurado','Configuración anterior');
}

q('#revert').onclick=function(){
  clearInterval(countdownTimer);
  q('#confirm').classList.remove('show');
  q('#testText').textContent='Restaurando…';
  setTestProgress(35);
  setTimeout(function(){
    setTestProgress(100);
    setTimeout(finishRestore,MANUAL_RESTORE_FINISH_MS);
  },MANUAL_RESTORE_STEP_MS);
};

document.addEventListener('click',function(e){
  var path=typeof e.composedPath==='function'?e.composedPath():[];
  var insideDisplayPop=path.indexOf(q('#displayPop'))>=0;
  var insideAppPop=path.indexOf(q('#appPop'))>=0;
  var insideDeletePop=path.indexOf(q('#deletePop'))>=0;
  if(!insideDisplayPop&&!insideAppPop&&!insideDeletePop&&!e.target.closest('.quick-display')&&!e.target.closest('.quick-app')&&!e.target.closest('#expandedApp')&&!e.target.closest('.trash-mode')){
    closePops();
  }
});

document.addEventListener('keydown',function(e){
  if(e.key!=='Escape')return;

  if(q('#displayPop').classList.contains('open')||q('#appPop').classList.contains('open')||q('#deletePop').classList.contains('open')){
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
  shellView=viewName;
  closePops();

  qa('.shell-view').forEach(function(view){
    var selected=view.dataset.shellView===shellView;
    view.classList.toggle('active',selected);
    view.hidden=!selected;
  });

  qa('.rail-item').forEach(function(item){
    var selected=item.dataset.navView===shellView;
    item.classList.toggle('active',selected);
    if(selected)item.setAttribute('aria-current','page');
    else item.removeAttribute('aria-current');
  });
  var settingsActive=shellView==='settings';
  q('#settingsBtn').classList.toggle('active',settingsActive);
  if(settingsActive)q('#settingsBtn').setAttribute('aria-current','page');
  else q('#settingsBtn').removeAttribute('aria-current');

  q('.main').scrollTo({top:0,behavior:'auto'});
}

qa('.rail-item').forEach(function(item){
  item.onclick=function(){openShellView(item.dataset.navView)};
});

q('#settingsBtn').onclick=function(){openShellView('settings')};
q('#identifyDisplays').onclick=function(){toast('Pantallas','Identificación simulada')};
q('#advancedDisplays').onclick=function(){toast('Pantallas','Configuración avanzada · prototipo')};
q('#restoreDisplays').onclick=function(){toast('Pantallas','Recuperación simulada')};
q('#advancedSettings').onclick=function(){toast('Avanzado','Diagnóstico y recuperación · prototipo')};

openShellView('modes');
initTheme();
syncTestMode();
commitSets();
render();
