export function editInlineText(element,initial,onCommit){
  if(!element||element.isContentEditable)return;

  let finished=false;
  element.contentEditable='true';
  element.textContent=initial;
  element.focus();

  const range=document.createRange();
  range.selectNodeContents(element);

  const selection=window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);

  function finish(commit){
    if(finished)return;
    finished=true;

    const next=element.textContent.trim();
    element.contentEditable='false';
    element.removeEventListener('blur',onBlur);
    element.removeEventListener('keydown',onKey);

    if(commit&&next){
      element.textContent=next;
      onCommit(next);
      return;
    }

    element.textContent=initial;
  }

  function onBlur(){
    finish(true);
  }

  function onKey(event){
    if(event.key==='Enter'){
      event.preventDefault();
      event.stopPropagation();
      finish(true);
      return;
    }

    if(event.key==='Escape'){
      event.preventDefault();
      event.stopPropagation();
      finish(false);
    }
  }

  element.addEventListener('blur',onBlur);
  element.addEventListener('keydown',onKey);
}

export function bindTouchRename(element,rename){
  if(!element)return;

  let gesture=null;

  element.addEventListener('pointerdown',event=>{
    if(event.pointerType==='mouse'||element.isContentEditable)return;
    gesture={
      x:event.clientX,
      y:event.clientY,
      time:Date.now(),
      pointerId:event.pointerId
    };
  });

  element.addEventListener('pointercancel',()=>{
    gesture=null;
  });

  element.addEventListener('pointerup',event=>{
    if(!gesture||gesture.pointerId!==event.pointerId||element.isContentEditable){
      gesture=null;
      return;
    }

    const dx=event.clientX-gesture.x;
    const dy=event.clientY-gesture.y;
    const moved=Math.sqrt(dx*dx+dy*dy);
    const elapsed=Date.now()-gesture.time;
    gesture=null;

    if(moved<=8&&elapsed<=650){
      event.preventDefault();
      rename();
    }
  });
}
