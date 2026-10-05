export function normalizeIconKey(icon){
  if(icon==='gaming'||icon==='movies'||icon==='desktop')return icon;
  if(icon==='🎮')return 'gaming';
  if(icon==='🎬')return 'movies';
  return 'desktop';
}

export function iconMarkup(name,extraClass=''){
  const cls='ui-icon'+(extraClass?' '+extraClass:'');
  return '<svg class="'+cls+'" aria-hidden="true"><use href="#icon-'+name+'"></use></svg>';
}

export function modeIconMarkup(key){
  const map={gaming:'gamepad',movies:'film',desktop:'desktop'};
  return iconMarkup(map[normalizeIconKey(key)]||'desktop');
}
