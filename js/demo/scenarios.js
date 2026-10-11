// Isolated per-tab Control demo. No scenario mutates the normal localStorage.
const SCENARIO_KEY='coucho-control-scenario-v2';
const SNAPSHOT_KEY='coucho-control-scenario-baseline-v2';
const SANDBOX_PREFIX='coucho-sandbox-v2:';
const LEGACY_RECOVERY='coucho-control-scenario-recovery-v1';
const DATA_KEYS=[
  'coucho-test-sets','coucho-applied-session-v1','coucho-apps-demo-v1',
  'coucho-settings-preview-v1','coucho-theme','coucho-card-density'
];
export const SCENARIOS=Object.freeze([
  {id:'normal',label:'Normal'},
  {id:'first-use',label:'Primer uso'},
  {id:'no-displays',label:'Sin pantallas'},
  {id:'missing-screen',label:'TV desconectada'},
  {id:'new-screen',label:'Pantalla nueva'},
  {id:'ambiguous-screen',label:'Pantalla sin identificar'},
  {id:'missing-app',label:'App no encontrada'},
  {id:'apply-error',label:'Error al aplicar'},
  {id:'partial-apply',label:'Aplicación parcial'},
  {id:'restore-error',label:'Restauración fallida'}
]);
const VALID=new Set(SCENARIOS.map(item=>item.id));

export function getScenario(store=typeof sessionStorage==='undefined'?null:sessionStorage){
  const value=store?.getItem(SCENARIO_KEY);
  return VALID.has(value)?value:'normal';
}
export function scenarioIsActive(store=typeof sessionStorage==='undefined'?null:sessionStorage){
  return store?.getItem(SNAPSHOT_KEY)!==null&&!!store;
}

// A storage facade. All CRUD modules use this instead of localStorage:
// when a demo is active, writes belong to this tab only.
export function getControlStorage({session=sessionStorage,data=localStorage}={}){
  return {
    getItem(key){
      return scenarioIsActive(session)?session.getItem(SANDBOX_PREFIX+key):data.getItem(key);
    },
    setItem(key,value){
      if(scenarioIsActive(session))session.setItem(SANDBOX_PREFIX+key,String(value));
      else data.setItem(key,String(value));
    },
    removeItem(key){
      if(scenarioIsActive(session))session.removeItem(SANDBOX_PREFIX+key);
      else data.removeItem(key);
    }
  };
}
export const controlStorage={
  getItem:key=>getControlStorage().getItem(key),
  setItem:(key,value)=>getControlStorage().setItem(key,value),
  removeItem:key=>getControlStorage().removeItem(key)
};

export function enterScenario(id,{session=sessionStorage,data=localStorage}={}){
  if(!VALID.has(id))return false;
  let baseline;
  try{baseline=JSON.parse(session.getItem(SNAPSHOT_KEY));}catch{}
  if(!baseline||typeof baseline!=='object'){
    baseline=Object.fromEntries(DATA_KEYS.map(key=>[key,data.getItem(key)]));
    session.setItem(SNAPSHOT_KEY,JSON.stringify(baseline));
  }
  for(const key of DATA_KEYS){
    session.removeItem(SANDBOX_PREFIX+key);
    if(baseline[key]!==null&&baseline[key]!==undefined){
      session.setItem(SANDBOX_PREFIX+key,baseline[key]);
    }
  }
  if(id==='first-use'){
    session.setItem(SANDBOX_PREFIX+'coucho-test-sets','[]');
    session.setItem(SANDBOX_PREFIX+'coucho-apps-demo-v1','[]');
    session.removeItem(SANDBOX_PREFIX+'coucho-applied-session-v1');
  }
  session.setItem(SCENARIO_KEY,id);
  return true;
}

export function leaveScenario({session=sessionStorage}={}){
  for(const key of DATA_KEYS)session.removeItem(SANDBOX_PREFIX+key);
  session.removeItem(SCENARIO_KEY);
  session.removeItem(SNAPSHOT_KEY);
}

// Migration safeguard for older prototype scenarios, which used localStorage.
export function recoverOrphanedScenario({session=sessionStorage,data=localStorage}={}){
  let saved;
  try{saved=JSON.parse(data.getItem(LEGACY_RECOVERY));}catch{}
  if(!saved||typeof saved!=='object')return false;
  if(!scenarioIsActive(session)){
    for(const key of ['coucho-test-sets','coucho-applied-session-v1','coucho-apps-demo-v1']){
      if(saved[key]===null||saved[key]===undefined)data.removeItem(key);
      else data.setItem(key,saved[key]);
    }
  }
  data.removeItem(LEGACY_RECOVERY);
  return true;
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
  if(scenario==='ambiguous-screen'&&!mode.preserve)return {kind:'displays',title:'Pantalla sin identificar',message:'Identifica la pantalla antes de aplicar.'};
  if(!mode.preserve){
    const missing=(mode.displayIds||[]).find(id=>!displayAvailable(id,scenario));
    if(missing)return {kind:'displays',title:'Pantalla no disponible',message:'Una pantalla del modo no está conectada.'};
  }
  if(mode.app&&mode.app!=='Ninguna'&&!appAvailable(mode.app,scenario)){
    return {kind:'app',title:'App no encontrada',message:mode.app+' no está disponible.'};
  }
  return null;
}
