import {esc} from './core/dom.js';
import {iconMarkup,normalizeIconKey} from './core/icons.js';
import {getDisplay} from './data/catalog.js';

export function logo(app){
  return app==='Ninguna'?'—':app.charAt(0).toUpperCase();
}

export function displayConfig(source){
  return {
    preserve:!!source.preserve,
    displayIds:Array.isArray(source.displayIds)?source.displayIds.slice():[],
    primaryDisplayId:source.primaryDisplayId||null
  };
}

// Share display-selection rules between the expanded and quick editors.
export function applyDisplayConfig(target,source){
  target.preserve=!!source.preserve;
  target.displayIds=source.displayIds.slice();
  target.primaryDisplayId=source.primaryDisplayId;
  return target;
}

export function toggleSelectedDisplay(config,id){
  const index=config.displayIds.indexOf(id);
  if(index>=0){
    if(config.displayIds.length===1)return false;
    config.displayIds.splice(index,1);
    if(config.primaryDisplayId===id){
      config.primaryDisplayId=config.displayIds[0]||null;
    }
  }else{
    config.displayIds.push(id);
    if(!config.primaryDisplayId)config.primaryDisplayId=id;
  }
  return true;
}

export function selectPrimaryDisplay(config,id){
  if(config.displayIds.indexOf(id)<0)config.displayIds.push(id);
  config.primaryDisplayId=id;
}

export function cloneModeConfig(source){
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

export function modeConfigEqual(a,b){
  if(!a||!b)return false;
  if(
    a.name!==b.name||
    a.icon!==b.icon||
    a.app!==b.app||
    a.shortcut!==b.shortcut||
    !!a.preserve!==!!b.preserve||
    a.primaryDisplayId!==b.primaryDisplayId
  )return false;

  return sortedDisplayIds(a)===sortedDisplayIds(b);
}

export function modeChangeCount(a,b){
  if(!a||!b)return 0;

  let count=0;
  if(a.name!==b.name||a.icon!==b.icon)count++;
  if(a.app!==b.app)count++;
  if(a.shortcut!==b.shortcut)count++;

  const displaysChanged=
    !!a.preserve!==!!b.preserve||
    a.primaryDisplayId!==b.primaryDisplayId||
    sortedDisplayIds(a)!==sortedDisplayIds(b);

  if(displaysChanged)count++;
  return count;
}

export function displaySummary(source){
  if(source.preserve)return 'No cambiar pantallas';

  const ids=Array.isArray(source.displayIds)?source.displayIds:[];
  const names=ids.map(id=>{
    const display=getDisplay(id);
    return display?display.name:id;
  });

  if(names.length===0)return 'Sin pantallas';
  if(names.length===1)return names[0];
  if(names.length===2)return names.join(' + ');
  return names.length+' pantallas';
}

export function displayMarkup(source){
  if(source.preserve)return '<div class="display-placeholder preserve">'+iconMarkup('preserve')+'</div>';

  const ids=Array.isArray(source.displayIds)?source.displayIds:[];
  if(ids.length===0)return '<div class="display-placeholder empty">—</div>';

  return ids.map(id=>{
    const display=getDisplay(id);
    if(!display)return '';

    const cls=display.kind==='tv'?'tv':'pc';
    const primary=id===source.primaryDisplayId?' primary':'';
    const star=id===source.primaryDisplayId
      ?'<span class="monitor-star">'+iconMarkup('star-filled')+'</span>'
      :'';

    return '<div class="monitor '+cls+primary+'" title="'+esc(display.name)+'">'+star+'</div>';
  }).join('');
}

export function shortcutCardLabel(value){
  return value==='Manual'?'Sin atajo':value;
}

export function displayCountLabel(source){
  if(source.preserve)return 'No cambia pantallas';
  const count=Array.isArray(source.displayIds)?source.displayIds.length:0;
  return count===1?'1 pantalla':count+' pantallas';
}

export function shortcutMarkup(value){
  if(value==='Manual')return '<span class="shortcut-muted">Sin atajo</span>';

  const parts=value.split(' + ');
  return '<span class="key">'+parts[0]+'</span><span>+</span><span class="key round">'+parts[1]+'</span>';
}

function sortedDisplayIds(source){
  return (Array.isArray(source.displayIds)?source.displayIds:[])
    .slice()
    .sort()
    .join('|');
}
