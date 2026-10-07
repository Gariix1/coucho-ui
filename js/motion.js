import {
  MOTION_DURATION,
  MOTION_EASING,
  prefersReducedMotion,
  animationFinished,
  cancelAnimation
} from './motion-settings.js';

function usableRect(rect){
  return !!rect&&rect.width>0&&rect.height>0;
}

function rectOf(element){
  return element&&element.isConnected?element.getBoundingClientRect():null;
}

function scrollHostFor(element){
  return element?.closest?.('.main')||document.querySelector('.main')||document.body;
}

function localRect(element,host){
  const rect=rectOf(element);
  if(!usableRect(rect))return null;

  if(host===document.body||host===document.documentElement){
    return {
      left:rect.left+window.scrollX,
      top:rect.top+window.scrollY,
      width:rect.width,
      height:rect.height
    };
  }

  const hostRect=host.getBoundingClientRect();

  return {
    left:rect.left-hostRect.left+host.scrollLeft-host.clientLeft,
    top:rect.top-hostRect.top+host.scrollTop-host.clientTop,
    width:rect.width,
    height:rect.height
  };
}

function sanitizeClone(root){
  if(!root)return root;

  if(root.hasAttribute&&root.hasAttribute('id'))root.removeAttribute('id');
  root.querySelectorAll?.('[id]').forEach(element=>element.removeAttribute('id'));
  root.querySelectorAll?.('[autofocus]').forEach(element=>element.removeAttribute('autofocus'));
  return root;
}

function createSnapshot(element,kind,host){
  const rect=localRect(element,host);
  if(!usableRect(rect))return null;

  const snapshot=document.createElement('div');
  snapshot.className='mode-transition-snapshot mode-transition-'+kind;
  snapshot.setAttribute('aria-hidden','true');
  snapshot.setAttribute('inert','');

  Object.assign(snapshot.style,{
    left:rect.left+'px',
    top:rect.top+'px',
    width:rect.width+'px',
    height:rect.height+'px'
  });

  const content=document.createElement('div');
  content.className='mode-transition-content';

  const clone=sanitizeClone(element.cloneNode(true));
  content.appendChild(clone);
  snapshot.appendChild(content);
  host.appendChild(snapshot);

  return {element:snapshot,content,rect};
}

function nextPaint(){
  return new Promise(resolve=>{
    requestAnimationFrame(()=>requestAnimationFrame(resolve));
  });
}

function connectedTransform(from,to){
  return {
    x:to.left-from.left,
    y:to.top-from.top,
    scaleX:to.width/from.width,
    scaleY:to.height/from.height
  };
}

function transformValue(x,y,scaleX,scaleY){
  return 'translate3d('+x+'px,'+y+'px,0) scale('+scaleX+','+scaleY+')';
}

