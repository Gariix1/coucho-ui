// Small demonstration catalog. The Windows app resolves installed apps,
// launch presets and availability via its native discovery pipeline.
export const SAMPLE_APPS=Object.freeze([
  {id:'Steam',name:'Steam',monogram:'S'},
  {id:'Playnite',name:'Playnite',monogram:'P'},
  {id:'Plex',name:'Plex',monogram:'P'},
  {id:'Discord',name:'Discord',monogram:'D'},
  {id:'Kodi',name:'Kodi',monogram:'K'}
]);

export const DEFAULT_MANAGED_APPS=Object.freeze([
  {id:'Steam',showInHop:true},
  {id:'Playnite',showInHop:false},
  {id:'Plex',showInHop:true}
]);

const knownIds=new Set(SAMPLE_APPS.map(app=>app.id));

export function normalizeManagedApps(raw){
  if(!Array.isArray(raw))return DEFAULT_MANAGED_APPS.map(app=>({...app}));
  const seen=new Set();
  return raw.filter(item=>{
    const id=item&&typeof item.id==='string'?item.id:null;
    if(!knownIds.has(id)||seen.has(id))return false;
    seen.add(id);
    return true;
  }).map(item=>({id:item.id,showInHop:item.showInHop===true}));
}

export function addManagedApp(current,id){
  if(!knownIds.has(id)||current.some(app=>app.id===id))return current;
  return [...current,{id,showInHop:true}];
}

export function setAppVisibleInHop(current,id,visible){
  return current.map(app=>app.id===id?{...app,showInHop:!!visible}:app);
}

export function removeManagedApp(current,id){
  return current.filter(app=>app.id!==id);
}

export function appUsedByModes(modes,id){
  return modes.filter(mode=>mode.app===id).map(mode=>mode.name);
}
