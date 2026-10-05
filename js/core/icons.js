const MODE_ICON_KEYS=new Set(['gaming','movies','desktop']);

export function normalizeIconKey(icon){
  return MODE_ICON_KEYS.has(icon)?icon:'desktop';
}

export function iconMarkup(name,extraClass=''){
  const cls='ui-icon'+(extraClass?' '+extraClass:'');
  return '<svg class="'+cls+'" aria-hidden="true"><use href="./assets/icons.svg#icon-'+name+'"></use></svg>';
}

export function modeIconMarkup(key){
  const map={gaming:'gamepad',movies:'film',desktop:'desktop'};
  return iconMarkup(map[normalizeIconKey(key)]||'desktop');
}
