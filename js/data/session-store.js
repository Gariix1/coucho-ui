// The applied desktop is NOT the saved Couchset. Persist it separately so
// manual screen edits survive reload without changing a saved mode.
export const APPLIED_SESSION_KEY='coucho-applied-session-v1';

export function normalizeAppliedSession(raw,modes,displays){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
  const mode=raw.modeId===null?null:modes.find(m=>m.id===raw.modeId);
  if(raw.modeId!==null&&!mode)return null;
  const validIds=new Set(displays.map(d=>d.id));
  if(!Array.isArray(raw.displayIds))return null;
  const ids=[...new Set(raw.displayIds)];
  if(!ids.length||ids.some(id=>!validIds.has(id)))return null;
  if(!ids.includes(raw.primaryDisplayId))return null;
  return {
    modeId:mode?mode.id:null,
    name:mode?.name||'Escritorio actual',
    icon:mode?.icon||'desktop',
    app:typeof raw.app==='string'?raw.app:'Ninguna',
    preserve:!!raw.preserve,
    displayIds:ids,
    primaryDisplayId:raw.primaryDisplayId
  };
}

export function readAppliedSession(modes,displays,storage=localStorage){
  try{
    const raw=storage.getItem(APPLIED_SESSION_KEY);
    return raw===null?null:normalizeAppliedSession(JSON.parse(raw),modes,displays);
  }catch{return null;}
}

export function writeAppliedSession(session,storage=localStorage){
  if(session===null){storage.removeItem(APPLIED_SESSION_KEY);return;}
  storage.setItem(APPLIED_SESSION_KEY,JSON.stringify(session));
}
