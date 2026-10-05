const SHEET_DURATION_MS=300;

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

async function travel(from,to,direction){
  if(reducedMotion()||!usableRect(from)||!usableRect(to))return;

  const sheet=document.createElement('div');
  sheet.className='mode-flight-sheet';
  sheet.setAttribute('aria-hidden','true');
  document.body.appendChild(sheet);

  const startShadow=direction==='close'
    ?'8px 8px 0 -1px rgba(17,24,40,.12), 0 20px 48px rgba(0,0,0,.16)'
    :'0 8px 22px rgba(0,0,0,.12)';
  const finishShadow=direction==='close'
    ?'0 8px 22px rgba(0,0,0,.12)'
    :'8px 8px 0 -1px rgba(17,24,40,.12), 0 20px 48px rgba(0,0,0,.16)';

  try{
    if(typeof sheet.animate!=='function')return;

    const animation=sheet.animate([
      {
        left:from.left+'px',
        top:from.top+'px',
        width:from.width+'px',
        height:from.height+'px',
        boxShadow:startShadow,
        opacity:1
      },
      {
        left:to.left+'px',
        top:to.top+'px',
        width:to.width+'px',
        height:to.height+'px',
        boxShadow:finishShadow,
        opacity:1
      }
    ],{
      duration:SHEET_DURATION_MS,
      easing:'cubic-bezier(.2,.8,.2,1)',
      fill:'both'
    });

    await animation.finished.catch(()=>{});
  }finally{
    sheet.remove();
  }
}

export const modeSheetTransition={rectOf,travel};
