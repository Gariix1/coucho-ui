const THEME_KEY='coucho-theme';
const THEMES=new Set(['system','light','dark']);

export function getThemePreference(){
  const saved=localStorage.getItem(THEME_KEY);
  return THEMES.has(saved)?saved:'dark';
}

function applyTheme(){
  const preference=getThemePreference();
  const prefersLight=typeof window.matchMedia==='function'&&
    window.matchMedia('(prefers-color-scheme: light)').matches;
  document.documentElement.dataset.theme=
    preference==='system'?(prefersLight?'light':'dark'):preference;
}

export function setThemePreference(value){
  if(!THEMES.has(value))return;
  localStorage.setItem(THEME_KEY,value);
  applyTheme();
}

export function initTheme(){
  applyTheme();
  // A system preference should follow Windows even while Coucho is open.
  if(typeof window.matchMedia==='function'){
    const media=window.matchMedia('(prefers-color-scheme: light)');
    media.addEventListener?.('change',()=>{
      if(getThemePreference()==='system')applyTheme();
    });
  }
}
