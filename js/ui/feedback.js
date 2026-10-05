import {q} from '../core/dom.js';

let toastTimer=null;

export function toast(title,message){
  q('#toastTitle').textContent=title;
  q('#toastText').textContent=message;
  q('#toast').classList.add('show');

  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>{
    q('#toast').classList.remove('show');
  },2100);
}
