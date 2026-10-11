// UI copy preview. Keep translations separate from workflow state.
import {controlStorage} from '../demo/scenarios.js';
const EN=Object.freeze({
  'Modos':'Modes','Apps':'Apps','Pantallas':'Displays','Ajustes':'Settings',
  'Crear desde':'Create from','Escritorio actual':'Current desktop',
  'Crear tu primer Couchset':'Create your first Couchset','Empieza aquí':'Start here',
  'Tus modos':'Your Couchsets','Activar':'Activate','Activo':'Active','Atención':'Attention',
  'Pendiente':'Pending','Aplicar':'Apply','Comprobar':'Check','Expandir':'Expand',
  'Pantallas guardadas':'Displays saved','Pantallas de Windows':'Windows display settings',
  'Nueva pantalla':'New display','No detectada':'Not detected','Sin pantallas':'No displays',
  'Identificar':'Identify','Ocultar números':'Hide numbers','Editar':'Edit',
  'Cancelar':'Cancel','Probar cambios':'Test changes','Conservar cambios':'Keep changes',
  'Restaurar':'Restore','Sin seleccionar':'Not selected','Seleccionada':'Selected',
  'Principal':'Primary','En uso':'In use','No usada por el modo':'Not used by this mode',
  'Añadir app':'Add app','Otra app':'Other app','Encontradas':'Discovered',
  'Añadir':'Add','Quitar':'Remove','En Hop':'In Hop','No encontrada':'Not found',
  'Todavía no has añadido apps.':'No apps added yet.',
  'General':'General','Apariencia':'Appearance','Más opciones':'More options',
  'Idioma':'Language','Al abrir Coucho':'On startup','Iniciar con Windows':'Start with Windows',
  'Al cerrar Control':'When closing Control','Tema':'Theme','Transparencia':'Transparency',
  'Personalizar':'Customize','Ocultar':'Hide','Opacidad de Control':'Control opacity',
  'Opacidad de Hop':'Hop opacity','Abrir Hop con el mando':'Open Hop with controller',
  'Atajo del mando':'Controller shortcut','Cambiar':'Change',
  'Al salir de Hop':'When leaving Hop','Icono en la bandeja':'Tray icon',
  'Configuración':'Configuration','Exportar':'Export','Importar':'Import',
  'Restablecer preferencias':'Reset preferences','Restablecer':'Reset',
  'Se guarda automáticamente':'Saved automatically','Guardado':'Saved',
  'Tema oscuro':'Dark theme','Claro':'Light','Oscuro':'Dark','Sistema':'System',
  'Cerrar':'Close','Minimizar':'Minimize','Control':'Control',
  'Sin pantalla':'No display','No se detectaron pantallas.':'No displays detected.',
  'Hay una pantalla sin identificar.':'A display needs identification.',
  'TV Sala no detectada.':'Living room TV not detected.',
  'Volver a comprobar':'Check again','Activar modo':'Activate Couchset',
  'Mostrar números':'Show numbers','Couchsets':'Couchsets',
  'Los Couchsets no cambian.':'Saved Couchsets stay unchanged.',
  'Los Couchsets guardados no cambian.':'Saved Couchsets stay unchanged.',
  'Los Couchsets aparecerán aquí.':'Your Couchsets will appear here.',
  'Sin sesión':'No session','Manual':'Manual',
  'Compactar':'Collapse','Cambiar app':'Change app','Cambiar atajo':'Change shortcut',
  'Añadir app':'Add app','Nombre':'Name','Mi aplicación':'My app',
  '¿Importar configuración?':'Import configuration?',
  '¿Eliminar':'Delete','Restauración sin verificar':'Restore not verified',
  'No se pudo activar':'Activation failed','No se pudo aplicar':'Could not apply',
  'Aplicación parcial':'Partially applied','Activación parcial':'Partially activated',
  'Modo de prueba':'Test mode','Laboratorio de Control':'Control lab',
  'Escenario':'Scenario','Probar':'Test','Salir de prueba':'Exit test',
  'Primer uso':'First use','Sin pantallas':'No displays',
  'TV desconectada':'TV disconnected','Pantalla nueva':'New display',
  'Pantalla sin identificar':'Unidentified display',
  'App no encontrada':'App not found','Error al aplicar':'Apply error',
  'Aplicación parcial':'Partial apply','Restauración fallida':'Restore failed',
  'Normal':'Normal','Vaciar modos':'Clear Couchsets','Restaurar demo':'Restore examples'
});
const originals=new WeakMap();
let current='es';
function language(){
  try{
    const selected=JSON.parse(controlStorage.getItem('coucho-settings-preview-v1')||'{}').language;
    if(selected==='en-US')return 'en';
    if(selected==='system'&&/^en\b/i.test(navigator.language))return 'en';
  }catch{}
  return 'es';
}
export function translateControl(root=document){
  const next=language();
  current=next;
  document.documentElement.lang=next==='en'?'en':'es';
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  const nodes=[];
  while(walker.nextNode())nodes.push(walker.currentNode);
  for(const node of nodes){
    if(node.parentElement?.closest('input,textarea,[contenteditable="true"],[data-no-translate]'))continue;
    const text=node.nodeValue;
    if(!text||!text.trim())continue;
    const before=originals.get(node);
    const en=before&&EN[before.trim()]||EN[text.trim()];
    let source=before??text;
    if(before&&text!==before&&text!==(EN[before.trim()]||before)){
      source=text;
    }
    originals.set(node,source);
    const equivalent=next==='en'?(EN[source.trim()]||source.trim()):source.trim();
    if(equivalent!==text.trim()){
      const indentation=text.match(/^\s*/)?.[0]||'';
      const trailing=text.match(/\s*$/)?.[0]||'';
      node.nodeValue=indentation+equivalent+trailing;
    }
  }
}
export function currentLanguage(){return current;}
