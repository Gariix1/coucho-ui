export function q(selector){
  return document.querySelector(selector);
}

export function qa(selector){
  return Array.from(document.querySelectorAll(selector));
}

export function esc(value){
  return String(value ?? '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

export function setCssVars(element,values){
  if(!element)return;

  Object.entries(values).forEach(([name,value])=>{
    if(value==null){
      element.style.removeProperty(name);
      return;
    }
    element.style.setProperty(name,String(value));
  });
}
