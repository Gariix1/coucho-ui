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
  workspaceChangeCount,
  workspaceEqual
} from './model.js';

import {modeSheetTransition} from './motion.js';

import {toast} from './ui/feedback.js';
import {bindTouchRename,editInlineText} from './ui/inline-edit.js';
import {positionPopover} from './ui/popover.js';
import {initTheme,toggleTheme} from './features/theme.js';

const TEST_MODE_KEY='coucho-test-mode';
const ACTIVATION_DELAY_MS=850;
const TEST_PROGRESS_INTERVAL_MS=340;
const TEST_COUNTDOWN_INTERVAL_MS=1000;
const TEST_TIMEOUT_RESTORE_MS=420;
const DETAIL_CLOSE_DELAY_MS=80;
const MANUAL_RESTORE_STEP_MS=380;
const MANUAL_RESTORE_FINISH_MS=220;

// Persistent mode/session state.
let sets=loadSets();
let appliedSession=null;
let activatingId=null;
let activationTimer=null;

// Workspace editor state.
let workspaceTargetId=null;
let workspaceDraft=null;
let workspaceBase=null;
let workspaceAutoNamed=true;
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
function workspaceFromApplied(){
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

function detailHasUnsavedChanges(){
  return workspaceTargetId!==null&&workspaceDraft&&workspaceBase&&!workspaceEqual(workspaceDraft,workspaceBase);
}

function guardDetailSwitch(nextId){
  if(workspaceTargetId===null||workspaceTargetId===nextId)return true;
  if(!detailHasUnsavedChanges())return true;
  toast('Cambios sin guardar','Guarda o cancela el perfil abierto antes de cambiar');
  q('.visual-workspace').focus({preventScroll:true});
  return false;
}

function appUsage(app){
  var matches=sets.filter(function(mode){return mode.app===app});
  if(matches.length===0)return {text:'Sin usar',empty:true};
  if(matches.length===1)return {text:matches[0].name,empty:false};
  return {text:matches.length+' modos',empty:false};
}

function renderModeStatus(){
  var count=simulatedDisplays.length;
  q('#modeStatus').innerHTML='<span>'+count+' '+(count===1?'pantalla detectada':'pantallas detectadas')+'</span><span>·</span>'+iconMarkup('gamepad')+'<span>conectado</span>';
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

// Modes workbench and workspace editor.
function ensureWorkspace(){
  if(workspaceDraft)return;
  workspaceTargetId=null;
  workspaceDraft=workspaceFromApplied();
  workspaceBase=cloneModeConfig(workspaceDraft);
  workspaceAutoNamed=true;
}

function selectWorkspace(rawId){
  if(rawId==='current'){
    if(workspaceTargetId!==null){
      if(!guardDetailSwitch(null))return;
      closeModeDetail(false);
      return;
    }
    workspaceTargetId=null;
    workspaceDraft=workspaceFromApplied();
    workspaceBase=cloneModeConfig(workspaceDraft);
    workspaceAutoNamed=true;
  }else{
    var mode=byId(Number(rawId));
    if(!mode)return;
    openModeDetail(mode.id,q('[data-mode-row="'+mode.id+'"]'));
    return;
  }
  closePops();
  renderWorkbench();
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

async function openModeDetail(id,source){
  var mode=byId(id);
  if(!mode||modeTransitioning)return false;

  if(workspaceTargetId===id){
    return closeModeDetail(true);
  }

  if(workspaceTargetId!==null){
    if(detailHasUnsavedChanges()){
      toast('Cambios sin guardar','Guarda o cancela el perfil abierto antes de cambiar');
      q('.visual-workspace').focus({preventScroll:true});
      return false;
    }
    await closeModeDetail(false);
    source=q('[data-mode-row="'+id+'"]');
    if(!source)return false;
  }

  closePops();

  var workspace=q('.visual-workspace');
  setModeTransitioning(true);
  var transition=modeSheetTransition.prepare(source,{hold:workspace});

  try{
    workspaceTargetId=mode.id;
    workspaceDraft=cloneModeConfig(mode);
    workspaceBase=cloneModeConfig(mode);
    workspaceAutoNamed=false;
    renderWorkbench();

    workspace=q('.visual-workspace');
    await transition.play(workspace,'open');
  }finally{
    transition.cancel();
    setModeTransitioning(false);
    renderModeList();
  }

  var closeButton=q('#workspaceClose');
  if(closeButton)closeButton.focus();
  return true;
}

async function closeModeDetail(restore,afterClose){
  if(workspaceTargetId===null||modeTransitioning)return false;

  closePops();

  var closingId=workspaceTargetId;
  var workspace=q('.visual-workspace');

  setModeTransitioning(true);
  var transition=modeSheetTransition.prepare(workspace);

  try{
    workspaceTargetId=null;
    workspaceDraft=workspaceFromApplied();
    workspaceBase=cloneModeConfig(workspaceDraft);
    workspaceAutoNamed=true;
    renderWorkbench();

    var destination=q('[data-mode-row="'+closingId+'"]');
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
    var freshSource=q('[data-mode-row="'+closingId+'"]');
    var openButton=freshSource&&freshSource.querySelector('.open-mode');
    if(openButton)openButton.focus();
  }
  return true;
}

function focusOrOpenMode(card){
  if(!card)return;

  var id=Number(card.dataset.modeRow);
  if(!id)return;

  if(workspaceTargetId===id){
    q('.visual-workspace').focus({preventScroll:true});
    return;
  }

  openModeDetail(id,card);
}

function renderModeList(){
  var modeList=q('#modeList');
  if(currentPopAnchor&&modeList&&modeList.contains(currentPopAnchor))closePops();
  var currentSelected=workspaceTargetId===null;

  var sourceContext=appliedSession&&appliedSession.modeId
    ?'<span class="source-context"><small>En uso</small><b>'+esc(appliedSession.name||'Modo')+'</b></span>'
    :'<span class="source-context neutral"><small>Base</small><b>Actual</b></span>';

  var current='<div class="mode-list-group">'+
    '<div class="mode-list-label">Crear desde</div>'+
    '<button class="mode-list-item current'+(currentSelected?' selected':'')+'" data-workspace-id="current">'+
      '<span class="mode-list-icon">'+iconMarkup('display')+'</span>'+
      '<span class="mode-list-copy"><b>Escritorio actual</b><small>'+esc(appliedSession?displaySummary(appliedSession):'Estado actual')+'</small></span>'+
      sourceContext+
    '</button>'+
  '</div>';

  var saved=sets.map(function(mode){
    var selected=workspaceTargetId===mode.id;
    var detailDirty=selected&&detailHasUnsavedChanges();
    var applying=activatingId===mode.id;
    var safeName=esc(mode.name);
    var safeApp=esc(mode.app);
    var safeShortcut=esc(shortcutCardLabel(mode.shortcut));
    var titleId='mode-title-'+mode.id;

    return '<article class="saved-mode-card'+(selected?' selected':'')+'" data-mode-row="'+mode.id+'" aria-labelledby="'+titleId+'">'+
      '<div class="saved-mode-head">'+
        '<div class="saved-mode-name">'+
          '<span class="mode-list-icon">'+modeIconMarkup(mode.icon)+'</span>'+
          '<span class="saved-mode-name-copy"><b class="mode-list-name" id="'+titleId+'">'+safeName+'</b>'+
          '<small>'+(selected?'<span class="mode-editing-badge">'+(mode.active?'Activo · Editando':'Editando')+'</span>':(mode.active?'<span class="mode-list-badge">Activo</span>':'Guardado'))+'</small></span>'+
        '</div>'+
        '<div class="saved-mode-actions">'+
          (!mode.active?'<button class="btn activate" data-id="'+mode.id+'"'+((applying||detailDirty)?' disabled':'')+(applying?' aria-busy="true"':'')+' title="'+(detailDirty?'Prueba o guarda desde el editor':'Activar modo')+'">'+(applying?'…':'Activar')+'</button>':'')+
          '<button class="open-mode" data-id="'+mode.id+'" aria-controls="modeWorkspace" title="'+(selected?'Ir al editor de '+safeName:'Editar '+safeName)+'" aria-label="'+(selected?'Ir al editor de '+safeName:'Editar '+safeName)+'">'+iconMarkup('arrow-right')+'</button>'+
          '<button class="trash-mode" data-id="'+mode.id+'" title="Eliminar" aria-label="Eliminar '+safeName+'">'+iconMarkup('delete')+'</button>'+
        '</div>'+
      '</div>'+
      (selected
        ?'<div class="saved-mode-editing"><div><b>Abierto en el editor</b></div></div>'
        :'<div class="saved-mode-body">'+
          '<button class="card-display quick-display" data-id="'+mode.id+'" title="Editar pantallas">'+
            '<span class="card-screen-row"><span class="displays card-displays">'+displayMarkup(mode)+'</span>'+
            '<span class="screen-count"><small>Pantallas</small>'+esc(displayCountLabel(mode))+'</span></span>'+
          '</button>'+
          '<div class="card-facts">'+
            '<button class="card-fact quick-app" data-id="'+mode.id+'" title="Cambiar app"><span class="fact-icon">'+iconMarkup('play')+'</span><span class="fact-copy"><small>App</small><b>'+safeApp+'</b></span></button>'+
            '<button class="card-fact quick-shortcut" data-id="'+mode.id+'" title="Cambiar atajo"><span class="fact-icon">'+iconMarkup('gamepad')+'</span><span class="fact-copy"><small>Atajo</small><b>'+safeShortcut+'</b></span></button>'+
          '</div>'+
        '</div>')+
    '</article>';
  }).join('');

  q('#modeList').innerHTML=current+
    '<div class="mode-list-group"><div class="mode-list-label">Tus modos</div>'+
    (saved||'<div class="mode-list-empty">Aún no has guardado modos.</div>')+
    '</div>';

  qa('[data-workspace-id]').forEach(function(el){
    el.onclick=function(){selectWorkspace(el.dataset.workspaceId)};
  });

  qa('#modeList .saved-mode-card').forEach(function(card){
    card.onclick=function(event){
      if(event.target.closest('button,a,input,select,textarea,[contenteditable="true"]'))return;

      var selection=window.getSelection&&window.getSelection();
      if(selection&&String(selection).trim())return;

      focusOrOpenMode(card);
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
      focusOrOpenMode(q('[data-mode-row="'+button.dataset.id+'"]'));
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

function renderWorkspaceScreens(){
  var ordered=simulatedDisplays.slice().sort(function(a,b){
    var al=a.layout&&a.layout.left!=null?a.layout.left:a.number;
    var bl=b.layout&&b.layout.left!=null?b.layout.left:b.number;
    return al-bl;
  });

  q('#workspaceScreens').innerHTML=ordered.map(function(d){
    var selected=workspaceDraft.displayIds.indexOf(d.id)>=0;
    var primary=selected&&workspaceDraft.primaryDisplayId===d.id;
    return '<div class="workspace-display '+(selected?'on':'off')+(primary?' primary':'')+'" data-display-layout="'+d.id+'">'+
      '<button class="workspace-display-screen" data-workspace-display="'+d.id+'" aria-pressed="'+(selected?'true':'false')+'" title="'+(selected?'Apagar ':'Activar ')+esc(d.name)+'">'+
        '<span class="workspace-display-state">'+(selected?'Activa':'Apagada')+'</span>'+
        '<span class="workspace-display-number">'+d.number+'</span>'+
      '</button>'+
      '<button class="workspace-display-primary" data-workspace-primary="'+d.id+'" aria-pressed="'+(primary?'true':'false')+'" title="'+(primary?'Pantalla principal':'Hacer principal')+'" aria-label="'+(primary?d.name+' es principal':'Hacer '+d.name+' principal')+'">'+iconMarkup(primary?'star-filled':'star')+'</button>'+
      '<div class="workspace-display-info">'+
        '<div class="workspace-display-copy"><b>'+esc(d.name)+'</b><small>'+esc(d.model)+'</small></div>'+
        '<div class="workspace-display-tech">'+esc(d.resolution)+'<br>'+esc(d.hz)+'</div>'+
      '</div>'+
    '</div>';
  }).join('');

  qa('[data-display-layout]').forEach(function(el){
    var display=getDisplay(el.dataset.displayLayout);
    var layout=display&&display.layout?display.layout:{width:28,aspect:1.78};
    setCssVars(el,{
      '--display-width':layout.width,
      '--display-aspect':layout.aspect
    });
  });

  qa('[data-workspace-display]').forEach(function(b){
    b.onclick=function(){toggleWorkspaceDisplay(b.dataset.workspaceDisplay)};
  });
  qa('[data-workspace-primary]').forEach(function(b){
    b.onclick=function(){makeWorkspacePrimary(b.dataset.workspacePrimary)};
  });
}

function renderWorkspaceEditor(){
  ensureWorkspace();
  renderWorkspaceScreens();

  var isNew=workspaceTargetId===null;
  var changeCount=workspaceChangeCount(workspaceDraft,workspaceBase);
  var dirty=changeCount>0;
  var changeLabel=changeCount===1?'1 cambio':changeCount+' cambios';
  var baseDisplays=displaySummary(workspaceBase);

  q('.visual-workspace').classList.toggle('create-mode',isNew);
  q('.visual-workspace').classList.toggle('detail-mode',!isNew);
  q('#workspaceProfileIcon').innerHTML=modeIconMarkup(workspaceDraft.icon);
  q('#workspaceEyebrow').textContent=isNew?'Crear modo':'Editando';
  q('#workspaceName').textContent=workspaceDraft.name;
  q('#workspaceSub').textContent=dirty?changeLabel+' sin guardar':'';
  q('#workspaceScreenTitle').textContent='Pantallas';
  q('#workspaceScreenMeta').textContent=isNew?'Base: '+baseDisplays:'';
  q('#workspaceAppName').textContent=workspaceDraft.app;
  q('#workspaceShortcutName').textContent=shortcutCardLabel(workspaceDraft.shortcut);
  q('#workspaceState').textContent=dirty?changeLabel:(isNew?'Borrador':'Guardado');
  q('#workspaceState').classList.toggle('dirty',dirty);
  q('#workspaceReset').hidden=false;
  q('#workspaceReset').disabled=isNew&&!dirty;
  q('#workspaceReset').textContent=isNew?'Restablecer':'Cancelar';
  q('#workspaceReset').title=isNew?'Volver al estado del escritorio actual':'Descartar cambios sin guardar';
  q('#workspaceSave').textContent=isNew?'Crear modo':'Guardar';
  q('#workspaceSave').disabled=!isNew&&!dirty;
  q('#workspaceClose').hidden=isNew;
  q('#workspaceClose').title=!isNew&&dirty?'Descartar y cerrar':'Cerrar';
  q('#workspaceClose').setAttribute('aria-label',q('#workspaceClose').title);
}

function refreshWorkspaceDraft(){
  renderWorkspaceEditor();
  renderModeList();
}

function renderWorkbench(){
  ensureWorkspace();
  renderModeList();
  renderWorkspaceEditor();
}

function render(){
  ensureAppliedSession();
  renderModeStatus();
  renderResourceViews();
  renderDisplayOverview();
  ensureWorkspace();
  renderWorkbench();
}

function toggleWorkspaceDisplay(id){
  if(!workspaceDraft)return;
  workspaceDraft.preserve=false;
  var index=workspaceDraft.displayIds.indexOf(id);
  if(index>=0){
    if(workspaceDraft.displayIds.length===1){
      toast('Pantallas','Debe quedar al menos una activa');
      return;
    }
    workspaceDraft.displayIds.splice(index,1);
    if(workspaceDraft.primaryDisplayId===id)workspaceDraft.primaryDisplayId=workspaceDraft.displayIds[0]||null;
  }else{
    workspaceDraft.displayIds.push(id);
    if(!workspaceDraft.primaryDisplayId)workspaceDraft.primaryDisplayId=id;
  }
  refreshWorkspaceDraft();
}

function makeWorkspacePrimary(id){
  if(!workspaceDraft)return;
  workspaceDraft.preserve=false;
  if(workspaceDraft.displayIds.indexOf(id)<0)workspaceDraft.displayIds.push(id);
  workspaceDraft.primaryDisplayId=id;
  refreshWorkspaceDraft();
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

  if(workspaceTargetId===id){
    workspaceTargetId=null;
    workspaceDraft=workspaceFromApplied();
    workspaceBase=cloneModeConfig(workspaceDraft);
    workspaceAutoNamed=true;
    q('.visual-workspace').classList.remove('detail-mode');
  }
  commitSets();
  render();
  toast('Modo eliminado',removed.name);
}

function activate(id){
  var target=byId(id);
  if(!target||target.active||activatingId!==null)return;

  activatingId=id;
  clearTimeout(activationTimer);
  renderModeList();

  activationTimer=setTimeout(function(){
    var current=byId(id);
    if(!current){
      activatingId=null;
      activationTimer=null;
      renderModeList();
      return;
    }

    sets.forEach(function(s){s.active=s.id===id});
    appliedSession=sessionFromMode(current);
    commitSets();

    if(workspaceTargetId===null){
      workspaceDraft=workspaceFromApplied();
      workspaceBase=cloneModeConfig(workspaceDraft);
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
  var deletingOpenDirty=workspaceTargetId===mode.id&&detailHasUnsavedChanges();
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
  if(workspaceTargetId===displayEditModeId){
    toast('Editando','Cambia las pantallas desde el editor');
    return;
  }
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
  if(workspaceTargetId===appEditTarget.id){
    toast('Editando','Cambia la app desde el editor');
    return;
  }
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

    if(target.kind==='workspace'){
      workspaceDraft.app=app;
      if(workspaceTargetId===null&&workspaceAutoNamed){
        var wm=autoMeta(app);
        workspaceDraft.name=app==='Ninguna'?'Nuevo modo':wm.name;
        workspaceDraft.icon=wm.icon;
      }
      refreshWorkspaceDraft();
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

q('#workspaceClose').onclick=function(){closeModeDetail(true)};

q('#workspaceApp').onclick=function(e){
  closePops();
  appEditTarget={kind:'workspace'};
  qa('#appPop .app-option').forEach(function(x){
    var selected=x.dataset.app===workspaceDraft.app;
    x.classList.toggle('selected',selected);
    x.setAttribute('aria-pressed',selected?'true':'false');
  });
  openAnchoredPop(q('#appPop'),e.currentTarget);
};

q('#workspaceShortcut').onclick=function(){openShortcut('workspace')};

q('#workspaceReset').onclick=function(){
  if(workspaceTargetId!==null){
    closeModeDetail(true);
    return;
  }
  workspaceDraft=cloneModeConfig(workspaceBase);
  refreshWorkspaceDraft();
};

q('#workspaceSave').onclick=function(){
  if(!workspaceDraft)return;

  if(workspaceTargetId===null){
    var created=cloneModeConfig(workspaceDraft);
    created.id=Date.now();
    created.active=false;
    sets.push(created);
    commitSets();
    workspaceTargetId=null;
    workspaceDraft=workspaceFromApplied();
    workspaceBase=cloneModeConfig(workspaceDraft);
    workspaceAutoNamed=true;
    render();
    toast(created.name,'Modo creado');
    requestAnimationFrame(function(){
      var card=q('[data-mode-row="'+created.id+'"]');
      if(card)card.scrollIntoView({behavior:'smooth',block:'nearest'});
    });
    return;
  }

  var mode=byId(workspaceTargetId);
  if(!mode)return;
  mode.name=workspaceDraft.name;
  mode.icon=workspaceDraft.icon;
  mode.preserve=workspaceDraft.preserve;
  mode.displayIds=workspaceDraft.displayIds.slice();
  mode.primaryDisplayId=workspaceDraft.primaryDisplayId;
  mode.app=workspaceDraft.app;
  mode.shortcut=workspaceDraft.shortcut;
  workspaceBase=cloneModeConfig(mode);
  commitSets();
  renderModeList();
  toast(mode.name,'Cambios guardados');
  closeModeDetail(true);
};

q('#workspaceTest').onclick=function(){
  if(!workspaceDraft)return;
  startTest({
    kind:workspaceTargetId===null?'workspace-new':'workspace-edit',
    existingId:workspaceTargetId,
    preserve:workspaceDraft.preserve,
    displayIds:workspaceDraft.displayIds.slice(),
    primaryDisplayId:workspaceDraft.primaryDisplayId,
    app:workspaceDraft.app,
    shortcut:workspaceDraft.shortcut,
    name:workspaceDraft.name,
    icon:workspaceDraft.icon
  });
};

// Workspace actions and shortcut capture.
function beginWorkspaceRename(){
  var el=q('#workspaceName');
  if(!el||el.isContentEditable)return;
  var original=workspaceDraft.name;
  editInlineText(el,original,function(next){
    workspaceDraft.name=next;
    workspaceAutoNamed=false;
    refreshWorkspaceDraft();
  });
}

q('#workspaceName').ondblclick=function(e){e.preventDefault();beginWorkspaceRename()};
q('#workspaceName').onkeydown=function(e){
  if(q('#workspaceName').isContentEditable)return;
  if(e.key==='F2'||e.key==='Enter'){e.preventDefault();beginWorkspaceRename()}
};
bindTouchRename(q('#workspaceName'),beginWorkspaceRename);

q('#clearModes').onclick=function(){
  sets=[];
  appliedSession=null;
  workspaceTargetId=null;
  workspaceDraft=null;
  workspaceBase=null;
  q('.visual-workspace').classList.remove('detail-mode');
  commitSets();
  render();
  toast('Modos vaciados','Ya puedes probar el flujo desde cero');
};

q('#restoreDemo').onclick=function(){
  sets=demoSets();
  appliedSession=null;
  workspaceTargetId=null;
  workspaceDraft=null;
  workspaceBase=null;
  q('.visual-workspace').classList.remove('detail-mode');
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
  shortcutEditTarget=rawId==='workspace'
    ?{kind:'workspace'}
    :{kind:'mode',id:resolveId(rawId)};

  if(shortcutEditTarget.kind==='mode'&&workspaceTargetId===shortcutEditTarget.id){
    shortcutEditTarget=null;
    toast('Editando','Cambia el atajo desde el editor');
    return;
  }
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

  if(target.kind==='workspace'){
    workspaceDraft.shortcut='Manual';
    closeShortcutOverlay();
    refreshWorkspaceDraft();
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

  if(target.kind==='workspace'){
    workspaceDraft.shortcut=value;
    closeShortcutOverlay();
    refreshWorkspaceDraft();
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
  q('#keep').textContent=ctx.kind==='mode-preview'?'Activar':ctx.kind==='workspace-new'?'Guardar y activar':ctx.kind==='workspace-edit'?'Guardar y activar':'Guardar';
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

  if(kind==='workspace-new'){
    var created={
      id:Date.now(),name:testContext.name,icon:testContext.icon,
      preserve:testContext.preserve,displayIds:testContext.displayIds.slice(),
      primaryDisplayId:testContext.primaryDisplayId,app:testContext.app,
      shortcut:testContext.shortcut||'Manual',active:true
    };
    sets.forEach(function(s){s.active=false});
    sets.push(created);
    appliedSession=sessionFromMode(created);
    workspaceTargetId=null;
    workspaceDraft=workspaceFromApplied();
    workspaceBase=cloneModeConfig(workspaceDraft);
    workspaceAutoNamed=true;
    q('#testOverlay').classList.remove('open');
    commitSets();
    render();
    toast(created.name,'Guardado y activo');
    testContext=null;
    return;
  }

  if(kind==='workspace-edit'){
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
      workspaceTargetId=edited.id;
      workspaceDraft=cloneModeConfig(edited);
      workspaceBase=cloneModeConfig(edited);
    }
    q('#testOverlay').classList.remove('open');
    commitSets();
    renderModeList();
    toast(editedName,'Guardado y activo');
    testContext=null;
    setTimeout(function(){closeModeDetail(true)},DETAIL_CLOSE_DELAY_MS);
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
  if(!insideDisplayPop&&!insideAppPop&&!insideDeletePop&&!e.target.closest('.quick-display')&&!e.target.closest('.quick-app')&&!e.target.closest('#workspaceApp')&&!e.target.closest('.trash-mode')){
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

  if(workspaceTargetId!==null){
    closeModeDetail(true);
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
