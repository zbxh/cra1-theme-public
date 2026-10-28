/* Generated from public/cra1-shared/src. Edit the source and rebuild. */
/* Framework independent interactions used by Alpine, Vue and React adapters. */
(function (root) {
  'use strict';
  var shared = root.CRA1Shared = root.CRA1Shared || {};
  if (shared.UI) return;
  var doc = root.document;
  var sequence = 0;
  var icons = {
    up: '<path d="m7 14 5-5 5 5"></path>',
    down: '<path d="m7 10 5 5 5-5"></path>',
    right: '<path d="M5 12h14m-5-5 5 5-5 5"></path>',
    megaphone: '<path d="m3 10 16-6v16L3 14v-4Zm5 6 1 5h4l-2-4M3 10v4"></path>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"></circle><path d="m16 16 4.5 4.5"></path>',
    close: '<path d="m8 8 8 8m0-8-8 8"></path>',
    info: '<circle cx="12" cy="12" r="9"></circle><path d="M12 11v6m0-10v.01"></path>',
    success: '<circle cx="12" cy="12" r="9"></circle><path d="m8 12 3 3 5-6"></path>',
    error: '<circle cx="12" cy="12" r="9"></circle><path d="M12 7v6m0 4v.01"></path>',
  };
  function icon(name) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (icons[name] || icons.info) + '</svg>';
  }
  function focus(element) {
    if (element && element.isConnected && element.focus) {
      try { element.focus({ preventScroll: true }); } catch (error) { element.focus(); }
    }
  }
  function createPopover(options) {
    var host = options.root, trigger = options.trigger, panel = options.panel;
    var id = panel.id || ('cra1-popover-' + (++sequence));
    panel.id = id;
    var open = false, destroyed = false, focusTimer = null, closeTimer = null;
    var group = options.group || 'header';
    trigger.setAttribute('aria-controls', id);
    trigger.setAttribute('aria-expanded', 'false');
    if (options.manageVisibility !== false) panel.hidden = true;
    function cancelClose() {
      root.clearTimeout(closeTimer); closeTimer = null;
    }
    function setOpen(value, restoreFocus) {
      cancelClose();
      value = !!value;
      if (destroyed || value === open) return;
      if (value && options.beforeOpen) options.beforeOpen();
      open = value;
      trigger.setAttribute('aria-expanded', String(open));
      host.classList.toggle('is-open', open);
      if (options.manageVisibility !== false) panel.hidden = !open;
      if (open) root.dispatchEvent(new CustomEvent('cra1:popover-open', { detail: { id: id, group: group } }));
      if (options.onOpenChange) options.onOpenChange(open);
      if (!open && restoreFocus) focus(trigger);
    }
    function openWithFocus() {
      setOpen(true);
      root.setTimeout(function () {
        if (!open || destroyed) return;
        var first = Array.from(panel.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex="0"]')).find(function (item) { return item.getClientRects().length && !item.closest('[hidden]'); });
        focus(first);
      }, 0);
    }
    function toggle(event) { if (event) event.preventDefault(); setOpen(!open); }
    function onOutside(event) { if (open && !host.contains(event.target)) setOpen(false); }
    function onKey(event) {
      if (event.key === 'Escape' && open && !event.isComposing) {
        event.preventDefault(); setOpen(false, host.contains(doc.activeElement));
      }
    }
    function onTriggerKey(event) { if (event.key === 'ArrowDown' && !event.isComposing) { event.preventDefault(); openWithFocus(); } }
    function onFocusout(event) {
      root.clearTimeout(focusTimer);
      if (host.contains(event.relatedTarget)) return;
      focusTimer = root.setTimeout(function () { if (open && !host.contains(doc.activeElement)) setOpen(false); }, 0);
    }
    function onOther(event) { if (open && event.detail && event.detail.group === group && event.detail.id !== id) setOpen(false); }
    function onEnter(event) { if (options.hover && event.pointerType === 'mouse') setOpen(true); }
    function onLeave(event) {
      if (!options.hover || event.pointerType !== 'mouse') return;
      var active = doc.activeElement;
      if (host.contains(active) && active.matches(':focus-visible')) return;
      cancelClose(); closeTimer = root.setTimeout(function () { setOpen(false); }, 160);
    }
    if (options.bindTrigger !== false) trigger.addEventListener('click', toggle);
    trigger.addEventListener('keydown', onTriggerKey);
    host.addEventListener('focusout', onFocusout);
    host.addEventListener('pointerenter', onEnter);
    host.addEventListener('pointerleave', onLeave);
    doc.addEventListener('click', onOutside);
    doc.addEventListener('keydown', onKey);
    root.addEventListener('cra1:popover-open', onOther);
    return {
      get isOpen() { return open; },
      setOpen: setOpen, show: function () { setOpen(true); }, close: function (restore) { setOpen(false, restore); },
      toggle: toggle, openWithFocus: openWithFocus,
      destroy: function () {
        if (destroyed) return;
        setOpen(false); destroyed = true; cancelClose(); root.clearTimeout(focusTimer);
        trigger.removeEventListener('click', toggle); trigger.removeEventListener('keydown', onTriggerKey);
        host.removeEventListener('focusout', onFocusout); host.removeEventListener('pointerenter', onEnter); host.removeEventListener('pointerleave', onLeave);
        doc.removeEventListener('click', onOutside); doc.removeEventListener('keydown', onKey); root.removeEventListener('cra1:popover-open', onOther);
      },
    };
  }
  async function copy(text) {
    var value = String(text == null ? '' : text);
    if (!value) return false;
    try {
      if (root.navigator.clipboard && root.isSecureContext) { await root.navigator.clipboard.writeText(value); return true; }
    } catch (error) { /* HTTP and denied clipboard permissions use the same fallback. */ }
    var previous = doc.activeElement, input = null, wrote = false;
    function onCopy(event) {
      try { event.clipboardData.setData('text/plain', value); event.preventDefault(); wrote = true; } catch (error) { /* Native selection remains available. */ }
    }
    try {
      input = doc.createElement('textarea'); input.value = value; input.readOnly = true; input.tabIndex = -1;
      input.setAttribute('aria-hidden', 'true');
      input.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:0;opacity:0;';
      var dialog = previous && previous.closest ? previous.closest('dialog[open], [role="dialog"]') : null;
      (dialog || doc.body).appendChild(input);
      doc.addEventListener('copy', onCopy, true);
      focus(input); input.select(); input.setSelectionRange(0, value.length);
      return doc.execCommand('copy') || wrote;
    } catch (error) { return wrote; }
    finally { doc.removeEventListener('copy', onCopy, true); if (input) input.remove(); focus(previous); }
  }
  var toastHost = null;
  function toast(text, tone) {
    if ((tone === 'error' || tone === 'warning') && shared.Errors) text = shared.Errors.message(text);
    text = String(text == null ? '' : text);
    if (!text || !doc || !doc.body) return function () {};
    if (!toastHost || !toastHost.isConnected) {
      toastHost = doc.createElement('div'); toastHost.className = 'cui-toasts';
      toastHost.setAttribute('aria-live', 'polite'); toastHost.setAttribute('aria-atomic', 'false');
      toastHost.dataset.cra1Component = 'toast'; doc.body.appendChild(toastHost);
    }
    tone = ['success', 'error', 'warning', 'info'].indexOf(tone) === -1 ? 'info' : tone;
    var item = doc.createElement('div'); item.className = 'cui-toast cui-toast--' + tone;
    var symbol = doc.createElement('span'); symbol.className = 'cui-toast__icon'; symbol.innerHTML = icon(tone === 'warning' ? 'error' : tone);
    var message = doc.createElement('p'); message.className = 'cui-toast__text'; message.textContent = text;
    var button = doc.createElement('button'); button.type = 'button'; button.className = 'cui-toast__close'; button.setAttribute('aria-label', '关闭提示'); button.innerHTML = icon('close');
    item.append(symbol, message, button); toastHost.appendChild(item);
    var timer;
    function dismiss() { root.clearTimeout(timer); item.remove(); }
    button.addEventListener('click', dismiss);
    item.addEventListener('pointerenter', function () { root.clearTimeout(timer); });
    item.addEventListener('pointerleave', function () { timer = root.setTimeout(dismiss, 3200); });
    item.addEventListener('focusin', function () { root.clearTimeout(timer); });
    item.addEventListener('focusout', function () { timer = root.setTimeout(dismiss, 3200); });
    timer = root.setTimeout(dismiss, 3200);
    return dismiss;
  }
  shared.UI = { createPopover: createPopover, copy: copy, toast: toast, icon: icon, focus: focus };
  if (root.addEventListener) root.addEventListener('cra1:toast', function (event) { var detail = event.detail || {}; toast(detail.text, detail.tone); });
})(typeof window !== 'undefined' ? window : globalThis);

