// A shortcut can belong to only one Couchset. Global Hop opening shortcuts
// are configured separately in Settings and do not occupy these Guide keys.
export const COUCHSET_SHORTCUTS=Object.freeze(['Guide + A','Guide + X','Guide + Y']);

export function shortcutOwner(modes,shortcut,excludeId=null){
  if(!COUCHSET_SHORTCUTS.includes(shortcut))return null;
  return modes.find(mode=>mode.id!==excludeId&&mode.shortcut===shortcut)||null;
}

export function validateCouchset(config,{displays=[],modes=[],excludeId=null}={}){
  if(!config||!String(config.name||'').trim())return 'Ponle un nombre al Couchset.';
  if(!config.preserve){
    const ids=Array.isArray(config.displayIds)?config.displayIds:[];
    if(!ids.length)return 'Selecciona una pantalla.';
    if(!ids.includes(config.primaryDisplayId))return 'Elige una pantalla principal.';
    if(ids.some(id=>!displays.some(display=>display.id===id)))return 'Hay pantallas desconocidas.';
  }
  if(config.shortcut!=='Manual'&&!COUCHSET_SHORTCUTS.includes(config.shortcut)){
    return 'El atajo no es compatible.';
  }
  const owner=shortcutOwner(modes,config.shortcut,excludeId);
  if(owner)return 'El atajo ya lo usa '+owner.name+'.';
  return null;
}
