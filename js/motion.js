const OPEN_TRAVEL_MS=360;
const CLOSE_TRAVEL_MS=330;
const RESOLVE_MS=120;

function reducedMotion(){
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function usableRect(rect){
  return !!rect&&
    rect.width>0&&
    rect.height>0&&
    rect.bottom>32&&
    rect.top<window.innerHeight&&
    rect.right>0&&
    rect.left<window.innerWidth;
}

function rectOf(element){
  return element&&element.isConnected?element.getBoundingClientRect():null;
}

function sanitizeClone(root){
  if(!root)return root;

  if(root.hasAttribute&&root.hasAttribute('id'))root.removeAttribute('id');
  root.querySelectorAll?.('[id]').forEach(element=>element.removeAttribute('id'));
  root.querySelectorAll?.('[autofocus]').forEach(element=>element.removeAttribute('autofocus'));
  return root;
}

function createSnapshot(element,kind){
  const rect=rectOf(element);
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
  document.body.appendChild(snapshot);

  return {element:snapshot,content,rect};
}

function animationFinished(animation){
  return animation.finished.catch(()=>{});
}

function cleanupAnimation(animation){
  try{animation.cancel()}catch(_){}
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
  if(reducedMotion())return {
    play:async()=>{},
    cancel:()=>{}
  };

  const flight=createSnapshot(source,'flight');
  const held=hold?createSnapshot(hold,'hold'):null;

  if(!flight)return {
    play:async()=>{},
    cancel:()=>held?.element.remove()
  };

  let disposed=false;

  function dispose(){
    if(disposed)return;
    disposed=true;
    flight.element.remove();
    held?.element.remove();
  }

  async function play(destination,direction='open'){
    const destinationSnapshot=createSnapshot(destination,'destination');
    const to=destinationSnapshot?.rect||rectOf(destination);

    if(!usableRect(to)){
      destinationSnapshot?.element.remove();
      dispose();
      return;
    }

    const vector=connectedTransform(flight.rect,to);
    const open=direction!=='close';
    flight.element.classList.toggle('to-editor',open);
    flight.element.classList.toggle('to-card',!open);
    const travelDuration=open?OPEN_TRAVEL_MS:CLOSE_TRAVEL_MS;

    const target=transformValue(
      vector.x,
      vector.y,
      vector.scaleX,
      vector.scaleY
    );

    // First 12%: lift/translate slightly without scaling.
    // The small source content is already gone before the real deformation begins.
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
      easing:open?'cubic-bezier(.16,1,.3,1)':'cubic-bezier(.4,0,.2,1)',
      fill:'both'
    });

    const sourceContentAnimation=flight.content.animate([
      {opacity:1,offset:0},
      {opacity:.62,offset:.055},
      {opacity:0,offset:.14},
      {opacity:0,offset:1}
    ],{
      duration:travelDuration,
      easing:'linear',
      fill:'both'
    });

    // While opening, keep the previous workspace above the newly-rendered editor.
    // It dissolves only once the connected surface is nearly covering it.
    const holdAnimation=held
      ?held.element.animate([
          {opacity:1,offset:0},
          {opacity:1,offset:.60},
          {opacity:0,offset:.88},
          {opacity:0,offset:1}
        ],{
          duration:travelDuration,
          easing:'linear',
          fill:'both'
        })
      :null;

    await Promise.all([
      animationFinished(flightAnimation),
      animationFinished(sourceContentAnimation),
      holdAnimation?animationFinished(holdAnimation):Promise.resolve()
    ]);

    // At this point the flight surface is already exactly where the destination lives.
    // Keep it there and resolve into an exact snapshot of the final UI.
    let resolveAnimation=null;
    if(destinationSnapshot){
      resolveAnimation=destinationSnapshot.element.animate([
        {opacity:0},
        {opacity:1}
      ],{
        duration:RESOLVE_MS,
        easing:'cubic-bezier(.2,.8,.2,1)',
        fill:'both'
      });
      await animationFinished(resolveAnimation);

      // Give the real destination underneath one committed paint while the identical
      // snapshot is still fully opaque. Removing it is then visually lossless.
      await nextPaint();
    }

    cleanupAnimation(flightAnimation);
    cleanupAnimation(sourceContentAnimation);
    if(holdAnimation)cleanupAnimation(holdAnimation);
    if(resolveAnimation)cleanupAnimation(resolveAnimation);

    destinationSnapshot?.element.remove();
    dispose();
  }

  return {play,cancel:dispose};
}

export const modeSheetTransition={rectOf,prepare};
