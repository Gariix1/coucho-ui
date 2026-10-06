const DEFAULT_DURATION_MS=340;
const DEFAULT_EASING='cubic-bezier(.2,.8,.2,1)';

function reducedMotion(){
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function usableRect(rect){
  return !!rect&&rect.width>0&&rect.height>0;
}

function capture(root){
  const items=new Map();
  if(!root)return items;

  root.querySelectorAll('[data-layout-key]').forEach(element=>{
    const key=element.dataset.layoutKey;
    if(!key||items.has(key))return;

    const rect=element.getBoundingClientRect();
    if(!usableRect(rect))return;

    items.set(key,{element,rect});
  });

  return items;
}

function clamp(value,min,max){
  return Math.max(min,Math.min(max,value));
}

function findByKey(root,key){
  if(!root||!key)return null;
  return Array.from(root.querySelectorAll('[data-layout-key]'))
    .find(element=>element.dataset.layoutKey===key)||null;
}

function finished(animation){
  return animation.finished.catch(()=>{});
}

function animationDelta(before,after){
  return {
    x:before.left-after.left,
    y:before.top-after.top
  };
}

function shouldMove(delta){
  return Math.abs(delta.x)>.5||Math.abs(delta.y)>.5;
}

function prepare(root,{
  anchorKey=null,
  scrollElement=null
}={}){
  const before=capture(root);
  const anchorBefore=anchorKey?before.get(anchorKey)?.rect:null;
  const scroller=scrollElement||document.querySelector('.main');

  if(scroller)scroller.classList.add('layout-motion-active');

  let animations=[];
  let disposed=false;

  function cancel(){
    if(disposed)return;
    disposed=true;
    animations.forEach(animation=>{
      try{animation.cancel()}catch(_){}
    });
    animations=[];
    if(scroller)scroller.classList.remove('layout-motion-active');
  }

  async function play({
    root:nextRoot=root,
    anchorKey:nextAnchorKey=anchorKey,
    excludeKeys=[],
    duration=DEFAULT_DURATION_MS,
    easing=DEFAULT_EASING
  }={}){
    if(disposed)return;

    const excluded=new Set(excludeKeys);

    // Keep the element the user acted on at the same viewport Y whenever
    // scrolling can absorb the layout shift.
    if(scroller&&anchorBefore&&nextAnchorKey){
      const anchor=findByKey(nextRoot,nextAnchorKey);
      if(anchor){
        const nextRect=anchor.getBoundingClientRect();
        const deltaY=nextRect.top-anchorBefore.top;

        if(Math.abs(deltaY)>.5){
          const maxScroll=Math.max(0,scroller.scrollHeight-scroller.clientHeight);
          scroller.scrollTop=clamp(scroller.scrollTop+deltaY,0,maxScroll);
        }
      }
    }

    if(reducedMotion()){
      cancel();
      return;
    }

    const after=capture(nextRoot);

    before.forEach((entry,key)=>{
      if(excluded.has(key))return;

      const next=after.get(key);
      if(!next||!next.element.isConnected)return;

      const delta=animationDelta(entry.rect,next.rect);
      if(!shouldMove(delta))return;

      animations.push(next.element.animate([
        {transform:'translate3d('+delta.x+'px,'+delta.y+'px,0)'},
        {transform:'translate3d(0,0,0)'}
      ],{
        duration,
        easing,
        fill:'both'
      }));
    });

    await Promise.all(animations.map(finished));
    cancel();
  }

  return {play,cancel};
}

export const modeLayoutTransition={prepare};
