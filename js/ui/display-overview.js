import {esc} from '../core/dom.js';
import {iconMarkup} from '../core/icons.js';

// Read-only projection of a Couchset's applied display state.
// A configured display that a mode does not use is NOT necessarily off or
// disconnected; the browser mockup has no hardware detection capability.
export function buildDisplayOverview(session,mode,displays){
  const known=new Set(displays.map(display=>display.id));
  const ids=session&&Array.isArray(session.displayIds)?session.displayIds:[];
  const selected=new Set(ids);
  const used=displays.filter(display=>selected.has(display.id));
  const missing=ids.filter(id=>!known.has(id));
  const pending=!!(mode&&session&&mode.id===session.modeId&&(
    session.app!==mode.app||
    !!session.preserve!==!!mode.preserve||
    (!mode.preserve&&(
      session.primaryDisplayId!==(mode.primaryDisplayId||null)||
      (mode.displayIds||[]).slice().sort().join('|')!==ids.slice().sort().join('|')
    ))
  ));
  const title=session
    ?session.name+' utiliza '+used.length+' de '+displays.length+' pantallas de ejemplo.'
    :'Ningún modo aplicado · '+displays.length+' pantallas de ejemplo.';
  const detail=pending?'Hay cambios guardados pendientes de aplicar.':
    missing.length?'Algunas pantallas del modo no están en este catálogo de ejemplo.':
    session?.preserve?'Este modo conserva la configuración de pantallas anterior.':'';
  return {
    count:displays.length,
    selectedCount:used.length,
    primaryId:session?.primaryDisplayId||null,
    hasSession:!!session,
    title,detail,pending,missing,
    displays:displays.map(display=>({
      ...display,
      state:!session?'Sin sesión':
        selected.has(display.id)?'En uso':'No usada por el modo',
      used:!!session&&selected.has(display.id),
      primary:!!session&&selected.has(display.id)&&session.primaryDisplayId===display.id
    }))
  };
}

export function displayOverviewMarkup(overview){
  return overview.displays.map(display=>{
    const classes=['overview-display',display.used?'on':'not-used'];
    if(display.primary)classes.push('primary');
    const state=display.primary?'Principal':display.state;
    const shape=display.kind==='tv'?'tv':'pc';
    return '<article class="'+classes.join(' ')+'" data-display-id="'+esc(display.id)+'">'+
      '<div class="overview-monitor-art">'+
        '<span class="overview-screen-shape '+shape+'" aria-hidden="true">'+
          (display.primary?'<span class="overview-primary-star">'+iconMarkup('star-filled')+'</span>':'')+
          '<span class="overview-identify-number">'+esc(String(display.number))+'</span>'+
        '</span>'+
      '</div>'+
      '<div class="overview-monitor-copy">'+
        '<b>'+esc(display.name)+'</b>'+
        '<span class="overview-monitor-state'+(display.primary?' primary':'')+'">'+esc(state)+'</span>'+
        '<small>'+esc(display.model)+'</small>'+
      '</div>'+
    '</article>';
  }).join('');
}
