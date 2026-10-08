import {
  MOTION_DURATION,MOTION_EASING,prefersReducedMotion,supportsWebAnimations,
  cancelAnimation,animationFinished
} from '../motion-settings.js';

// Shared tactile response for pointer, touch, keyboard and mouse.
// Animate only the control itself: content and layout geometry stay untouched.
export function bindPressFeedback(root=document){
  let active=null;
  let animation=null;

  function release(){
    if(!active)return;
    const element=active;
    active=null;
    const from=getComputedStyle(element).transform;
    cancelAnimation(animation);
    animation=null;
    if(!element.isConnected||prefersReducedMotion()||!supportsWebAnimations())return;

    const outgoing=element.animate([
      {transform:from==='none'?'scale(.975)':from},
      {transform:'scale(1)'}
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
    const outgoing=element.animate([
      {transform:'scale(1)'},
      {transform:'scale(.975)'}
    ],{
      duration:MOTION_DURATION.press,
      easing:MOTION_EASING.press,
      fill:'forwards'
    });
    animation=outgoing;
  }

  root.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    const button=event.target.closest?.('button,[data-motion-press]');
    if(button&&!button.disabled)press(button);
  },{capture:true});

  root.addEventListener('pointerup',release,{capture:true});
  root.addEventListener('pointercancel',release,{capture:true});
  window.addEventListener('blur',release);

  root.addEventListener('keydown',event=>{
    if(event.repeat||!(event.key==='Enter'||event.key===' '))return;
    const button=event.target.closest?.('button,[data-motion-press]');
    if(button&&!button.disabled)press(button);
  },{capture:true});

  root.addEventListener('keyup',event=>{
    if(event.key==='Enter'||event.key===' ')release();
  },{capture:true});
}

export function celebrateSurface(element){
  if(!element?.isConnected||prefersReducedMotion()||!supportsWebAnimations())return;
  // A restrained completion response: no permanent shadow or altered layout.
  element.animate([
    {boxShadow:'0 0 0 0 rgba(125,211,252,0)',offset:0},
    {boxShadow:'0 0 0 5px rgba(125,211,252,.28)',offset:.38},
    {boxShadow:'0 0 0 0 rgba(125,211,252,0)',offset:1}
  ],{
    duration:MOTION_DURATION.success,
    easing:MOTION_EASING.settle
  });
}

export function animateNotice(element){
  if(!element?.isConnected||prefersReducedMotion()||!supportsWebAnimations())return;
  element.getAnimations().forEach(cancelAnimation);
  element.animate([
    {opacity:0,transform:'translate3d(0,8px,0) scale(.98)'},
    {opacity:1,transform:'translate3d(0,0,0) scale(1)'}
  ],{
    duration:MOTION_DURATION.feedback*1.7,
    easing:MOTION_EASING.settle
  });
}
