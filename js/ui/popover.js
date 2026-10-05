export function positionPopover(pop,anchor,{
  titlebarHeight=32,
  margin=12,
  gap=8
}={}){
  if(!pop||!anchor||!anchor.isConnected)return false;

  const viewportTop=titlebarHeight+margin;
  const viewportBottom=window.innerHeight-margin;
  const rect=anchor.getBoundingClientRect();

  if(rect.bottom<viewportTop||rect.top>viewportBottom)return false;

  const popWidth=pop.offsetWidth;
  const popHeight=pop.offsetHeight;
  const below=rect.bottom+gap;
  const above=rect.top-gap-popHeight;

  let top;
  if(below+popHeight<=viewportBottom){
    top=below;
  }else if(above>=viewportTop){
    top=above;
  }else{
    top=Math.max(viewportTop,Math.min(viewportBottom-popHeight,below));
  }

  const centeredLeft=rect.left+rect.width/2-popWidth/2;
  const left=Math.max(
    margin,
    Math.min(window.innerWidth-popWidth-margin,centeredLeft)
  );

  pop.style.top=Math.round(top)+'px';
  pop.style.left=Math.round(left)+'px';
  return true;
}
