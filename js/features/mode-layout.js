export function layoutKeyForMode(id){
  return id===null?'current':'mode:'+id;
}

export function modeColumnCount(modeList){
  if(!modeList)return 1;

  const raw=getComputedStyle(modeList)
    .getPropertyValue('--mode-columns')
    .trim();
  const count=parseInt(raw,10);

  return Number.isFinite(count)&&count>0?count:1;
}

export function modesForRender(modes,{
  expandedOpen=false,
  expandedModeId=null,
  modeList=null
}={}){
  const ordered=modes.slice();

  if(!expandedOpen||expandedModeId===null)return ordered;

  const selectedIndex=ordered.findIndex(mode=>mode.id===expandedModeId);
  if(selectedIndex<0)return ordered;

  const columns=modeColumnCount(modeList);
  if(columns<=1)return ordered;

  const rowStart=Math.floor(selectedIndex/columns)*columns;
  if(selectedIndex===rowStart)return ordered;

  const [selected]=ordered.splice(selectedIndex,1);
  ordered.splice(rowStart,0,selected);
  return ordered;
}
