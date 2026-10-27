/* Share one lightweight login watcher; notification content is never persisted. */
(function(root){
 'use strict';
 var shared=root.CRA1Shared=root.CRA1Shared||{},doc=root.document,listeners=[],timer=null;
 if(shared.NotificationSession)return;
 function token(){return shared.Request&&shared.Request.getToken?shared.Request.getToken():'';}
 var current=token();
 function sync(force){var next=token();if(next===current&&!force)return;current=next;listeners.slice().forEach(function(fn){fn();});}
 function tick(){if(!doc.hidden)sync(false);}
 function storage(event){if(event.key==='jwt'||event.key===null)sync(false);}
 function unauthorized(){sync(true);}
 function watch(fn){
  if(!listeners.length){current=token();timer=root.setInterval(tick,500);root.addEventListener('storage',storage);root.addEventListener('focus',tick);doc.addEventListener('api:unauthorized',unauthorized);}
  listeners.push(fn);
  return function(){listeners=listeners.filter(function(item){return item!==fn;});if(!listeners.length){root.clearInterval(timer);timer=null;root.removeEventListener('storage',storage);root.removeEventListener('focus',tick);doc.removeEventListener('api:unauthorized',unauthorized);}};
 }
 function headers(){return Object.assign({},shared.Request?shared.Request.headers():{},{'Content-Type':'application/json'});}
 shared.NotificationSession={token:token,headers:headers,watch:watch};
})(window);
