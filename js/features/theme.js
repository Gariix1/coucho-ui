import {q} from '../core/dom.js';

const THEME_KEY='coucho-theme';

export function initTheme(){
  const saved=localStorage.getItem(THEME_KEY);
  const theme=saved==='light'||saved==='dark'?saved:'dark';
  document.documentElement.dataset.theme=theme;
  syncThemeControl();
}

export function syncThemeControl(){
  const light=document.documentElement.dataset.theme==='light';
  q('#themeValue').textContent=light?'Claro':'Oscuro';
}

export function toggleTheme(){
  const next=document.documentElement.dataset.theme==='light'?'dark':'light';
  document.documentElement.dataset.theme=next;
  localStorage.setItem(THEME_KEY,next);
  syncThemeControl();
}
