import {esc} from '../core/dom.js';
import {createDialog} from '../ui/modal.js';
import {
  SAMPLE_APPS,
  normalizeManagedApps,
  addManagedApp,
  setAppVisibleInHop,
  removeManagedApp,
  appUsedByModes
} from '../data/app-catalog.js';

const STORAGE_KEY='coucho-apps-demo-v1';

function readApps(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    return normalizeManagedApps(raw===null?null:JSON.parse(raw));
  }catch{
    return normalizeManagedApps(null);
  }
}

export function initApps({getModes}){
  const root=document.getElementById('view-apps');
  const list=document.getElementById('appsList');
  if(!root||!list)return {render:()=>{}};

  let apps=readApps();
  const dialog=createDialog(document.getElementById('couchoDialog'));
  const add=document.getElementById('appsAdd');

  function save(){
    localStorage.setItem(STORAGE_KEY,JSON.stringify(apps));
  }

  function render(){
    const modes=getModes();
    list.innerHTML=apps.map(item=>{
      const app=SAMPLE_APPS.find(candidate=>candidate.id===item.id);
      if(!app)return '';
      const used=appUsedByModes(modes,item.id);
      const useLabel=used.length===1?used[0]:used.length?used.length+' modos':'';
      return '<article class="managed-app-row" data-managed-app="'+esc(app.id)+'">'+
        '<span class="managed-app-icon" aria-hidden="true">'+esc(app.monogram)+'</span>'+
        '<div class="managed-app-name"><strong>'+esc(app.name)+'</strong>'+
          (useLabel?'<small>'+esc(useLabel)+'</small>':'')+'</div>'+
        '<label class="managed-app-hop"><span>En Hop</span>'+
          '<input type="checkbox" class="settings-switch" data-app-visibility="'+esc(app.id)+'" role="switch" aria-label="Mostrar '+esc(app.name)+' en Hop"'+
          (item.showInHop?' checked':'')+'></label>'+
        (used.length?'':'<button class="managed-app-remove" type="button" data-app-remove="'+esc(app.id)+'" aria-label="Quitar '+esc(app.name)+' de la lista">Quitar</button>')+
      '</article>';
    }).join('');
    if(!apps.length)list.innerHTML='<p class="managed-app-empty">Aún no hay apps.</p>';
    add.disabled=apps.length===SAMPLE_APPS.length;
  }

  list.addEventListener('change',event=>{
    const control=event.target.closest('[data-app-visibility]');
    if(!control||!list.contains(control))return;
    const id=control.dataset.appVisibility;
    apps=setAppVisibleInHop(apps,id,control.checked);
    save();
    render();
    list.querySelectorAll('[data-app-visibility]').forEach(element=>{
      if(element.dataset.appVisibility===id)element.focus({preventScroll:true});
    });
  });

  list.addEventListener('click',event=>{
    const button=event.target.closest('[data-app-remove]');
    if(!button||!list.contains(button))return;
    const id=button.dataset.appRemove;
    const app=SAMPLE_APPS.find(item=>item.id===id);
    if(!app)return;
    const linked=appUsedByModes(getModes(),id);
    if(linked.length)return;
    dialog.open({
      heading:'¿Quitar '+app.name+'?',
      message:'Se quitará de esta lista. No se desinstalará.',
      confirmText:'Quitar app',
      confirmStyle:'danger',
      onConfirm:()=>{
        apps=removeManagedApp(apps,id);
        save();
        render();
        add.focus({preventScroll:true});
      }
    });
  });

  add.addEventListener('click',()=>{
    const available=SAMPLE_APPS.filter(candidate=>!apps.some(app=>app.id===candidate.id));
    if(!available.length)return;
    dialog.open({
      heading:'Añadir app',
      message:'Apps de ejemplo',
      confirmText:'Añadir',
      value:available[0].id,
      options:available.map(app=>({value:app.id,label:app.name})),
      onConfirm:id=>{
        const next=addManagedApp(apps,id);
        if(next===apps)return;
        apps=next;
        save();
        render();
        list.querySelectorAll('[data-app-remove]').forEach(button=>{
          if(button.dataset.appRemove===id)button.focus({preventScroll:true});
        });
      }
    });
  });

  render();
  return {render};
}
