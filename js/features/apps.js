import {esc} from '../core/dom.js';
import {translateControl} from './locale.js';
import {createDialog} from '../ui/modal.js';
import {getScenario,appAvailable,setScenarioWithoutReload,controlStorage} from '../demo/scenarios.js';
import {
  SAMPLE_APPS,normalizeManagedApps,addManagedApp,addManualApp,validManualName,
  getAppDetails,setAppVisibleInHop,removeManagedApp,appUsedByModes
} from '../data/app-catalog.js';

const STORAGE_KEY='coucho-apps-demo-v1';
function readApps(){
  try{
    const raw=controlStorage.getItem(STORAGE_KEY);
    return normalizeManagedApps(raw===null?null:JSON.parse(raw));
  }catch{return [];}
}
export function initApps({getModes,onRecovered=()=>{}}){
  const list=document.getElementById('appsList');
  const found=document.getElementById('appsFoundList');
  const section=document.getElementById('appsDiscovered');
  if(!list||!found)return {render:()=>{},getManagedApps:()=>[]};

  let apps=readApps();
  const dialog=createDialog(document.getElementById('couchoDialog'));
  const add=document.getElementById('appsAdd');
  const retry=document.getElementById('appsRetry');
  const details=id=>getAppDetails(id,apps);
  const save=()=>controlStorage.setItem(STORAGE_KEY,JSON.stringify(apps));

  function render(){
    const modes=getModes();
    list.innerHTML=apps.map(item=>{
      const app=details(item.id);
      if(!app)return '';
      const used=appUsedByModes(modes,item.id);
      const linked=used.length===1?used[0]:used.length?used.length+' Couchsets':'';
      const unavailable=!appAvailable(item.id);
      return '<article class="managed-app-row'+(unavailable?' is-unavailable':'')+'" data-managed-app="'+esc(item.id)+'">'+
        '<span class="managed-app-icon" aria-hidden="true">'+esc(app.monogram)+'</span>'+
        '<div class="managed-app-name"><strong>'+esc(app.name)+'</strong>'+
          (linked?'<small>'+esc(linked)+'</small>':'')+
          (unavailable?'<span class="managed-app-status">No encontrada</span>':'')+'</div>'+
        '<label class="managed-app-hop"><span>En Hop</span>'+
          '<input type="checkbox" class="settings-switch" data-app-visibility="'+esc(item.id)+'" role="switch" aria-label="Mostrar '+esc(app.name)+' en Hop"'+
          (item.showInHop?' checked':'')+'></label>'+
        (used.length?'':'<button class="managed-app-remove" type="button" data-app-remove="'+esc(item.id)+'" aria-label="Quitar '+esc(app.name)+' de la lista">Quitar</button>')+
      '</article>';
    }).join('');
    if(!apps.length)list.innerHTML='<p class="managed-app-empty">Todavía no has añadido apps.</p>';

    const detected=SAMPLE_APPS.filter(candidate=>appAvailable(candidate.id)&&!apps.some(app=>app.id===candidate.id));
    found.innerHTML=detected.map(app=>
      '<article class="managed-app-row discovered-app" data-discovered-app="'+esc(app.id)+'">'+
        '<span class="managed-app-icon" aria-hidden="true">'+esc(app.monogram)+'</span>'+
        '<div class="managed-app-name"><strong>'+esc(app.name)+'</strong></div>'+
        '<button type="button" class="btn" data-add-detected="'+esc(app.id)+'" aria-label="Añadir '+esc(app.name)+'">Añadir</button>'+
      '</article>'
    ).join('');
    section.hidden=!detected.length;
    retry.hidden=getScenario()!=='missing-app';
    translateControl(list.parentElement||document);
  }

  list.addEventListener('change',event=>{
    const control=event.target.closest('[data-app-visibility]');
    if(!control||!list.contains(control))return;
    const id=control.dataset.appVisibility;
    apps=setAppVisibleInHop(apps,id,control.checked);
    save();render();
    list.querySelectorAll('[data-app-visibility]').forEach(node=>{
      if(node.dataset.appVisibility===id)node.focus({preventScroll:true});
    });
  });

  list.addEventListener('click',event=>{
    const button=event.target.closest('[data-app-remove]');
    if(!button||!list.contains(button))return;
    const id=button.dataset.appRemove;
    const app=details(id);
    if(!app||appUsedByModes(getModes(),id).length)return;
    dialog.open({
      heading:'¿Quitar '+app.name+'?',
      message:'Se quitará de Coucho. No se desinstalará.',
      confirmText:'Quitar',
      confirmStyle:'danger',
      onConfirm:()=>{
        if(appUsedByModes(getModes(),id).length)return;
        apps=removeManagedApp(apps,id);
        save();render();
        add.focus({preventScroll:true});
      }
    });
  });

  found.addEventListener('click',event=>{
    const button=event.target.closest('[data-add-detected]');
    if(!button||!found.contains(button))return;
    const id=button.dataset.addDetected;
    const next=addManagedApp(apps,id);
    if(next===apps)return;
    apps=next;save();render();
    list.querySelector('[data-managed-app="'+id+'"] [data-app-visibility]')?.focus({preventScroll:true});
  });

  retry.addEventListener('click',()=>{
    setScenarioWithoutReload('normal');
    onRecovered();render();
  });

  add.addEventListener('click',()=>{
    dialog.open({
      heading:'Añadir app',
      message:'',
      confirmText:'Añadir',
      field:{
        label:'Nombre',
        placeholder:'Mi aplicación',
        maxLength:50,
        validate:name=>validManualName(name)&&
          !apps.some(item=>details(item.id)?.name.toLocaleLowerCase()===name.toLocaleLowerCase())
      },
      onConfirm:name=>{
        const next=addManualApp(apps,name);
        if(next===apps)return;
        apps=next;save();render();
        list.lastElementChild?.querySelector('input')?.focus({preventScroll:true});
      }
    });
  });
  render();
  return {render,getManagedApps:()=>apps.map(item=>({...item}))};
}
