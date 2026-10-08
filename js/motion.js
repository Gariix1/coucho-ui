import {setCssVars} from './core/dom.js';
import {
  MOTION_DURATION,
  MOTION_EASING,
  usableRect,
  prefersReducedMotion,
  supportsWebAnimations,
  animationFinished,
  cancelAnimation
} from './motion-settings.js';

function scrollHostFor(element){
  return element?.closest?.('.main')||document.querySelector('.main')||document.body;
}

function localRect(element,host){
  if(!element?.isConnected)return null;
  const rect=element.getBoundingClientRect();
  if(!usableRect(rect))return null;

  if(host===document.body||host===document.documentElement){
    return {
      left:rect.left+window.scrollX,top:rect.top+window.scrollY,
      width:rect.width,height:rect.height
    };
  }

  const hostRect=host.getBoundingClientRect();
  return {
    left:rect.left-hostRect.left+host.scrollLeft-host.clientLeft,
    top:rect.top-hostRect.top+host.scrollTop-host.clientTop,
    width:rect.width,height:rect.height
  };
}

function sanitizeClone(root){
  root.removeAttribute('id');
  root.removeAttribute('autofocus');
  root.querySelectorAll('[id],[autofocus]').forEach(element=>{
    element.removeAttribute('id');
    element.removeAttribute('autofocus');
  });
  return root;
}

function createSnapshot(element,kind,host,layer){
  const rect=localRect(element,host);
  if(!usableRect(rect))return null;

  const snapshot=document.createElement('div');
  snapshot.className='mode-transition-snapshot mode-transition-'+kind;
  snapshot.setAttribute('aria-hidden','true');
  snapshot.setAttribute('inert','');
  snapshot.style.zIndex=String((kind==='destination'?121:120)+layer*4);
  setCssVars(snapshot,{
    '--motion-left':rect.left+'px','--motion-top':rect.top+'px',
    '--motion-width':rect.width+'px','--motion-height':rect.height+'px'
  });
  const content=document.createElement('div');
  content.className='mode-transition-content';
  content.appendChild(sanitizeClone(element.cloneNode(true)));
  snapshot.appendChild(content);
  host.appendChild(snapshot);
  return {element:snapshot,content,rect};
}

function transform(x,y,scaleX,scaleY){
  return 'translate3d('+x+'px,'+y+'px,0) scale('+scaleX+','+scaleY+')';
}

// Both snapshots follow the exact same visual rectangle at every point in time.
// One is defined from the source; the other is defined backwards from the destination.
function transformsBetween(from,to){
  return {
    sourceEnd:transform(to.left-from.left,to.top-from.top,to.width/from.width,to.height/from.height),
    destinationStart:transform(from.left-to.left,from.top-to.top,from.width/to.width,from.height/to.height)
  };
}

function prepare(source,{layer=0}={}){
  if(!source||prefersReducedMotion()||!supportsWebAnimations()){
    return {play:async()=>{},cancel:()=>{}};
  }

  const host=scrollHostFor(source);
  const flight=createSnapshot(source,'flight',host,layer);
  if(!flight)return {play:async()=>{},cancel:()=>{}};

  let disposed=false;
  let destinationSnapshot=null;
  let destinationElement=null;
  const animations=[];
  const onResize=()=>dispose();
  const onVisibilityChange=()=>{if(document.hidden)dispose()};
  window.addEventListener('resize',onResize,{passive:true});
  document.addEventListener('visibilitychange',onVisibilityChange);

  function dispose(){
    if(disposed)return;
    disposed=true;
    window.removeEventListener('resize',onResize);
    document.removeEventListener('visibilitychange',onVisibilityChange);
    animations.forEach(cancelAnimation);
    // Reveal the actual destination in the same frame as snapshot removal.
    destinationElement?.classList.remove('mode-transition-live-hidden');
    destinationSnapshot?.element.remove();
    flight.element.remove();
    animations.length=0;
  }

  async function play(destination,direction='open'){
    if(disposed||!destination?.isConnected){
      dispose();
      return;
    }

    destinationSnapshot=createSnapshot(destination,'destination',host,layer);
    if(!destinationSnapshot){
      dispose();
      return;
    }

    const to=destinationSnapshot.rect;
    const {sourceEnd,destinationStart}=transformsBetween(flight.rect,to);
    const open=direction!=='close';
    const duration=open?MOTION_DURATION.open:MOTION_DURATION.close;
    const easing=open?MOTION_EASING.open:MOTION_EASING.close;
    const expanded=open&&destination.classList.contains('new-mode-expanded');
    flight.element.classList.toggle('to-create',expanded);
    flight.element.classList.toggle('to-expanded',open&&!expanded);
    flight.element.classList.toggle('to-card',!open);

    // No rendered destination flashes through while the shared surface is moving.
    destinationElement=destination;
    destinationElement.classList.add('mode-transition-live-hidden');

    const travel={duration,easing,fill:'both'};
    animations.push(
      flight.element.animate([
        {transform:'translate3d(0,0,0) scale(1,1)',boxShadow:'0 8px 20px rgba(0,0,0,.10)'},
        {transform:sourceEnd,boxShadow:'0 22px 52px rgba(0,0,0,.18)'}
      ],travel),
      destinationSnapshot.element.animate([
        {transform:destinationStart},
        {transform:'translate3d(0,0,0) scale(1,1)'}
      ],travel),
      flight.element.animate([
        {opacity:1,offset:0},
        {opacity:1,offset:.32},
        {opacity:.22,offset:.82},
        {opacity:0,offset:1}
      ],{duration,easing:MOTION_EASING.linear,fill:'both'}),
      destinationSnapshot.element.animate([
        {opacity:0,offset:0},
        {opacity:0,offset:.28},
        {opacity:.9,offset:.82},
        {opacity:1,offset:1}
      ],{duration,easing:MOTION_EASING.linear,fill:'both'})
    );

    try{
      await Promise.all(animations.map(animationFinished));
    }finally{
      dispose();
    }
  }

  return {play,cancel:dispose};
}

export const modeSurfaceTransition={prepare};
