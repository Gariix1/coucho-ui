const OPEN_DURATION_MS=420;
const CLOSE_DURATION_MS=360;

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

function animateCoordinated(elements,duration){
  return (elements||[])
    .filter(element=>element&&element.isConnected&&typeof element.animate==='function')
    .map((element,index)=>{
      const animation=element.animate([
        {opacity:0,transform:'translate3d(0,8px,0)',offset:0},
        {opacity:0,transform:'translate3d(0,8px,0)',offset:.52},
        {opacity:1,transform:'translate3d(0,0,0)',offset:1}
      ],{
        duration,
        delay:index*12,
        easing:'cubic-bezier(.16,1,.3,1)',
        fill:'both'
      });
      return animation;
    });
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

  async function play(destination,direction='open',coordinated=[]){
    const to=rectOf(destination);
    if(!usableRect(to)){
      dispose();
      return;
    }

    const vector=connectedTransform(flight.rect,to);
    const open=direction!=='close';
    const duration=open?OPEN_DURATION_MS:CLOSE_DURATION_MS;

    const target=transformValue(
      vector.x,
      vector.y,
      vector.scaleX,
      vector.scaleY
    );

    const overshootX=vector.x+(vector.x===0?0:Math.sign(vector.x)*4);
    const overshootY=vector.y+(vector.y===0?0:Math.sign(vector.y)*3);

    const flightFrames=open
      ?[
          {
            transform:transformValue(0,0,1,1),
            boxShadow:'0 10px 24px rgba(0,0,0,.12)',
            offset:0
          },
          {
            transform:transformValue(
              overshootX,
              overshootY,
              vector.scaleX*1.018,
              vector.scaleY*.985
            ),
            boxShadow:'0 28px 62px rgba(0,0,0,.22)',
            offset:.84
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
            transform:transformValue(-2,-1,1.012,.982),
            boxShadow:'0 26px 58px rgba(0,0,0,.20)',
            offset:.18
          },
          {
            transform:target,
            boxShadow:'0 8px 20px rgba(0,0,0,.10)',
            offset:1
          }
        ];

    const flightAnimation=flight.element.animate(flightFrames,{
      duration,
      easing:open?'cubic-bezier(.16,1,.3,1)':'cubic-bezier(.4,0,.2,1)',
      fill:'both'
    });

    const contentAnimation=flight.content.animate(
      open
        ?[
            {opacity:1,offset:0},
            {opacity:.96,offset:.56},
            {opacity:0,offset:.88},
            {opacity:0,offset:1}
          ]
        :[
            {opacity:1,offset:0},
            {opacity:.96,offset:.62},
            {opacity:0,offset:1}
          ],
      {duration,easing:'linear',fill:'both'}
    );

    const holdAnimation=held
      ?held.element.animate([
          {opacity:1,offset:0},
          {opacity:1,offset:.42},
          {opacity:0,offset:.78},
          {opacity:0,offset:1}
        ],{duration,easing:'linear',fill:'both'})
      :null;

    const coordinatedAnimations=open
      ?animateCoordinated(coordinated,duration)
      :[];

    await Promise.all([
      animationFinished(flightAnimation),
      animationFinished(contentAnimation),
      holdAnimation?animationFinished(holdAnimation):Promise.resolve(),
      ...coordinatedAnimations.map(animationFinished)
    ]);

    cleanupAnimation(flightAnimation);
    cleanupAnimation(contentAnimation);
    if(holdAnimation)cleanupAnimation(holdAnimation);
    coordinatedAnimations.forEach(cleanupAnimation);
    dispose();
  }

  return {play,cancel:dispose};
}

export const modeSheetTransition={rectOf,prepare};
