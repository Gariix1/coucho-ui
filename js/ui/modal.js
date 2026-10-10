// A single modal owner for focused choices and confirmations.
// No feature may open a second dialog over an active one.
let active=null;
const dialogInstances=new WeakMap();

export function closeModal(surface){
  if(!active||active.surface!==surface)return;
  const {returnFocus,keyHandler,previousOverflow}=active;
  document.removeEventListener('keydown',keyHandler,true);
  document.body.style.overflow=previousOverflow;
  surface.classList.remove('open');
  surface.hidden=true;
  active=null;
  if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});
}

export function openModal(surface,{initialFocus=null,onCancel=()=>{},returnFocus=document.activeElement}={}){
  if(active)closeModal(active.surface);
  const previousOverflow=document.body.style.overflow;
  surface.hidden=false;
  surface.classList.add('open');
  const keyHandler=event=>{
    if(event.key==='Escape'){
      event.preventDefault();
      event.stopImmediatePropagation();
      onCancel();
      return;
    }
    if(event.key!=='Tab')return;
    const options=[...surface.querySelectorAll(
      'button:not([disabled]):not([hidden]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'
    )].filter(node=>node.getClientRects().length>0&&!node.closest('[hidden]'));
    if(!options.length){event.preventDefault();return;}
    const first=options[0],last=options[options.length-1];
    if(event.shiftKey&&(document.activeElement===first||!surface.contains(document.activeElement))){
      event.preventDefault();last.focus();
    }else if(!event.shiftKey&&(document.activeElement===last||!surface.contains(document.activeElement))){
      event.preventDefault();first.focus();
    }
  };
  active={surface,returnFocus,keyHandler,previousOverflow};
  document.body.style.overflow='hidden';
  document.addEventListener('keydown',keyHandler,true);
  const target=initialFocus||surface.querySelector('button:not([disabled])');
  target?.focus({preventScroll:true});
}

// Reusable presentation. Choices are rendered as safe text, never HTML.
export function createDialog(root){
  if(!root)return null;
  if(dialogInstances.has(root))return dialogInstances.get(root);
  const title=root.querySelector('[data-dialog-title]');
  const description=root.querySelector('[data-dialog-description]');
  const choices=root.querySelector('[data-dialog-choices]');
  const cancel=root.querySelector('[data-dialog-cancel]');
  const confirm=root.querySelector('[data-dialog-confirm]');
  let action=null;
  let selected=null;

  function close(){
    closeModal(root);
    action=null;
    selected=null;
    choices.replaceChildren();
  }

  cancel.addEventListener('click',close);
  confirm.addEventListener('click',()=>{
    const callback=action;
    const value=selected;
    close();
    callback?.(value);
  });

  const controller={
    open({heading,message,confirmText,confirmStyle='primary',options=[],value=null,onConfirm}){
      root.setAttribute('role',options.length?'dialog':'alertdialog');
      title.textContent=heading;
      description.textContent=message;
      confirm.textContent=confirmText;
      confirm.classList.toggle('danger',confirmStyle==='danger');
      confirm.classList.toggle('primary',confirmStyle!=='danger');
      action=onConfirm;
      selected=value;
      choices.replaceChildren();
      choices.hidden=options.length===0;

      if(options.length){
        const group=document.createElement('div');
        group.className='modal-choice-group';
        group.setAttribute('role','radiogroup');
        group.setAttribute('aria-label','Opciones');
        options.forEach(option=>{
          const label=document.createElement('label');
          label.className='modal-choice';
          const radio=document.createElement('input');
          radio.type='radio';
          radio.name='couchoDialogChoice';
          radio.value=option.value;
          radio.checked=option.value===selected;
          const copy=document.createElement('span');
          const name=document.createElement('strong');
          name.textContent=option.label;
          const helper=document.createElement('small');
          helper.textContent=option.description||'';
          copy.append(name,helper);
          label.append(radio,copy);
          group.appendChild(label);
          radio.addEventListener('change',()=>{
            if(radio.checked)selected=radio.value;
          });
        });
        choices.append(group);
      }
      openModal(root,{initialFocus:options.length?choices.querySelector('input:checked'):cancel,onCancel:close});
    },
    close,
    get isOpen(){return !root.hidden;}
  };
  dialogInstances.set(root,controller);
  return controller;
}
