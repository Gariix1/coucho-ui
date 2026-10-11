// Preview-only portable flow. This is NOT Coucho's native .coucho format v2.
import {normalizeManagedApps} from '../data/app-catalog.js';
import {normalizeSettings} from './settings.js';
import {validateCouchset} from './shortcut-validation.js';

const FORMAT='coucho-control-preview';
const MAX_FILE_BYTES=160_000;
export function exportPreview({modes,apps,settings,theme}){
  return JSON.stringify({
    format:FORMAT,version:1,
    couchsets:modes.map(m=>({
      id:m.id,name:m.name,icon:m.icon,preserve:!!m.preserve,
      displayIds:m.displayIds,primaryDisplayId:m.primaryDisplayId,
      app:m.app,shortcut:m.shortcut,active:false
    })),
    apps,settings,theme
  },null,2);
}

export function importPreview(raw,displays){
  if(typeof raw!=='string'||raw.length>MAX_FILE_BYTES)throw Error('Archivo demasiado grande.');
  let parsed;
  try{parsed=JSON.parse(raw)}catch{throw Error('El archivo no es válido.')}
  if(parsed?.format!==FORMAT||parsed.version!==1)throw Error('No es una copia compatible con esta demo.');
  if(!Array.isArray(parsed.couchsets)||!Array.isArray(parsed.apps))throw Error('La copia está incompleta.');
  if(parsed.couchsets.length>100||parsed.apps.length>120)throw Error('La copia tiene demasiados elementos.');
  const apps=normalizeManagedApps(parsed.apps);
  if(apps.length!==parsed.apps.length)throw Error('La lista de apps tiene datos inválidos.');
  const modes=[],ids=new Set();
  const allowedApps=new Set(['Ninguna',...apps.map(a=>a.id)]);
  for(const rawMode of parsed.couchsets){
    if(!rawMode||typeof rawMode!=='object'||!Number.isSafeInteger(rawMode.id)||
      rawMode.id<=0||ids.has(rawMode.id))throw Error('Hay Couchsets duplicados o inválidos.');
    if(typeof rawMode.name!=='string'||rawMode.name.trim().length>60)throw Error('Un Couchset tiene un nombre inválido.');
    const mode={
      id:rawMode.id,name:rawMode.name.trim(),icon:rawMode.icon||'desktop',
      preserve:!!rawMode.preserve,
      displayIds:Array.isArray(rawMode.displayIds)?rawMode.displayIds:[],
      primaryDisplayId:rawMode.primaryDisplayId??null,
      app:rawMode.app||'Ninguna',
      shortcut:rawMode.shortcut||'Manual',
      active:false
    };
    if(!allowedApps.has(mode.app))throw Error('Primero debes vincular las apps que faltan.');
    const issue=validateCouchset(mode,{modes,displays});
    if(issue)throw Error(issue);
    ids.add(mode.id);
    modes.push(mode);
  }
  const settings=normalizeSettings(parsed.settings);
  const theme=['system','light','dark'].includes(parsed.theme)?parsed.theme:'dark';
  return {modes,apps,settings,theme};
}
