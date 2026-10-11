// Isolated demo scenarios. Session-scoped backup means a complete first-use
// exercise never overwrites the visitor's existing Couchsets/preferences.
const SCENARIO_KEY='coucho-control-scenario-v1';
const BACKUP_KEY='coucho-control-scenario-backup-v1';
const DATA_KEYS=['coucho-test-sets','coucho-applied-session-v1','coucho-apps-demo-v1'];
export const SCENARIOS=Object.freeze([
  {id:'normal',label:'Normal'},
  {id:'first-use',label:'Primer uso'},
  {id:'no-displays',label:'Sin pantallas'},
  {id:'missing-screen',label:'TV desconectada'},
  {id:'missing-app',label:'App no encontrada'},
  {id:'apply-error',label:'Error al aplicar'}
]);
const VALID=new Set(SCENARIOS.map(item=>item.id));

export function getScenario(store=sessionStorage){
  const value=store.getItem(SCENARIO_KEY);
  return VALID.has(value)?value:'normal';
}

function restoreData(snapshot,data){
  for(const key of DATA_KEYS){
    if(snapshot[key]===null||snapshot[key]===undefined)data.removeItem(key);
    else data.setItem(key,snapshot[key]);
  }
}

export function enterScenario(id,{session=sessionStorage,data=localStorage}={}){
  if(!VALID.has(id))return false;
  let backup=null;
  try{backup=JSON.parse(session.getItem(BACKUP_KEY));}catch{}
  if(!backup||typeof backup!=='object'){
    backup=Object.fromEntries(DATA_KEYS.map(key=>[key,data.getItem(key)]));
    session.setItem(BACKUP_KEY,JSON.stringify(backup));
  }
  // Always start from the visitor's real state when changing scenarios.
  restoreData(backup,data);
  if(id==='first-use'){
    data.setItem('coucho-test-sets','[]');
    data.setItem('coucho-apps-demo-v1','[]');
    data.removeItem('coucho-applied-session-v1');
  }
  session.setItem(SCENARIO_KEY,id);
  return true;
}

export function leaveScenario({session=sessionStorage,data=localStorage}={}){
  let backup=null;
  try{backup=JSON.parse(session.getItem(BACKUP_KEY));}catch{}
  if(backup&&typeof backup==='object')restoreData(backup,data);
  session.removeItem(SCENARIO_KEY);
  session.removeItem(BACKUP_KEY);
}

export function setScenarioWithoutReload(id,session=sessionStorage){
  if(!VALID.has(id))return false;
  session.setItem(SCENARIO_KEY,id);
  return true;
}

export function displayAvailable(id,scenario=getScenario()){
  if(scenario==='no-displays')return false;
  return !(scenario==='missing-screen'&&id==='tv');
}

export function appAvailable(id,scenario=getScenario()){
  return !(scenario==='missing-app'&&id==='Steam');
}

export function validateActivation(mode,scenario=getScenario()){
  if(scenario==='no-displays')return {kind:'displays',title:'No hay pantallas',message:'Conecta una pantalla y vuelve a comprobar.'};
  if(!mode.preserve){
    const missing=(mode.displayIds||[]).find(id=>!displayAvailable(id,scenario));
    if(missing)return {kind:'displays',title:'Pantalla no disponible',message:'Una pantalla del modo no está conectada.'};
  }
  if(mode.app&&mode.app!=='Ninguna'&&!appAvailable(mode.app,scenario)){
    return {kind:'app',title:'App no encontrada',message:mode.app+' no está disponible.'};
  }
  return null;
}
