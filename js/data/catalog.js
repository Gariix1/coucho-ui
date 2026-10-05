import {normalizeIconKey} from '../core/icons.js';

const LEGACY_ICON_KEYS=new Map([
  ['\uD83C\uDFAE','gaming'],
  ['\uD83C\uDFAC','movies'],
  ['\uD83D\uDDA5\uFE0F','desktop']
]);

function migrateIconKey(icon){
  return normalizeIconKey(LEGACY_ICON_KEYS.get(icon)||icon);
}

export const simulatedDisplays=[
  {id:'tv',number:1,name:'TV Sala',model:'LG OLED42C3',resolution:'3840 × 2160',hz:'120 Hz',detail:'3840 × 2160 · 120 Hz',kind:'tv',layout:{left:4,top:34,width:31,aspect:1.78}},
  {id:'main',number:2,name:'Monitor 1',model:'LG 27GP850-B',resolution:'2560 × 1440',hz:'165 Hz',detail:'2560 × 1440 · 165 Hz',kind:'monitor',layout:{left:37,top:22,width:28,aspect:1.78}},
  {id:'aux',number:3,name:'Monitor 2',model:'Dell P2422H',resolution:'1920 × 1080',hz:'75 Hz',detail:'1920 × 1080 · 75 Hz',kind:'monitor',layout:{left:67,top:38,width:25,aspect:1.78}}
];

export function demoSets(){
  return [
    {id:1,name:'Gaming',icon:'gaming',preserve:false,displayIds:['tv','main'],primaryDisplayId:'tv',app:'Steam',shortcut:'Guide + A',active:true},
    {id:2,name:'Películas',icon:'movies',preserve:false,displayIds:['tv'],primaryDisplayId:'tv',app:'Plex',shortcut:'Manual',active:false},
    {id:3,name:'Escritorio',icon:'desktop',preserve:false,displayIds:['main','aux'],primaryDisplayId:'main',app:'Ninguna',shortcut:'Manual',active:false}
  ];
}

export function migrateSet(source){
  const s=source||{};
  if(Array.isArray(s.displayIds)){
    return Object.assign(
      {preserve:false,primaryDisplayId:s.displayIds[0]||null},
      s,
      {icon:migrateIconKey(s.icon)}
    );
  }

  const ids=s.mode==='tv'
    ?['tv']
    :s.mode==='monitor'
      ?['main']
      :s.mode==='preserve'
        ?[]
        :['tv','main'];

  return Object.assign({},s,{
    preserve:s.mode==='preserve',
    displayIds:ids,
    primaryDisplayId:ids[0]||null,
    icon:migrateIconKey(s.icon)
  });
}

export function loadSets(){
  try{
    const saved=localStorage.getItem('coucho-test-sets');
    if(saved!==null){
      const parsed=JSON.parse(saved);
      if(Array.isArray(parsed))return parsed.map(migrateSet);
    }
  }catch(_){}
  return demoSets();
}

export function saveSets(sets){
  localStorage.setItem('coucho-test-sets',JSON.stringify(sets));
}

export function autoMeta(app){
  if(app==='Plex')return {name:'Películas',icon:'movies'};
  if(app==='Ninguna')return {name:'Escritorio',icon:'desktop'};
  return {name:'Gaming',icon:'gaming'};
}

export function getDisplay(id){
  return simulatedDisplays.find(display=>display.id===id)||null;
}
