(function(){
  var simulatedDisplays=[
    {id:'tv',number:1,name:'TV Sala',model:'LG OLED42C3',resolution:'3840 × 2160',hz:'120 Hz',detail:'3840 × 2160 · 120 Hz',kind:'tv',layout:{left:4,top:34,width:31,aspect:1.78}},
    {id:'main',number:2,name:'Monitor 1',model:'LG 27GP850-B',resolution:'2560 × 1440',hz:'165 Hz',detail:'2560 × 1440 · 165 Hz',kind:'monitor',layout:{left:37,top:22,width:28,aspect:1.78}},
    {id:'aux',number:3,name:'Monitor 2',model:'Dell P2422H',resolution:'1920 × 1080',hz:'75 Hz',detail:'1920 × 1080 · 75 Hz',kind:'monitor',layout:{left:67,top:38,width:25,aspect:1.78}}
  ];

  function demoSets(){
    return [
      {id:1,name:'Gaming',icon:'gaming',preserve:false,displayIds:['tv','main'],primaryDisplayId:'tv',app:'Steam',shortcut:'Guide + A',active:true},
      {id:2,name:'Películas',icon:'movies',preserve:false,displayIds:['tv'],primaryDisplayId:'tv',app:'Plex',shortcut:'Manual',active:false},
      {id:3,name:'Escritorio',icon:'desktop',preserve:false,displayIds:['main','aux'],primaryDisplayId:'main',app:'Ninguna',shortcut:'Manual',active:false}
    ];
  }

  function normalizeIconKey(icon){
    if(icon==='gaming'||icon==='movies'||icon==='desktop')return icon;
    if(icon==='🎮')return 'gaming';
    if(icon==='🎬')return 'movies';
    return 'desktop';
  }

  function migrateSet(s){
    if(Array.isArray(s.displayIds)){
      return Object.assign({preserve:false,primaryDisplayId:s.displayIds[0]||null},s,{icon:normalizeIconKey(s.icon)});
    }
    var ids=s.mode==='tv'?['tv']:s.mode==='monitor'?['main']:s.mode==='preserve'?[]:['tv','main'];
    return Object.assign({},s,{
      preserve:s.mode==='preserve',
      displayIds:ids,
      primaryDisplayId:ids[0]||null,
      icon:normalizeIconKey(s.icon)
    });
  }

  function loadSets(){
    try{
      var saved=localStorage.getItem('coucho-test-sets');
      if(saved!==null){
        var parsed=JSON.parse(saved);
        if(Array.isArray(parsed)) return parsed.map(migrateSet);
      }
    }catch(_){}
    return demoSets();
  }

  var sets=loadSets();

  var displayEditModeId=null;
  var appEditTarget=null;
  var shortcutEditTarget=null;
  var deleteTarget=null;
  var captured=null;
  var displayDraft=null;
  var testContext=null;
  var progressTimer=null;
  var countdownTimer=null;
  var activationTimer=null;
  var activatingId=null;
  var appliedSession=null;
  var workspaceTargetId=null;
  var workspaceDraft=null;
  var workspaceBase=null;
  var workspaceAutoNamed=true;
  var modeTransitioning=false;

  var savedTheme=localStorage.getItem('coucho-theme');
  var initialTheme=savedTheme==='light'||savedTheme==='dark'?savedTheme:'dark';
  document.documentElement.dataset.theme=initialTheme;

  function q(s){return document.querySelector(s)}
  function qa(s){return Array.prototype.slice.call(document.querySelectorAll(s))}
  function esc(value){
    return String(value==null?'':value)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }
  function byId(id){return sets.find(function(x){return x.id===id})||null}
  function active(){return sets.find(function(x){return x.active})||null}
  function resolveId(raw){
    var a=active();
    return raw==='active'?(a?a.id:null):Number(raw);
  }
  function saveSets(){
    localStorage.setItem('coucho-test-sets',JSON.stringify(sets));
  }
  function commitSets(){
    normalizeActive();
    saveSets();
  }
  function normalizeActive(){
    var kept=false;
    sets.forEach(function(s){
      if(s.active&&!kept){kept=true;return}
      if(s.active)s.active=false;
    });
  }
  function iconMarkup(name,extraClass){
    var cls='ui-icon'+(extraClass?' '+extraClass:'');
    return '<svg class="'+cls+'" aria-hidden="true"><use href="#icon-'+name+'"></use></svg>';
  }
  function modeIconMarkup(key){
    var map={gaming:'gamepad',movies:'film',desktop:'desktop'};
    return iconMarkup(map[normalizeIconKey(key)]||'desktop');
  }
  function logo(app){return app==='Ninguna'?'—':app.charAt(0).toUpperCase()}
  function autoMeta(app){
    if(app==='Plex') return {name:'Películas',icon:'movies'};
    if(app==='Ninguna') return {name:'Escritorio',icon:'desktop'};
    return {name:'Gaming',icon:'gaming'};
  }
  function getDisplay(id){
    return simulatedDisplays.find(function(d){return d.id===id});
  }
  function displayConfig(source){
    return {
      preserve:!!source.preserve,
      displayIds:Array.isArray(source.displayIds)?source.displayIds.slice():[],
      primaryDisplayId:source.primaryDisplayId||null
    };
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
  function cloneModeConfig(source){
    return {
      id:source.id==null?null:source.id,
      name:source.name||'Escritorio',
      icon:normalizeIconKey(source.icon),
      preserve:!!source.preserve,
      displayIds:Array.isArray(source.displayIds)?source.displayIds.slice():[],
      primaryDisplayId:source.primaryDisplayId||null,
      app:source.app||'Ninguna',
      shortcut:source.shortcut||'Manual'
    };
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

  function workspaceEqual(a,b){
    if(!a||!b)return false;
    if(a.name!==b.name||a.icon!==b.icon||a.app!==b.app||a.shortcut!==b.shortcut||!!a.preserve!==!!b.preserve||a.primaryDisplayId!==b.primaryDisplayId)return false;
    return a.displayIds.slice().sort().join('|')===b.displayIds.slice().sort().join('|');
  }

  function workspaceChangeCount(a,b){
    if(!a||!b)return 0;
    var count=0;
    if(a.name!==b.name||a.icon!==b.icon)count++;
    if(a.app!==b.app)count++;
    if(a.shortcut!==b.shortcut)count++;

    var displaysChanged=!!a.preserve!==!!b.preserve||
      a.primaryDisplayId!==b.primaryDisplayId||
      a.displayIds.slice().sort().join('|')!==b.displayIds.slice().sort().join('|');
    if(displaysChanged)count++;
    return count;
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

  function displaySummary(source){
    if(source.preserve)return 'No cambiar pantallas';
    var ids=Array.isArray(source.displayIds)?source.displayIds:[];
    var names=ids.map(function(id){var d=getDisplay(id);return d?d.name:id});
    if(names.length===0)return 'Sin pantallas';
    if(names.length===1)return names[0];
    if(names.length===2)return names.join(' + ');
    return names.length+' pantallas';
  }
  function displayMarkup(source){
    if(source.preserve)return '<div class="display-placeholder preserve">↔</div>';
    var ids=Array.isArray(source.displayIds)?source.displayIds:[];
    if(ids.length===0)return '<div class="display-placeholder empty">—</div>';
    return ids.map(function(id){
      var d=getDisplay(id);
      if(!d)return '';
      var cls=d.kind==='tv'?'tv':'pc';
      var primary=id===source.primaryDisplayId?' primary':'';
      var star=id===source.primaryDisplayId?'<span class="monitor-star">'+iconMarkup('star-filled')+'</span>':'';
      return '<div class="monitor '+cls+primary+'" title="'+esc(d.name)+'">'+star+'</div>';
    }).join('');
  }
  function shortcutLabel(v){return v==='Manual'?'Añadir':v}
  function shortcutCardLabel(v){return v==='Manual'?'Sin atajo':v}
  function displayCountLabel(source){
    if(source.preserve)return 'No cambia pantallas';
    var count=Array.isArray(source.displayIds)?source.displayIds.length:0;
    return count===1?'1 pantalla':count+' pantallas';
  }
  function shortcutMarkup(v){
    if(v==='Manual') return '<span style="color:var(--muted)">Sin atajo</span>';
    var p=v.split(' + ');
    return '<span class="key">'+p[0]+'</span><span>+</span><span class="key round">'+p[1]+'</span>';
  }
  function toast(t,s){
    q('#toastTitle').textContent=t;q('#toastText').textContent=s;q('#toast').classList.add('show');
    clearTimeout(window._toast);window._toast=setTimeout(function(){q('#toast').classList.remove('show')},2100);
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

  var ModeSheetTransition=(function(){
    var duration=300;

    function reduced(){
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    function rectOf(el){
      return el&&el.isConnected?el.getBoundingClientRect():null;
    }

    function usable(rect){
      return rect&&rect.width>0&&rect.height>0&&
        rect.bottom>32&&rect.top<window.innerHeight&&rect.right>0&&rect.left<window.innerWidth;
    }

    async function travel(from,to,direction){
      if(reduced()||!usable(from)||!usable(to))return;

      var sheet=document.createElement('div');
      sheet.className='mode-flight-sheet';
      sheet.setAttribute('aria-hidden','true');
      document.body.appendChild(sheet);

      var start=from;
      var finish=to;
      var startShadow=direction==='close'
        ?'8px 8px 0 -1px rgba(17,24,40,.12), 0 20px 48px rgba(0,0,0,.16)'
        :'0 8px 22px rgba(0,0,0,.12)';
      var finishShadow=direction==='close'
        ?'0 8px 22px rgba(0,0,0,.12)'
        :'8px 8px 0 -1px rgba(17,24,40,.12), 0 20px 48px rgba(0,0,0,.16)';

      try{
        if(typeof sheet.animate!=='function')return;
        var animation=sheet.animate([
          {
            left:start.left+'px',top:start.top+'px',
            width:start.width+'px',height:start.height+'px',
            boxShadow:startShadow,opacity:1
          },
          {
            left:finish.left+'px',top:finish.top+'px',
            width:finish.width+'px',height:finish.height+'px',
            boxShadow:finishShadow,opacity:1
          }
        ],{
          duration:duration,
          easing:'cubic-bezier(.2,.8,.2,1)',
          fill:'both'
        });

        await animation.finished.catch(function(){});
      }finally{
        sheet.remove();
      }
    }

    return {
      rectOf:rectOf,
      travel:travel
    };
  })();

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
    var from=ModeSheetTransition.rectOf(source);
    var workspace=q('.visual-workspace');

    setModeTransitioning(true);
    try{
      workspaceTargetId=mode.id;
      workspaceDraft=cloneModeConfig(mode);
      workspaceBase=cloneModeConfig(mode);
      workspaceAutoNamed=false;
      renderWorkbench();

      workspace=q('.visual-workspace');
      var to=ModeSheetTransition.rectOf(workspace);
      await ModeSheetTransition.travel(from,to,'open');
    }finally{
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
    var destination=q('[data-mode-row="'+closingId+'"]');
    var from=ModeSheetTransition.rectOf(workspace);
    var to=ModeSheetTransition.rectOf(destination);

    setModeTransitioning(true);
    try{
      await ModeSheetTransition.travel(from,to,'close');

      workspaceTargetId=null;
      workspaceDraft=workspaceFromApplied();
      workspaceBase=cloneModeConfig(workspaceDraft);
      workspaceAutoNamed=true;
      renderWorkbench();
    }finally{
      setModeTransitioning(false);
    }

    if(typeof afterClose==='function'){
      afterClose();
      return true;
    }

    if(restore){
      var freshSource=q('[data-mode-row="'+closingId+'"]');
      var view=freshSource&&freshSource.querySelector('.view-mode');
      if(view)view.focus();
    }
    return true;
  }

  function renderModeList(){
    var modeList=q('#modeList');
    if(currentPopAnchor&&modeList&&modeList.contains(currentPopAnchor))closePops();
    var currentSelected=workspaceTargetId===null;

    var current='<div class="mode-list-group">'+
      '<div class="mode-list-label">Crear desde</div>'+
      '<button class="mode-list-item current'+(currentSelected?' selected':'')+'" data-workspace-id="current">'+
        '<span class="mode-list-icon">'+iconMarkup('display')+'</span>'+
        '<span class="mode-list-copy"><b>Escritorio actual</b><small>'+esc(appliedSession?displaySummary(appliedSession):'Estado actual')+'</small></span>'+
        '<span></span>'+
      '</button>'+
    '</div>';

    var saved=sets.map(function(mode){
      var selected=workspaceTargetId===mode.id;
      var detailDirty=selected&&detailHasUnsavedChanges();
      var applying=activatingId===mode.id;
      var safeName=esc(mode.name);
      var safeApp=esc(mode.app);
      var safeShortcut=esc(shortcutCardLabel(mode.shortcut));

      return '<article class="saved-mode-card'+(selected?' selected':'')+'" data-mode-row="'+mode.id+'">'+

        '<div class="saved-mode-head">'+
          '<div class="saved-mode-name">'+
            '<span class="mode-list-icon">'+modeIconMarkup(mode.icon)+'</span>'+
            '<span class="saved-mode-name-copy"><b class="mode-list-name" data-id="'+mode.id+'" tabindex="'+(selected?'-1':'0')+'" data-locked="'+(selected?'true':'false')+'" title="'+(selected?'Renombra desde el perfil abierto':'Doble clic, F2 o toca para renombrar')+'">'+safeName+'</b>'+
            '<small>'+(selected?'<span class="mode-editing-badge">'+(mode.active?'Activo · Editando':'Editando')+'</span>':(mode.active?'<span class="mode-list-badge">Activo</span>':'Guardado'))+'</small></span>'+
          '</div>'+
          '<div class="saved-mode-actions">'+
            (!mode.active?'<button class="btn activate" data-id="'+mode.id+'"'+((applying||detailDirty)?' disabled':'')+(applying?' aria-busy="true"':'')+' title="'+(detailDirty?'Prueba o guarda desde el perfil abierto':'Activar modo')+'">'+(applying?'…':'Activar')+'</button>':'')+
            '<button class="btn view-mode" data-id="'+mode.id+'" aria-controls="modeWorkspace" aria-expanded="'+(selected?'true':'false')+'" title="'+(selected?'Cerrar detalle':'Abrir detalle')+'">'+(selected?'Cerrar':'Ver')+'</button>'+
            '<button class="trash-mode" data-id="'+mode.id+'" title="Eliminar" aria-label="Eliminar '+safeName+'">'+iconMarkup('delete')+'</button>'+
          '</div>'+
        '</div>'+
        (selected
          ?'<div class="saved-mode-editing"><div><b>Editando</b></div></div>'
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
    qa('#modeList .activate').forEach(function(b){
      b.onclick=function(e){e.stopPropagation();activate(Number(b.dataset.id))};
    });
    qa('#modeList .view-mode').forEach(function(b){
      b.onclick=function(e){e.stopPropagation();openModeDetail(Number(b.dataset.id),q('[data-mode-row="'+b.dataset.id+'"]'))};
    });
    qa('#modeList .trash-mode').forEach(function(b){
      b.onclick=function(e){e.stopPropagation();openDeletePop(e.currentTarget,b.dataset.id)};
    });
    qa('#modeList .quick-display').forEach(function(b){
      b.onclick=function(e){openDisplayPop(e.currentTarget,b.dataset.id)};
    });
    qa('#modeList .quick-app').forEach(function(b){
      b.onclick=function(e){openAppPop(e.currentTarget,b.dataset.id)};
    });
    qa('#modeList .quick-shortcut').forEach(function(b){
      b.onclick=function(){openShortcut(b.dataset.id)};
    });
    qa('#modeList .mode-list-name').forEach(function(el){
      if(el.dataset.locked==='true')return;
      el.ondblclick=function(e){e.preventDefault();beginModeRename(el,el.dataset.id)};
      el.onkeydown=function(e){
        if(el.isContentEditable)return;
        if(e.key==='F2'||e.key==='Enter'){e.preventDefault();beginModeRename(el,el.dataset.id)}
      };
      bindTouchRename(el,function(){beginModeRename(el,el.dataset.id)});
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
      var layout=d.layout||{width:28,aspect:1.78};

      return '<div class="workspace-display '+(selected?'on':'off')+(primary?' primary':'')+'" style="--width:'+layout.width+';--aspect:'+layout.aspect+'">'+
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
    }).join('')+
    '<div class="workspace-canvas-legend">Izquierda → derecha · resolución y Hz solo informativos</div>';

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
    q('#workspaceHelp').innerHTML='Selecciona para activar · '+iconMarkup('star')+' principal';
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
    },850);
  }

  var currentPop=null;
  var currentPopAnchor=null;

  function positionPop(pop,anchor){
    if(!pop||!anchor||!anchor.isConnected)return;

    var margin=12;
    var gap=8;
    var viewportTop=32+margin;
    var viewportBottom=window.innerHeight-margin;
    var r=anchor.getBoundingClientRect();
    var popWidth=pop.offsetWidth;
    var popHeight=pop.offsetHeight;

    if(r.bottom<viewportTop||r.top>viewportBottom){
      closePops();
      return;
    }

    var below=r.bottom+gap;
    var above=r.top-gap-popHeight;
    var top;

    if(below+popHeight<=viewportBottom){
      top=below;
    }else if(above>=viewportTop){
      top=above;
    }else{
      top=Math.max(viewportTop,Math.min(viewportBottom-popHeight,below));
    }

    var centeredLeft=r.left+r.width/2-popWidth/2;
    var left=Math.max(margin,Math.min(window.innerWidth-popWidth-margin,centeredLeft));

    pop.style.top=Math.round(top)+'px';
    pop.style.left=Math.round(left)+'px';
  }

  function openAnchoredPop(pop,anchor){
    if(!pop||!anchor||!anchor.isConnected)return false;
    currentPop=pop;
    currentPopAnchor=anchor;
    pop.classList.add('open');
    positionPop(pop,anchor);
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
    positionPop(currentPop,currentPopAnchor);
  }

  window.addEventListener('resize',syncOpenPopPosition);
  q('.main').addEventListener('scroll',syncOpenPopPosition,{passive:true});

  function editInlineText(el,initial,onCommit){
    if(!el||el.isContentEditable)return;

    var finished=false;
    el.contentEditable='true';
    el.textContent=initial;
    el.focus();

    var range=document.createRange();
    range.selectNodeContents(el);
    var selection=window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    function finish(commit){
      if(finished)return;
      finished=true;
      var next=el.textContent.trim();
      el.contentEditable='false';
      el.removeEventListener('blur',onBlur);
      el.removeEventListener('keydown',onKey);

      if(commit&&next){
        el.textContent=next;
        onCommit(next);
      }else{
        el.textContent=initial;
      }
    }

    function onBlur(){finish(true)}
    function onKey(e){
      if(e.key==='Enter'){
        e.preventDefault();
        e.stopPropagation();
        finish(true);
      }else if(e.key==='Escape'){
        e.preventDefault();
        e.stopPropagation();
        finish(false);
      }
    }

    el.addEventListener('blur',onBlur);
    el.addEventListener('keydown',onKey);
  }

  function bindTouchRename(el,rename){
    if(!el)return;

    var gesture=null;

    el.addEventListener('pointerdown',function(e){
      if(e.pointerType==='mouse'||el.isContentEditable)return;
      gesture={x:e.clientX,y:e.clientY,time:Date.now(),pointerId:e.pointerId};
    });

    el.addEventListener('pointercancel',function(){
      gesture=null;
    });

    el.addEventListener('pointerup',function(e){
      if(!gesture||gesture.pointerId!==e.pointerId||el.isContentEditable){
        gesture=null;
        return;
      }

      var dx=e.clientX-gesture.x;
      var dy=e.clientY-gesture.y;
      var moved=Math.sqrt(dx*dx+dy*dy);
      var elapsed=Date.now()-gesture.time;
      gesture=null;

      // A deliberate tap, not a scroll/drag or long press.
      if(moved<=8&&elapsed<=650){
        e.preventDefault();
        rename();
      }
    });
  }

  function beginModeRename(el,rawId){
    var id=resolveId(rawId);
    var mode=byId(id);
    if(!mode)return;
    if(workspaceTargetId===id){
      toast('Editando','Renombra desde el editor');
      return;
    }

    var original=mode.name;
    editInlineText(el,original,function(next){
      mode.name=next;
      if(appliedSession&&appliedSession.modeId===mode.id)appliedSession.name=next;
      commitSets();
      renderResourceViews();
      renderDisplayOverview();
      if(next!==original)toast(next,'Nombre actualizado');
    });
  }

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

  function renderDisplayOverview(){
    var session=appliedSession;
    var mode=active();
    var stage=q('#displayOverviewStage');
    if(!stage)return;

    if(!session){
      stage.innerHTML='<div class="empty-state"><div><div class="empty-icon">▦</div><h3>Sin sesión aplicada</h3><p>Activa o prueba un modo para ver el estado de tus pantallas.</p></div></div>';
      q('#displayStateMode').textContent='—';
      q('#displayStateIcon').textContent='▦';
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

  function syncThemeControl(){
    var light=document.documentElement.dataset.theme==='light';
    q('#themeValue').textContent=light?'Claro':'Oscuro';
  }

  function toggleTheme(){
    var next=document.documentElement.dataset.theme==='light'?'dark':'light';
    document.documentElement.dataset.theme=next;
    localStorage.setItem('coucho-theme',next);
    syncThemeControl();
  }

  q('#settingsTheme').onclick=toggleTheme;

  var testMode=localStorage.getItem('coucho-test-mode')==='1';
  function syncTestMode(){
    document.body.classList.toggle('test-mode',testMode);
    q('#testBtn').classList.toggle('active',testMode);
    q('#testBtn').title=testMode?'Salir del modo de prueba':'Modo de prueba';
    q('#testBtn').setAttribute('aria-label',q('#testBtn').title);
  }

  q('#testBtn').onclick=function(){
    testMode=!testMode;
    localStorage.setItem('coucho-test-mode',testMode?'1':'0');
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
    q('#capUse').style.display='none';
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
    q('#captureResult').innerHTML='<span style="color:var(--muted)">A · X · Y</span>';
    q('#capUse').style.display='none';
    q('#shortcutOverlay').classList.add('open');
  }

  function capture(v){
    captured='Guide + '+v;
    q('#captureResult').innerHTML=shortcutMarkup(captured);
    q('#capUse').style.display='inline-flex';
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
    toast('Activar con','Sin atajo');
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
    toast('Activar con',value);
  };


  function startTest(ctx){
    closePops();
    closeShortcutOverlay();
    testContext=ctx;clearInterval(progressTimer);clearInterval(countdownTimer);
    q('#testDisplay').innerHTML='<div class="displays">'+displayMarkup(ctx)+'</div>';
    q('#testApp').textContent=logo(ctx.app);
    q('#testText').textContent='Probando '+ctx.name+'…';
    q('#keep').textContent=ctx.kind==='mode-preview'?'Activar':ctx.kind==='workspace-new'?'Guardar y activar':ctx.kind==='workspace-edit'?'Guardar y activar':'Guardar';
    q('#progress').style.width='0%';q('#confirm').classList.remove('show');q('#testOverlay').classList.add('open');

    var pct=0;
    progressTimer=setInterval(function(){
      pct+=25;q('#progress').style.width=pct+'%';
      if(pct>=100){
        clearInterval(progressTimer);q('#testText').textContent='Listo';q('#confirm').classList.add('show');
        var left=15;q('#count').textContent=left;
        countdownTimer=setInterval(function(){
          left--;q('#count').textContent=left;
          if(left<=0){
            clearInterval(countdownTimer);
            q('#confirm').classList.remove('show');
            q('#testText').textContent='Restaurando…';
            q('#progress').style.width='100%';
            setTimeout(finishRestore,420);
          }
        },1000);
      }
    },340);
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
      setTimeout(function(){closeModeDetail(true)},80);
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
    q('#progress').style.width='35%';
    setTimeout(function(){
      q('#progress').style.width='100%';
      setTimeout(finishRestore,220);
    },380);
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

  var shellView='modes';

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
  syncThemeControl();
  syncTestMode();
  commitSets();
  render();
})();
