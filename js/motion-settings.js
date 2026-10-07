export const MOTION_DURATION=Object.freeze({
  open:360,
  close:330,
  density:280,
  resolve:120
});

export const MOTION_EASING=Object.freeze({
  open:'cubic-bezier(.16,1,.3,1)',
  close:'cubic-bezier(.4,0,.2,1)',
  layout:'cubic-bezier(.2,.8,.2,1)',
  linear:'linear'
});

export function prefersReducedMotion(){
  return typeof window.matchMedia==='function'&&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function supportsWebAnimations(){
  return typeof Element!=='undefined'&&
    typeof Element.prototype.animate==='function';
}

export function animationFinished(animation){
  return animation.finished.catch(()=>{});
}

export function cancelAnimation(animation){
  if(!animation)return;
  try{animation.cancel()}catch(_){}
}
