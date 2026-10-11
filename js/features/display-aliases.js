// Browser-only aliases. A display's immutable id/model are never renamed.
import {controlStorage} from '../demo/scenarios.js';
export const DISPLAY_ALIASES_KEY='coucho-display-aliases-v1';
export function validDisplayAlias(name){
  return typeof name==='string'&&name.trim().length>=1&&name.trim().length<=50;
}
function readAliases(storage){
  try{
    const raw=JSON.parse(storage.getItem(DISPLAY_ALIASES_KEY)||'{}');
    return raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
  }catch{return {};}
}
export function applyDisplayAliases(displays,storage=controlStorage){
  const aliases=readAliases(storage);
  for(const display of displays){
    if(!display.defaultName)display.defaultName=display.name;
    const alias=aliases[display.id];
    display.name=validDisplayAlias(alias)?alias.trim():display.defaultName;
  }
}
export function renameDisplay(displays,id,name,storage=controlStorage){
  const target=displays.find(display=>display.id===id);
  if(!target||!validDisplayAlias(name))return false;
  const clean=name.trim();
  if(displays.some(display=>display.id!==id&&display.name.toLocaleLowerCase()===clean.toLocaleLowerCase()))return false;
  const aliases=readAliases(storage);
  if(clean===(target.defaultName||target.name))delete aliases[id];
  else aliases[id]=clean;
  storage.setItem(DISPLAY_ALIASES_KEY,JSON.stringify(aliases));
  applyDisplayAliases(displays,storage);
  return true;
}
