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

// One owner per property:
// shell: left/top/width/height/border-radius (geometry);
// content layers: opacity only (no stretched text, icons or controls);
// portal: scroll displacement only (independent from the geometry timeline).
function viewportRect(element){
  if(!element?.isConnected)return null;
  const rect=element.getBoundingClientRect();
  if(!usableRect(rect))return null;
  return {left:rect.left,top:rect.top,width:rect.width,height:rect.height};
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

function createContent(element,rect,kind){
  const layer=document.createElement('div');
  layer.className='mode-transition-content mode-transition-content-'+kind;
  setCssVars(layer,{
    '--motion-content-width':rect.width+'px',
    '--motion-content-height':rect.height+'px'
  });
  layer.appendChild(sanitizeClone(element.cloneNode(true)));
  return layer;
}

// Scroll changes the physical viewport position of BOTH endpoints equally.
// Apply only their common displacement to the portal, never to text or the
// animated shell. No scroll blocking and no per-frame remeasurement.
function followScroll(portal,source){
  const scroller=source?.closest?.('.main')||document.querySelector('.main');
  const initialX=scroller?.scrollLeft||0;
  const initialY=scroller?.scrollTop||0;
  const initialWindowX=window.scrollX||0;
  const initialWindowY=window.scrollY||0;

  function update(){
    const x=(scroller?.scrollLeft||0)-initialX+(window.scrollX||0)-initialWindowX;
    const y=(scroller?.scrollTop||0)-initialY+(window.scrollY||0)-initialWindowY;
    portal.style.transform='translate3d('+(-x)+'px,'+(-y)+'px,0)';
  }

  scroller?.addEventListener?.('scroll',update,{passive:true});
  window.addEventListener('scroll',update,{passive:true});
  update();

  return ()=>{
    scroller?.removeEventListener?.('scroll',update);
    window.removeEventListener('scroll',update);
  };
}

function prepare(source,{layer=0}={}){
  if(!source||prefersReducedMotion()||!supportsWebAnimations()){
    return {play:async()=>{},cancel:()=>{}};
  }

  const from=viewportRect(source);
  if(!from)return {play:async()=>{},cancel:()=>{}};
  // The source DOM can be replaced by mutate(); capture its style now.
  const fromRadius=getComputedStyle(source).borderTopLeftRadius||'16px';

  // The only portal for this connected surface. It never contributes to the
  // scroll height and contains exactly one moving, clipping shell.
  const portal=document.createElement('div');
  portal.className='mode-transition-portal';
  portal.setAttribute('aria-hidden','true');
  portal.setAttribute('inert','');
  portal.style.zIndex=String(120+layer*4);

  const shell=document.createElement('div');
  shell.className='mode-transition-shell';
  setCssVars(shell,{
    '--motion-left':from.left+'px',
    '--motion-top':from.top+'px',
    '--motion-width':from.width+'px',
    '--motion-height':from.height+'px'
  });
  const outgoing=createContent(source,from,'source');
  shell.appendChild(outgoing);
  portal.appendChild(shell);
  document.body.appendChild(portal);

  let disposed=false;
  let destinationElement=null;
  let stopFollowingScroll=()=>{};
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
    stopFollowingScroll();
    animations.forEach(cancelAnimation);
    // Restore the real, normally laid-out destination, with no transform.
    destinationElement?.classList.remove('mode-transition-live-hidden');
    portal.remove();
    animations.length=0;
  }

  async function play(destination,direction='open',{duration:sharedDuration=null,easing:sharedEasing=null}={}){
    if(disposed||!destination?.isConnected){dispose();return;}
    const to=viewportRect(destination);
    if(!to){dispose();return;}

    const incoming=createContent(destination,to,'destination');
    shell.appendChild(incoming);

    const opening=direction!=='close';
    const duration=sharedDuration??(opening?MOTION_DURATION.open:MOTION_DURATION.close);
    const easing=sharedEasing??(opening?MOTION_EASING.open:MOTION_EASING.close);
    const isNew=opening&&destination.classList.contains('new-mode-expanded');
    shell.classList.toggle('to-create',isNew);
    shell.classList.toggle('to-expanded',opening&&!isNew);
    shell.classList.toggle('to-card',!opening);

    destinationElement=destination;
    destinationElement.classList.add('mode-transition-live-hidden');
    // The automatic anchor adjustment has already completed before play().
    // Baselines for user scroll must therefore be recorded at THIS moment.
    stopFollowingScroll=followScroll(portal,destination);

    const toRadius=getComputedStyle(destination).borderTopLeftRadius||'18px';

    const travel={duration,easing,fill:'both'};
    animations.push(
      shell.animate([
        {left:from.left+'px',top:from.top+'px',width:from.width+'px',height:from.height+'px',borderRadius:fromRadius},
        {left:to.left+'px',top:to.top+'px',width:to.width+'px',height:to.height+'px',borderRadius:toRadius}
      ],travel),
      outgoing.animate([
        {opacity:1,offset:0},
        {opacity:1,offset:.12},
        {opacity:0,offset:.42},
        {opacity:0,offset:1}
      ],{duration,easing:MOTION_EASING.linear,fill:'both'}),
      incoming.animate([
        {opacity:0,offset:0},
        {opacity:0,offset:.30},
        {opacity:1,offset:.85},
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