/* Framework-independent, page-scoped announcements. No configuration is cached in storage. */
(function(root){
 'use strict';
 var shared=root.CRA1Shared=root.CRA1Shared||{};
 if(shared.Notices)return;
 var doc=root.document,sequence=0;
 function node(tag,className,text){var n=doc.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n;}
 function glyph(name){return shared.UI.icon(name);}
 function button(className,label,icon){var b=node('button',className);b.type='button';b.setAttribute('aria-label',label);if(icon)b.innerHTML=glyph(icon);return b;}
 function summaryText(item){
  if(String(item.summary||'').trim())return String(item.summary).trim();
  var template=doc.createElement('template');template.innerHTML=item.detail||'';
  template.content.querySelectorAll('script,style,noscript').forEach(function(el){el.remove();});
  template.content.querySelectorAll('br,p,div,li,h1,h2,h3,h4,h5,h6,tr,blockquote').forEach(function(el){el.append(doc.createTextNode(' '));});
  return(template.content.textContent||'').replace(/[\s\u00a0\u200b]+/g,' ').trim().slice(0,400);
 }
 function tokenId(){var token=shared.Request&&shared.Request.getToken?shared.Request.getToken():'';if(!token)return'visitor';var h=2166136261;for(var i=0;i<token.length;i++){h^=token.charCodeAt(i);h=Math.imul(h,16777619);}return'member-'+(h>>>0).toString(36);}
 function mount(host,options){
  options=options||{};if(!host)return null;if(host.__cra1Notices)return host.__cra1Notices;
  var theme=options.theme||shared.theme||doc.documentElement.getAttribute('data-cra1-theme'),path=options.path||root.location.pathname;
  var embedded=false;try{embedded=root.self!==root.top;}catch(e){embedded=true;}
  if(embedded&&!options.preview)return null;
  var destroyed=false,payload={items:[],interval:6},list=[],index=0,hover=false,focused=false,dialog=null,returnFocus=null,readerAll=false,readerList=false,readerAnimation=null,animations=[],rotation=null,refreshTimer=null,expiryTimer=null,due=0,remaining=6000,generation=0,flight=null,identity=tokenId(),memory={},receivedAt=0;
  var reduced=root.matchMedia('(prefers-reduced-motion: reduce)'),scope='cra1-notices-v1:',listeners=[];
  host.classList.add('cra1-notices-host');host.hidden=true;
  var bar=node('section','cra1-notices');bar.setAttribute('aria-label','页面通知');
  var controls=node('div','cra1-notices__index');controls.setAttribute('role','group');controls.setAttribute('aria-label','通知索引');
  var previous=button('cra1-notices__icon cra1-notices__previous','上一条通知','up'),count=button('cra1-notices__count','查看本页通知'),next=button('cra1-notices__icon cra1-notices__next','下一条通知','down');
  controls.append(previous,count,next);
  var body=node('div','cra1-notices__body'),mark=node('span','cra1-notices__mark'),copy=node('div','cra1-notices__copy'),headline=node('div','cra1-notices__headline'),label=node('span','cra1-notices__label'),title=button('cra1-notices__title','阅读完整通知'),summary=node('p','cra1-notices__summary'),action=node('a','cra1-notices__action'),actionText=node('span'),arrow=node('span');arrow.innerHTML=glyph('right');action.append(actionText,arrow);headline.append(label,title,summary);copy.append(headline);body.append(mark,copy,action);
  var dismiss=button('cra1-notices__icon cra1-notices__dismiss','关闭当前通知','close'),live=node('span','cra1-notices__sr');live.setAttribute('role','status');live.setAttribute('aria-live','polite');bar.append(body,controls,dismiss,live);host.replaceChildren(bar);
  function listen(target,event,fn,opts){target.addEventListener(event,fn,opts);listeners.push(function(){target.removeEventListener(event,fn,opts);});}
  function key(){return scope+identity;}
  function remembered(item){var map={};if(!options.preview){try{map=JSON.parse(root[item.dismiss_for==='visit'?'sessionStorage':'localStorage'].getItem(key())||'{}');}catch(e){}}var record=memory[item.id]||map[item.id];if(!record||record.revision!==item.revision)return false;return item.dismiss_for==='day'?record.day===payload.day:record.mode===item.dismiss_for;}
  function closeDialog(){if(!dialog)return;var el=dialog;dialog=null;if(readerAnimation){readerAnimation.cancel();readerAnimation=null;}try{el.close();}catch(e){}el.remove();if(returnFocus&&returnFocus.isConnected)shared.UI.focus(returnFocus);returnFocus=null;schedule(false);}
  function refreshList(){var now=performance.now();list=(payload.items||[]).filter(function(it){return(it.expires_in==null||now-receivedAt<it.expires_in*1000)&&!remembered(it);});}
  function paused(){return hover||focused||!!dialog||doc.hidden||reduced.matches||list.length<2;}
  function schedule(reset){if(rotation!==null){remaining=Math.max(0,due-performance.now());root.clearTimeout(rotation);rotation=null;}if(reset)remaining=payload.interval*1000;if(!destroyed&&!paused()){due=performance.now()+remaining;rotation=root.setTimeout(function(){rotation=null;advance(1,false);},Math.max(0,remaining));}}
  function stopAnimations(){animations.forEach(function(a){a.cancel();});animations=[];}
  function animate(direction){stopAnimations();if(reduced.matches||!body.animate)return;[mark,copy,action].forEach(function(el,i){animations.push(el.animate([{opacity:0,transform:'translateY('+(direction*(i===1?7:5))+'px)'},{opacity:1,transform:'translateY(0)'}],{duration:280,delay:i===2?35:0,easing:'cubic-bezier(.22,1,.36,1)',fill:'backwards'}));});var current=count.querySelector('strong');if(current)animations.push(current.animate([{opacity:.25},{opacity:1}],{duration:180}));}
  function render(reset){
   refreshList();index=list.length?index%list.length:0;host.hidden=!list.length;
   if(!list.length){label.textContent=title.textContent=summary.textContent=actionText.textContent=live.textContent='';title.removeAttribute('title');title.setAttribute('aria-label','阅读完整通知');mark.replaceChildren();count.replaceChildren();action.removeAttribute('href');}
   if(list.length){var item=list[index],description=summaryText(item);label.textContent=item.label||'';label.hidden=!item.label;title.textContent=item.title;title.setAttribute('aria-label','阅读完整通知：'+item.title);title.setAttribute('title',item.title);summary.textContent=description;summary.hidden=!description;headline.classList.toggle('cra1-notices__headline--summary',!!description);mark.innerHTML=item.icon_html||glyph('megaphone');
    count.innerHTML='<strong>'+String(index+1).padStart(2,'0')+'</strong> / '+String(list.length).padStart(2,'0');count.setAttribute('aria-label','第 '+(index+1)+' 条，共 '+list.length+' 条，查看本页通知');
    previous.disabled=next.disabled=list.length<2;dismiss.hidden=!item.dismissible;
    actionText.textContent=item.action_label;action.hidden=item.action==='none';action.href=item.action==='link'?item.url:'#';action.target=item.new_tab?'_blank':'_self';action.rel=item.new_tab?'noopener noreferrer':'';
   }
   schedule(!!reset);
  }
  function advance(direction,manual){if(!list.length)return;index=(index+direction+list.length)%list.length;render(true);animate(direction);if(manual&&list[index])live.textContent='第 '+(index+1)+' 条。'+list[index].title;}
  function renderReader(focusKey,animateContent){
   if(!dialog||!list.length)return;var item=list[index],mobileList=readerAll&&readerList;
   dialog.classList.toggle('cra1-notice-reader--all',readerAll);dialog.setAttribute('data-view',mobileList?'list':'detail');
   var header=node('header','cra1-notice-reader__head'),headingGroup=node('div','cra1-notice-reader__heading'),tag=node('span','cra1-notice-reader__label',item.label||''),heading=node('h2',null,item.title),listHeading=node('h2','cra1-notice-reader__list-heading','本页通知');
   heading.id='cra1-notice-reader-'+sequence;listHeading.id=heading.id+'-list';dialog.setAttribute('aria-labelledby',mobileList&&root.matchMedia('(max-width:640px)').matches?listHeading.id:heading.id);
   tag.hidden=!item.label;headingGroup.append(tag,heading);header.append(headingGroup,listHeading);
   var close=button('cra1-notices__icon cra1-notice-reader__close','关闭通知详情','close');close.dataset.readerFocus='close';close.onclick=closeDialog;header.append(close);
   var main=node('div','cra1-notice-reader__main'),navigation=node('nav','cra1-notice-reader__list');navigation.setAttribute('aria-label','当前页面全部通知');navigation.hidden=!readerAll;
   list.forEach(function(entry,position){var select=button('cra1-notice-reader__entry','阅读通知：'+entry.title),meta=node('span','cra1-notice-reader__entry-label',entry.label||'通知'),name=node('span','cra1-notice-reader__entry-title',entry.title),excerpt=node('span','cra1-notice-reader__entry-summary',summaryText(entry));select.append(meta,name,excerpt);select.dataset.readerFocus='item-'+position;select.setAttribute('aria-current',position===index?'true':'false');select.onclick=function(){index=position;readerList=false;render(true);renderReader('title',true);};navigation.append(select);});
   var content=node('div','cra1-notice-reader__body');content.setAttribute('aria-label','通知正文');content.tabIndex=0;var article=node('article');article.innerHTML=item.detail||'';if(!item.detail)article.textContent=item.summary||'';content.append(article);main.append(navigation,content);
   var footer=node('footer','cra1-notice-reader__footer'),paging=node('div','cra1-notice-reader__paging'),prev=button('cra1-notices__icon','上一条通知（详情）','up'),number=node('span','cra1-notices__count',String(index+1).padStart(2,'0')+' / '+String(list.length).padStart(2,'0')),nextReader=button('cra1-notices__icon','下一条通知（详情）','down');
   function switchReader(direction,key){index=(index+direction+list.length)%list.length;readerList=false;render(true);renderReader(key,true);}
   prev.dataset.readerFocus='previous';nextReader.dataset.readerFocus='next';prev.disabled=nextReader.disabled=list.length<2;prev.onclick=function(){switchReader(-1,'previous');};nextReader.onclick=function(){switchReader(1,'next');};paging.append(prev,number,nextReader);
   var allButton=button('cra1-notice-reader__all','查看本页通知');allButton.textContent='本页通知';allButton.dataset.readerFocus='all';allButton.onclick=function(){readerAll=true;readerList=true;renderReader('item-'+index,false);};paging.append(allButton);
   if(readerAll&&!options.preview){var center=node('a','cra1-notice-reader__all cra1-notice-reader__center','查看所有通知');center.href='/notifications.html';paging.append(center);}
   var links=node('div','cra1-notice-reader__actions'),extras=(item.extra_actions||[]).slice();if(item.url)extras.unshift({label:item.action_label||'了解更多',url:item.url,new_tab:item.new_tab});extras.forEach(function(extra){var a=node('a',null,extra.label);a.href=extra.url;if(extra.new_tab){a.target='_blank';a.rel='noopener noreferrer';}links.append(a);});links.hidden=!extras.length;footer.append(paging,links);
   var status=node('span','cra1-notices__sr','第 '+(index+1)+' 条，共 '+list.length+' 条。'+item.title);status.setAttribute('role','status');heading.tabIndex=-1;heading.dataset.readerFocus='title';
   dialog.replaceChildren(header,main,footer,status);content.scrollTop=0;
   if(readerAnimation)readerAnimation.cancel();if(animateContent&&!reduced.matches&&content.animate)readerAnimation=content.animate([{opacity:0,transform:'translateY(4px)'},{opacity:1,transform:'translateY(0)'}],{duration:180,easing:'ease-out'});
   if(focusKey){var target=dialog.querySelector('[data-reader-focus="'+focusKey+'"]');if(target)shared.UI.focus(target);}
  }
  function openReader(all,source){
   if(!list.length)return;if(!dialog){returnFocus=source;dialog=node('dialog','cra1-notice-reader');dialog.setAttribute('aria-labelledby','cra1-notice-reader-'+(++sequence));doc.body.append(dialog);
    dialog.addEventListener('cancel',function(e){e.preventDefault();closeDialog();});dialog.addEventListener('click',function(e){if(e.target!==dialog)return;var r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog();});
   }
   readerAll=!!all;readerList=!!all;renderReader(null,false);if(!dialog.open&&dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');shared.UI.focus(dialog.querySelector('[data-reader-focus="close"]'));schedule(false);
  }
  function setData(data){if(destroyed)return;var current=list[index]&&(list[index].id+':'+list[index].revision),oldInterval=payload.interval;var oldSignature=(payload.items||[]).map(function(it){return it.id+':'+it.revision;}).join('|');payload=Object.assign({items:[],interval:6,refresh_after:30,day:''},data);payload.interval=Math.max(3,Math.min(300,Number(payload.interval)||6));receivedAt=performance.now();refreshList();var found=list.findIndex(function(item){return item.id+':'+item.revision===current;});index=found>=0?found:0;if(dialog&&oldSignature!==(payload.items||[]).map(function(it){return it.id+':'+it.revision;}).join('|'))closeDialog();render(found<0||oldInterval!==payload.interval);
   queueExpiry();
  }
  function queueExpiry(){root.clearTimeout(expiryTimer);var elapsed=performance.now()-receivedAt,expires=(payload.items||[]).filter(function(it){return it.expires_in!=null&&it.expires_in*1000>elapsed;}).map(function(it){return it.expires_in*1000-elapsed;});if(expires.length)expiryTimer=root.setTimeout(function(){render(false);if(dialog)closeDialog();queueExpiry();},Math.min(2147483647,Math.max(1,Math.ceil(Math.min.apply(null,expires))+1)));}

  function queueRefresh(delay){root.clearTimeout(refreshTimer);if(!destroyed&&!options.preview&&!doc.hidden)refreshTimer=root.setTimeout(refresh,delay||Math.max(1,Math.min(30,Number(payload.refresh_after)||30))*1000);}
  function clearSession(){if(options.preview)return;generation++;if(flight)flight.abort();flight=null;root.clearTimeout(refreshTimer);identity=tokenId();memory={};if(dialog)closeDialog();setData({items:[]});}
  function refresh(){
   if(destroyed||options.preview)return Promise.resolve();if(doc.hidden){root.clearTimeout(refreshTimer);return Promise.resolve();}if(identity!==tokenId())clearSession();if(flight)flight.abort();var session=shared.NotificationSession,token=session?session.token():'',ticket=++generation,controller=new AbortController();flight=controller;var deadline=root.setTimeout(function(){if(ticket===generation){controller.abort();setData({items:[]});}},8000);return root.fetch('/cra1-shared/announcements.php',{method:'POST',credentials:'same-origin',cache:'no-store',headers:session?session.headers():{'Content-Type':'application/json'},body:JSON.stringify({theme:theme,path:path}),signal:controller.signal}).then(function(r){if(!r.ok)throw new Error('unavailable');return r.json();}).then(function(r){if(destroyed||ticket!==generation)return;if(session&&token!==session.token()){clearSession();refresh();return;}if(r.status!==200)throw new Error('announcement unavailable');setData(r.data);}).catch(function(e){if(destroyed||ticket!==generation||e.name==='AbortError')return;setData({items:[]});}).finally(function(){root.clearTimeout(deadline);if(ticket===generation){flight=null;queueRefresh();}});
  }
  listen(previous,'click',function(){advance(-1,true);});listen(next,'click',function(){advance(1,true);});listen(count,'click',function(){openReader(true,count);});listen(title,'click',function(){openReader(false,title);});listen(action,'click',function(e){if(list[index]&&list[index].action==='detail'){e.preventDefault();openReader(false,action);}});
  listen(dismiss,'click',function(){var item=list[index];if(!item||!item.dismissible)return;var record={revision:item.revision,day:payload.day,mode:item.dismiss_for};memory[item.id]=record;if(!options.preview){try{var storage=root[item.dismiss_for==='visit'?'sessionStorage':'localStorage'],map=JSON.parse(storage.getItem(key())||'{}');map[item.id]=record;var ids=Object.keys(map);if(ids.length>200)ids.slice(0,ids.length-200).forEach(function(id){delete map[id];});storage.setItem(key(),JSON.stringify(map));}catch(e){}}render(true);animate(1);live.textContent='已关闭当前通知';if(!host.hidden)shared.UI.focus(title);});
  listen(bar,'pointerenter',function(e){hover=e.pointerType==='mouse';schedule(false);});listen(bar,'pointerleave',function(){hover=false;schedule(false);});
  listen(bar,'focusin',function(){focused=true;schedule(false);});listen(bar,'focusout',function(e){focused=bar.contains(e.relatedTarget);schedule(false);});
  listen(doc,'visibilitychange',function(){if(doc.hidden){clearSession();schedule(false);}else refresh();});
  listen(root,'pagehide',function(){clearSession();root.clearTimeout(rotation);rotation=null;});listen(root,'pageshow',function(e){if(e.persisted){clearSession();refresh();}});listen(reduced,'change',function(){stopAnimations();schedule(false);});
  listen(root,'storage',function(e){if(e.key===key())render(false);});
  if(!options.preview&&shared.NotificationSession)listeners.push(shared.NotificationSession.watch(function(){clearSession();refresh();}));
  var api={refresh:refresh,setData:setData,destroy:function(){destroyed=true;generation++;if(flight)flight.abort();[rotation,refreshTimer,expiryTimer].forEach(function(timer){root.clearTimeout(timer);});listeners.forEach(function(fn){fn();});stopAnimations();if(dialog)closeDialog();host.replaceChildren();host.hidden=true;delete host.__cra1Notices;}};host.__cra1Notices=api;
  if(options.payload)setData(options.payload);else refresh();return api;
 }
 function start(){doc.querySelectorAll('[data-cra1-notices]').forEach(function(host){mount(host,{theme:host.getAttribute('data-notice-theme')||shared.theme});});}
 shared.Notices={mount:mount,start:start};
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',start,{once:true});else root.setTimeout(start,0);
})(window);
