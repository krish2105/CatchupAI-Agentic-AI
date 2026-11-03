import { PREFS_KEY } from "./constants";

/** Inline, pre-paint script. Mirrors `resolve()`/`applyToDocument()` in store.ts; keep in sync. */
export const preferencesScript = `(function(){try{
var p={};try{p=JSON.parse(localStorage.getItem(${JSON.stringify(PREFS_KEY)})||"{}")||{}}catch(e){}
var mm=function(q){return window.matchMedia(q).matches};
var t=p.theme==="light"||p.theme==="dark"?p.theme:(mm("(prefers-color-scheme: light)")?"light":"dark");
var m=p.motion==="reduce"?true:p.motion==="full"?false:mm("(prefers-reduced-motion: reduce)");
var r=document.documentElement;r.dataset.theme=t;r.dataset.themePref=p.theme||"system";
r.dataset.motion=m?"reduce":"full";r.dataset.threeD=p.threeD===false?"off":"on";r.style.colorScheme=t;
}catch(e){}})();`;
