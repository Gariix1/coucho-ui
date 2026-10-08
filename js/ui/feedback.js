import {q} from '../core/dom.js';
import {animateNotice} from './interaction-motion.js';

let toastTimer=null;

export function toast(title,message){
  q('#toastTitle').textContent=title;
  q('#toastText').textContent=message;
  const notice=q('#toast');
  notice.classList.add('show');
  animateNotice(notice);

  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>{
    q('#toast').classList.remove('show');
  },2100);
}
