import {esc} from '../core/dom.js';
import {iconMarkup,modeIconMarkup} from '../core/icons.js';
import {
  displayCountLabel,
  displayMarkup,
  shortcutCardLabel
} from '../model.js';

export function expandedModeMarkup({kind,id,layoutKey}){
  const saved=kind==='mode';
  const rootTag=saved?'article':'section';
  const rootClass='mode-expanded '+(saved?'saved-mode-card saved-mode-expanded':'new-mode-expanded');
  const dataAttr=saved?' data-mode-row="'+id+'"':'';
  const titleLead=saved
    ?'<div class="mode-expanded-profile-icon" id="expandedProfileIcon"></div>'
    :'';
  const eyebrow=saved
    ?''
    :'<span class="mode-expanded-eyebrow">Crear modo</span>';
  const actions=saved
    ?'<button class="btn" id="expandedTest">Probar</button>'+
      '<button class="btn primary" id="expandedActivate" hidden>Activar</button>'
    :'<button class="btn" id="expandedReset" hidden>Restablecer</button>'+
      '<button class="btn" id="expandedTest">Probar</button>'+
      '<button class="btn primary" id="expandedSave">Crear modo</button>';

  return '<'+rootTag+' class="'+rootClass+'" id="expandedMode" data-layout-key="'+layoutKey+'" tabindex="-1" aria-labelledby="expandedName"'+dataAttr+'>'+
    '<header class="mode-expanded-head" data-expanded-toggle="true">'+
      '<div class="mode-expanded-title-block">'+
        titleLead+
        '<div class="mode-expanded-title-copy">'+
          eyebrow+
          '<h2 id="expandedName" class="mode-name-edit" tabindex="0"></h2>'+
        '</div>'+
      '</div>'+
      '<div class="mode-expanded-head-actions">'+
        '<span class="mode-expanded-state" id="expandedState" role="status" aria-live="polite" hidden></span>'+
        '<button class="mode-expanded-close" id="expandedClose" title="'+(saved?'Compactar':'Cancelar')+'" aria-label="'+(saved?'Compactar':'Cancelar')+'">'+iconMarkup(saved?'collapse':'close')+'</button>'+
      '</div>'+
    '</header>'+
    '<header class="mode-expanded-section-head"><b>Pantallas</b></header>'+
    '<div class="mode-expanded-screen-stage" id="expandedScreens"></div>'+
    '<div class="mode-expanded-pieces">'+
      '<button class="mode-expanded-piece" id="expandedApp" title="Cambiar app">'+
        '<span class="mode-expanded-piece-icon">'+iconMarkup('play')+'</span>'+
        '<span><small>App</small><b id="expandedAppName"></b></span>'+
      '</button>'+
      '<button class="mode-expanded-piece" id="expandedShortcut" title="Cambiar atajo">'+
        '<span class="mode-expanded-piece-icon">'+iconMarkup('gamepad')+'</span>'+
        '<span><small>Atajo</small><b id="expandedShortcutName"></b></span>'+
      '</button>'+
    '</div>'+
    '<footer class="mode-expanded-footer"><div class="mode-expanded-actions">'+actions+'</div></footer>'+
  '</'+rootTag+'>';
}

export function modeCardMarkup(mode,{applying=false,density='detailed',layoutKey}={}){
  const safeName=esc(mode.name);
  const safeApp=esc(mode.app);
  const safeShortcut=esc(shortcutCardLabel(mode.shortcut));
  const titleId='mode-title-'+mode.id;

  return '<article class="saved-mode-card mode-card-'+density+'" data-mode-row="'+mode.id+'" data-layout-key="'+layoutKey+'" aria-labelledby="'+titleId+'">'+
    '<div class="saved-mode-head">'+
      '<div class="saved-mode-name">'+
        '<span class="mode-list-icon">'+modeIconMarkup(mode.icon)+'</span>'+
        '<span class="saved-mode-name-copy"><b class="mode-list-name" id="'+titleId+'">'+safeName+'</b>'+
          (mode.active?'<small><span class="mode-list-badge">Activo</span></small>':'')+
        '</span>'+
      '</div>'+
      '<div class="saved-mode-actions">'+
        (!mode.active?'<button class="btn activate" data-id="'+mode.id+'"'+(applying?' disabled aria-busy="true"':'')+' title="Activar modo">'+(applying?'…':'Activar')+'</button>':'')+
        '<button class="open-mode" data-id="'+mode.id+'" title="Expandir '+safeName+'" aria-label="Expandir '+safeName+'">'+iconMarkup('expand')+'</button>'+
        '<button class="trash-mode" data-id="'+mode.id+'" title="Eliminar" aria-label="Eliminar '+safeName+'">'+iconMarkup('delete')+'</button>'+
      '</div>'+
    '</div>'+
    '<div class="saved-mode-body">'+
      '<button class="card-display quick-display" data-id="'+mode.id+'" title="Editar pantallas">'+
        '<span class="card-screen-row"><span class="displays card-displays">'+displayMarkup(mode)+'</span>'+
        '<span class="screen-count"><small>Pantallas</small>'+esc(displayCountLabel(mode))+'</span></span>'+
      '</button>'+
      '<div class="card-facts">'+
        '<button class="card-fact quick-app" data-id="'+mode.id+'" title="Cambiar app"><span class="fact-icon">'+iconMarkup('play')+'</span><span class="fact-copy"><small>App</small><b>'+safeApp+'</b></span></button>'+
        '<button class="card-fact quick-shortcut" data-id="'+mode.id+'" title="Cambiar atajo"><span class="fact-icon">'+iconMarkup('gamepad')+'</span><span class="fact-copy"><small>Atajo</small><b>'+safeShortcut+'</b></span></button>'+
      '</div>'+
    '</div>'+
  '</article>';
}
