/* The public archive is independent of each page's bar and local dismissal memory. */
(function(root){
 'use strict';
 var shared=root.CRA1Shared=root.CRA1Shared||{},doc=root.document;
 function node(tag,cls,text){var el=doc.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;}
 function textOf(html){var t=doc.createElement('template');t.innerHTML=html||'';return(t.content.textContent||'').replace(/\s+/g,' ').trim();}
 function mount(host){
  if(host.__cra1NotificationCenter)return;host.__cra1NotificationCenter=true;
  var payload={items:[]},received=0,selected=new URL(root.location.href).searchParams.get('notice')||'',query='',loadState='loading',timer=null,expiry=null,flight=null,generation=0,destroyed=false,session=shared.NotificationSession;
  var toolbar=node('div','cra1-notification-center__toolbar'),search=node('input','cra1-notification-center__search'),total=node('span','cra1-notification-center__total');
  search.type='search';search.placeholder='搜索通知标题或内容';search.setAttribute('aria-label','搜索通知');total.setAttribute('role','status');toolbar.append(search,total);
  var layout=node('div','cra1-notification-center__layout'),list=node('nav','cra1-notification-center__list'),detail=node('section','cra1-notification-center__detail'),message=node('p','cra1-notification-center__message'),retry=node('button','cra1-notice-reader__all','重新加载');
  var hint=node('p','cra1-notification-center__message'),login=node('a','cra1-notice-reader__all','登录后查看更多通知');login.href='/login.htm';login.onclick=function(){try{root.sessionStorage.setItem('redirectUrl',root.location.href);}catch(error){}};hint.append(login);hint.hidden=true;
  list.setAttribute('aria-label','所有通知');retry.type='button';retry.hidden=true;layout.append(list,detail);host.replaceChildren(toolbar,message,retry,layout,hint);
  function currentItems(){var elapsed=performance.now()-received;return(payload.items||[]).filter(function(it){return it.expires_in==null||elapsed<it.expires_in*1000;});}
  function render(moveFocus){
   var items=currentItems(),filtered=items.filter(function(it){return !query||(it.title+' '+(it.summary||'')+' '+textOf(it.detail)).toLocaleLowerCase().includes(query);});
   var current=filtered.find(function(it){return it.id===selected;})||filtered[0];if(current)selected=current.id;
   total.textContent=loadState==='ready'?(query?'找到 '+filtered.length+' 条通知':'共 '+items.length+' 条通知'):'';
   hint.hidden=loadState!=='ready'||payload.member_authenticated!==false;
   list.replaceChildren();detail.replaceChildren();layout.hidden=!filtered.length;
   message.hidden=!!filtered.length;message.textContent=loadState==='error'?'通知暂时无法加载，请重试。':loadState==='loading'?'正在加载通知…':query?'没有找到匹配的通知。':'暂无生效中的通知。';retry.hidden=loadState!=='error';
   filtered.forEach(function(item){
    var entry=node('a','cra1-notification-center__entry'),tag=node('span','cra1-notice-reader__entry-label',item.label||'通知'),title=node('span','cra1-notice-reader__entry-title',item.title),summary=node('span','cra1-notice-reader__entry-summary',item.summary||textOf(item.detail));
    var href=new URL(root.location.href);href.searchParams.set('notice',item.id);entry.href=href;entry.setAttribute('aria-current',current&&current.id===item.id?'true':'false');entry.append(tag,title,summary);
    entry.onclick=function(event){if(event.button||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();selected=item.id;root.history.pushState(null,'',entry.href);render(true);};list.append(entry);
   });
   if(!current)return;
   var tag=node('span','cra1-notice-reader__label',current.label||'通知'),heading=node('h2','cra1-notification-center__title',current.title),article=node('article','cra1-notification-center__article'),links=node('div','cra1-notification-center__actions');
   heading.tabIndex=-1;heading.id='cra1-notification-heading';detail.setAttribute('aria-labelledby',heading.id);
   article.innerHTML=current.detail||'';if(!current.detail)article.textContent=current.summary||'';
   var actions=(current.extra_actions||[]).slice();if(current.url)actions.unshift({label:current.action_label||'了解更多',url:current.url,new_tab:current.new_tab});
   actions.forEach(function(action){var a=node('a','cra1-notice-reader__all',action.label);a.href=action.url;if(action.new_tab){a.target='_blank';a.rel='noopener noreferrer';}links.append(a);});
   links.hidden=!actions.length;detail.append(tag,heading,article,links);
   if(moveFocus){shared.UI.focus(heading);if(root.matchMedia('(max-width:640px)').matches)heading.scrollIntoView({block:'start',behavior:'instant'});}
  }
  function queueExpiry(){root.clearTimeout(expiry);var elapsed=performance.now()-received,left=(payload.items||[]).filter(function(it){return it.expires_in!=null&&it.expires_in*1000>elapsed;}).map(function(it){return it.expires_in*1000-elapsed;});if(left.length)expiry=root.setTimeout(function(){render(false);queueExpiry();},Math.min(2147483647,Math.max(1,Math.ceil(Math.min.apply(null,left))+1)));}
  function clearSession(){generation++;if(flight)flight.abort();flight=null;root.clearTimeout(timer);root.clearTimeout(expiry);payload={items:[]};loadState='loading';received=performance.now();render(false);host.setAttribute('aria-busy','false');}
  function refresh(){
   if(destroyed||doc.hidden)return;root.clearTimeout(timer);if(flight)flight.abort();var controller=new AbortController(),ticket=++generation,token=session?session.token():'';flight=controller;
   var deadline=root.setTimeout(function(){controller.abort();},8000);host.setAttribute('aria-busy','true');loadState='loading';render(false);
   root.fetch('/cra1-shared/notifications.php',{method:'POST',credentials:'same-origin',cache:'no-store',headers:session?session.headers():{'Content-Type':'application/json'},body:'{}',signal:controller.signal}).then(function(response){if(!response.ok)throw new Error('unavailable');return response.json();}).then(function(response){
    if(destroyed||ticket!==generation)return;if(session&&token!==session.token()){clearSession();refresh();return;}if(response.status!==200||!Array.isArray(response.data&&response.data.items))throw new Error('unavailable');payload=response.data;loadState='ready';received=performance.now();render(false);queueExpiry();
   }).catch(function(){
    if(destroyed||ticket!==generation)return;payload={items:[]};loadState='error';root.clearTimeout(expiry);render(false);
   }).finally(function(){root.clearTimeout(deadline);if(destroyed||ticket!==generation)return;flight=null;host.setAttribute('aria-busy','false');if(!doc.hidden)timer=root.setTimeout(refresh,Math.max(1,Math.min(30,Number(payload.refresh_after)||30))*1000);});
  }
  search.oninput=function(){query=search.value.trim().toLocaleLowerCase();render(false);};retry.onclick=refresh;
  root.addEventListener('popstate',function(){selected=new URL(root.location.href).searchParams.get('notice')||'';render(false);});
  doc.addEventListener('visibilitychange',function(){if(doc.hidden)clearSession();else refresh();});
  root.addEventListener('pagehide',function(){destroyed=true;clearSession();});
  root.addEventListener('pageshow',function(e){if(e.persisted){destroyed=false;clearSession();refresh();}});
  if(session)session.watch(function(){clearSession();refresh();});
  message.textContent='正在加载通知…';refresh();
 }
 function start(){doc.querySelectorAll('[data-cra1-notification-center]').forEach(mount);}
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',start,{once:true});else root.setTimeout(start,0);
})(window);
