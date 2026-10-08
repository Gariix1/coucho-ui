export const MOTION_DURATION=Object.freeze({
  open:360,
  close:330,
  density:280,
  press:125,
  success:480,
  feedback:140,
  feedbackFast:120,
  progress:400
});

export const MOTION_EASING=Object.freeze({
  open:'cubic-bezier(.16,1,.3,1)',
  close:'cubic-bezier(.4,0,.2,1)',
  layout:'cubic-bezier(.2,.8,.2,1)',
  linear:'linear',
  press:'cubic-bezier(.2,.8,.2,1)',
  settle:'cubic-bezier(.16,1,.3,1)'
});

// Shared geometry guard for connected-surface and FLIP layout animations.
export function usableRect(rect){
  return !!rect&&rect.width>0&&rect.height>0;
}

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

// Motion timings/easings are authored here and also provided to CSS controls.
export function installMotionTokens(root=document.documentElement){
  const tokens={
    '--motion-feedback-duration':MOTION_DURATION.feedback+'ms',
    '--motion-feedback-fast-duration':MOTION_DURATION.feedbackFast+'ms',
    '--motion-progress-duration':MOTION_DURATION.progress+'ms',
    '--motion-press-duration':MOTION_DURATION.press+'ms',
    '--motion-success-duration':MOTION_DURATION.success+'ms',
    '--motion-feedback-easing':MOTION_EASING.layout,
    '--motion-press-easing':MOTION_EASING.press
  };
  for(const [name,value] of Object.entries(tokens)){
    root.style.setProperty(name,value);
  }
}