function prepare(source,{hold=null}={}){
  if(prefersReducedMotion())return {
    play:async()=>{},
    cancel:()=>{}
  };

  const host=scrollHostFor(source);
  const flight=createSnapshot(source,'flight',host);
  const held=hold?createSnapshot(hold,'hold',host):null;

  if(!flight)return {
    play:async()=>{},
    cancel:()=>held?.element.remove()
  };

  let disposed=false;
  let activeAnimations=[];
  let destinationSnapshot=null;

  const onResize=()=>dispose();
  window.addEventListener('resize',onResize,{passive:true});

  function dispose(){
    if(disposed)return;
    disposed=true;

    window.removeEventListener('resize',onResize);
    activeAnimations.forEach(cancelAnimation);
    activeAnimations=[];

    destinationSnapshot?.element.remove();
    destinationSnapshot=null;
    flight.element.remove();
    held?.element.remove();
  }

  async function play(destination,direction='open'){
    if(disposed||!destination)return;

    destinationSnapshot=createSnapshot(destination,'destination',host);
    const to=destinationSnapshot?.rect||localRect(destination,host);

    if(!usableRect(to)){
      dispose();
      return;
    }

    const vector=connectedTransform(flight.rect,to);
    const open=direction!=='close';
    const toCreate=!!(open&&destination.classList.contains('new-mode-expanded'));
    const travelDuration=open?MOTION_DURATION.open:MOTION_DURATION.close;

    flight.element.classList.toggle('to-create',toCreate);
    flight.element.classList.toggle('to-expanded',open&&!toCreate);
    flight.element.classList.toggle('to-card',!open);

    const target=transformValue(
      vector.x,
      vector.y,
      vector.scaleX,
      vector.scaleY
    );

    const releaseX=vector.x*.035;
    const releaseY=vector.y*.035;
    const overshootX=vector.x+(vector.x===0?0:Math.sign(vector.x)*3);
    const overshootY=vector.y+(vector.y===0?0:Math.sign(vector.y)*2);

    const flightFrames=open
      ?[
          {
            transform:transformValue(0,0,1,1),
            boxShadow:'0 8px 20px rgba(0,0,0,.10)',
            offset:0
          },
          {
            transform:transformValue(releaseX,releaseY,1,1),
            boxShadow:'0 16px 34px rgba(0,0,0,.16)',
            offset:.12
          },
          {
            transform:transformValue(
              overshootX,
              overshootY,
              vector.scaleX*1.012,
              vector.scaleY*.99
            ),
            boxShadow:'0 26px 58px rgba(0,0,0,.21)',
            offset:.86
          },
          {
            transform:target,
            boxShadow:'0 22px 52px rgba(0,0,0,.18)',
            offset:1
          }
        ]
      :[
          {
            transform:transformValue(0,0,1,1),
            boxShadow:'0 22px 52px rgba(0,0,0,.18)',
            offset:0
          },
          {
            transform:transformValue(releaseX,releaseY,1,1),
            boxShadow:'0 24px 54px rgba(0,0,0,.19)',
            offset:.12
          },
          {
            transform:target,
            boxShadow:'0 8px 20px rgba(0,0,0,.10)',
            offset:1
          }
        ];

    const flightAnimation=flight.element.animate(flightFrames,{
      duration:travelDuration,
      easing:open?MOTION_EASING.open:MOTION_EASING.close,
      fill:'both'
    });

    const sourceContentAnimation=flight.content.animate([
      {opacity:1,offset:0},
      {opacity:.62,offset:.055},
      {opacity:0,offset:.14},
      {opacity:0,offset:1}
    ],{
      duration:travelDuration,
      easing:MOTION_EASING.linear,
      fill:'both'
    });

    const holdAnimation=held
      ?held.element.animate([
          {opacity:1,offset:0},
          {opacity:1,offset:.60},
          {opacity:0,offset:.88},
          {opacity:0,offset:1}
        ],{
          duration:travelDuration,
          easing:MOTION_EASING.linear,
          fill:'both'
        })
      :null;

    activeAnimations=[
      flightAnimation,
      sourceContentAnimation,
      ...(holdAnimation?[holdAnimation]:[])
    ];

    await Promise.all(activeAnimations.map(animationFinished));
    if(disposed)return;

    let resolveAnimation=null;

    if(destinationSnapshot){
      resolveAnimation=destinationSnapshot.element.animate([
        {opacity:0},
        {opacity:1}
      ],{
        duration:MOTION_DURATION.resolve,
        easing:MOTION_EASING.layout,
        fill:'both'
      });

      activeAnimations=[resolveAnimation];
      await animationFinished(resolveAnimation);
      if(disposed)return;

      await nextPaint();
      if(disposed)return;
    }

    activeAnimations.forEach(cancelAnimation);
    activeAnimations=[];
    destinationSnapshot?.element.remove();
    destinationSnapshot=null;
    dispose();
  }

  return {play,cancel:dispose};
}

export const modeSurfaceTransition={prepare};
