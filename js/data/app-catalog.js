// Apps discovered by the mock Windows environment. Not actual processes.
export const SAMPLE_APPS=Object.freeze([
  {id:'Steam',name:'Steam',monogram:'S'},
  {id:'Playnite',name:'Playnite',monogram:'P'},
  {id:'Plex',name:'Plex',monogram:'P'},
  {id:'Discord',name:'Discord',monogram:'D'},
  {id:'Kodi',name:'Kodi',monogram:'K'}
]);
export const DEFAULT_MANAGED_APPS=Object.freeze([]);
const knownIds=new Set(SAMPLE_APPS.map(app=>app.id));
const manualId=/^manual:[a-z0-9-]{6,}$/;
export function validManualName(raw){
  return typeof raw==='string'&&raw.trim().length>=2&&raw.trim().length<=50;
}
export function normalizeManagedApps(raw){
  if(!Array.isArray(raw))return [];
  const seen=new Set();
  return raw.filter(item=>{
    const id=item&&typeof item.id==='string'?item.id:null;
    if(!id||seen.has(id))return false;
    if(!knownIds.has(id)&&!(manualId.test(id)&&validManualName(item.name)))return false;
    seen.add(id);
    return true;
  }).map(item=>{
    const basic={id:item.id,showInHop:item.showInHop===true};
    return knownIds.has(item.id)?basic:{...basic,name:item.name.trim(),source:'manual'};
  });
}
export function addManagedApp(current,id){
  if(!knownIds.has(id)||current.some(app=>app.id===id))return current;
  return [...current,{id,showInHop:true}];
}
export function addManualApp(current,name,id='manual:'+Date.now()){
  if(!validManualName(name)||!manualId.test(id))return current;
  const clean=name.trim(),allNames=current.map(x=>getAppDetails(x.id,current)?.name?.toLocaleLowerCase());
  if(allNames.includes(clean.toLocaleLowerCase())||knownIds.has(id)||current.some(x=>x.id===id))return current;
  return [...current,{id,name:clean,source:'manual',showInHop:true}];
}
export function getAppDetails(id,managed=[]){
  const known=SAMPLE_APPS.find(app=>app.id===id);
  if(known)return known;
  const entry=managed.find(app=>app.id===id&&manualId.test(app.id));
  return entry?{id:entry.id,name:entry.name,monogram:entry.name[0].toUpperCase(),source:'manual'}:null;
}
export function getAppLabel(id,managed=[]){
  return getAppDetails(id,managed)?.name||id;
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
