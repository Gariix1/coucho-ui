import {
  MOTION_DURATION,MOTION_EASING,prefersReducedMotion,supportsWebAnimations,
  cancelAnimation,animationFinished,startAnimation
} from '../motion-settings.js';

// Shared tactile response for pointer, touch, keyboard and mouse.
// Tactile feedback MUST NOT animate transform/layout geometry: buttons can be
// morph sources, and their bounding rect must stay invariant while clicked.
// Brightness is composited independently, so connected-surface measurements
// and FLIP remain stable even if the pointer release overlaps click dispatch.
export function bindPressFeedback(root=document){
  let active=null;
  let activePointerId=null;
  let animation=null;

  function release(){
    if(!active)return;
    const element=active;
    active=null;
    const connected=element.isConnected;
    const from=connected?getComputedStyle(element).filter:'none';
    cancelAnimation(animation);
    animation=null;
    if(!connected||prefersReducedMotion()||!supportsWebAnimations())return;

    const outgoing=startAnimation(element,[
      {filter:from==='none'?'brightness(.94)':from},
      {filter:'none'}
    ],{
      duration:MOTION_DURATION.press,
      easing:MOTION_EASING.press
    });
    animation=outgoing;
    animationFinished(outgoing).then(()=>{
      if(animation===outgoing)animation=null;
    });
  }

  function press(element){
    if(active===element)return;
    release();
    if(!element||element.disabled||prefersReducedMotion()||!supportsWebAnimations())return;
    active=element;
    animation=startAnimation(element,[
      {filter:'none'},
      {filter:'brightness(.94)'}
    ],{
      duration:MOTION_DURATION.press,
      easing:MOTION_EASING.press,
      fill:'forwards'
    });
  }

  root.addEventListener('pointerdown',event=>{
    if(event.button!==0||activePointerId!==null)return;
    const button=event.target.closest?.('button,[data-motion-press]');
    if(!button||button.disabled)return;
    activePointerId=event.pointerId;
    press(button);
  },{capture:true});

  function finishPointer(event){
    if(activePointerId===null||event.pointerId!==activePointerId)return;
    activePointerId=null;
    release();
  }

  // Listen on window so dragging or releasing outside the document cannot
  // strand a pressed control at scale(.975).
  window.addEventListener('pointerup',finishPointer,{capture:true});
  window.addEventListener('pointercancel',finishPointer,{capture:true});
  window.addEventListener('blur',()=>{
    activePointerId=null;
    release();
  });

  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){
      activePointerId=null;
      release();
    }
  });

  root.addEventListener('keydown',event=>{
    if(activePointerId!==null||event.repeat||
      !(event.key==='Enter'||event.key===' '))return;
    const button=event.target.closest?.('button,[data-motion-press]');
    if(button&&!button.disabled)press(button);
  },{capture:true});

  window.addEventListener('keyup',event=>{
    if(event.key==='Enter'||event.key===' ')release();
  },{capture:true});
}
export function celebrateSurface(element){
  if(!element?.isConnected||prefersReducedMotion()||!supportsWebAnimations())return;
  // A restrained completion response: no permanent shadow or altered layout.
  startAnimation(element,[
    {boxShadow:'0 0 0 0 var(--motion-confirm-ring,var(--selected-border))',offset:0},
    {boxShadow:'0 0 0 5px var(--motion-confirm-ring,var(--selected-border))',offset:.38},
    {boxShadow:'0 0 0 0 var(--motion-confirm-ring,var(--selected-border))',offset:1}
  ],{
    duration:MOTION_DURATION.success,
    easing:MOTION_EASING.settle
  });
}

export function animateNotice(element){
  if(!element?.isConnected||prefersReducedMotion()||!supportsWebAnimations())return;
  element.getAnimations().forEach(cancelAnimation);
  startAnimation(element,[
    {opacity:0,transform:'translate3d(0,8px,0) scale(.98)'},
    {opacity:1,transform:'translate3d(0,0,0) scale(1)'}
  ],{
    duration:MOTION_DURATION.feedback*1.7,
    easing:MOTION_EASING.settle
  });
}
