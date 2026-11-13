/* Shared enhancement lifecycle; no business events or component values change.
   Frameworks may render the decorative spans explicitly. Legacy hosts receive
   the same spans through Styles' existing observer; standalone admin owns one
   small observer. With JS/CSS unavailable every control remains usable. */
(function (root) {
 'use strict';
 var shared=root.CRA1Shared=root.CRA1Shared||{};
 if(shared.UIEffects)return;
 var doc=root.document, started=false, managed=false, observer=null, intersection=null, raf=0;
 var preference=root.matchMedia?root.matchMedia('(prefers-reduced-motion: reduce)'):{matches:false};
 var tracked=new Set(), records=new WeakMap(), animations=new Map(), pointer=null, mouseTarget=null;
 var selector='.cui-button,.btn-aurora,.cra1-header__login,.cra1-upanel__tag--console,.cui-tabs__trigger,.cui-choice,.cui-select-option,.admin-menu-select__option,.cui-menu-item,.el-select-dropdown__item,[data-cui-edge],.cui-edge,.cra1-primary-item,.cra1-nav-l2,.cra1-nav-l3,.cra1-nav-recent,.el-tabs__item,.el-radio-button__inner,.el-checkbox-button__inner,[data-cui-interactive],[data-cui-reveal],.ring-sheen,.cui-card,.lift-card,.cui-input,.cui-select-trigger,.cui-date-trigger,.admin-menu-select,.cra1-ta-msel__trigger,.node-region-trigger,.el-input__inner,.el-textarea__inner,a.product-card,a.feature-item,a.glass-card,a.article-card,a.choice-card,a.link-card,a.rail-link,a.hairline-card';
 var actionSelector='button,input,select,textarea,[role="button"],[role="tab"],[role="option"],[role="menuitem"],.cui-button,.btn-aurora,.cra1-header__login,.cra1-upanel__tag--console,.cui-tabs__trigger,.cui-choice,.cui-select-option,.admin-menu-select__option,.cui-menu-item,.el-select-dropdown__item,.cra1-primary-item,.cra1-nav-l2,.cra1-nav-l3,.cra1-nav-recent,.el-tabs__item,.el-radio-button__inner,.el-checkbox-button__inner';
 var clickableCardSelector='[data-cui-interactive="card"],a.product-card,a.feature-item,a.glass-card,a.article-card,a.choice-card,a.link-card,a.hairline-card,a.cui-card';
 var cardSelector=clickableCardSelector+',.cui-card,.lift-card,[data-cui-edge="hover"],.ring-sheen';
 var forbidden='.cl-rail-card,.cl-rail-dock,.cl-config-panel,.f-order,.order-right,.el-table,.cui-table,.el-table__fixed,.main-card,.cra1-native-page__content';
 function allowed(){return doc&&doc.documentElement.matches('[data-cra1-theme],[data-cra1-ui]');}
 function disabled(el){return el.matches(':disabled,[aria-disabled="true"],[aria-busy="true"],[aria-invalid="true"],[data-disabled],.is-disabled,.is-loading,.cui-button--danger,.el-button--danger')||!!el.closest('.is-error');}
 function nativeContent(el){return doc.documentElement.matches('[data-cra1-native-module],[data-cra1-native-cart]')&&!!el.closest('.config-box .content,.el-dialog__wrapper,.el-message-box__wrapper,.el-select-dropdown,.el-cascader__dropdown,.el-picker-panel,.el-popper');}
 function optedOut(el){return !!el.closest('[data-cui-effects="none"],.cra1-upanel__tag--console');}
 function direct(el,name){return Array.from(el.children).find(function(child){return child.classList.contains(name);});}
 function decoration(el,name,record){var found=direct(el,name);if(found)return found;var node=doc.createElement('span');node.className=name;node.setAttribute('aria-hidden','true');node.dataset.cuiOwned='effects';el.appendChild(node);record.nodes.push(node);return node;}
 function ownClass(el,name,on,record){if(on&&!el.classList.contains(name)){el.classList.add(name);record.classes.add(name);}else if(!on&&record.classes.has(name)){el.classList.remove(name);record.classes.delete(name);}}
 function safeLift(el){if(nativeContent(el)||el.matches(forbidden)||el.closest('table,.el-table,.cui-table,.cl-rail-dock,.f-order,.order-right'))return false;if(el.querySelector(forbidden+',table,.el-dialog__wrapper,.el-message-box__wrapper,[role="dialog"],.cui-dialog,.cui-sheet,.fixed,[style*="position: fixed"],[style*="position:fixed"]'))return false;var s=root.getComputedStyle(el);if(s.position==='fixed'||s.position==='sticky')return false;return !Array.from(el.querySelectorAll('*')).some(function(child){var position=root.getComputedStyle(child).position;return position==='fixed'||position==='sticky';});}
 // Decoration opt-ins identify a card, never its business selection. A featured
 // information card may opt into hover without acquiring a click handler.
 function selected(el){return el.matches('[aria-selected="true"],[aria-pressed="true"],[data-selected="true"],[data-state="active"],[data-state="checked"],.is-selected,.selected,.is-active');}
 function edgeCandidate(el){if(optedOut(el)||nativeContent(el)||el.matches(actionSelector+','+forbidden)||!el.matches(cardSelector)||el.closest('table,.el-table,.cui-table,.cl-rail-dock,.f-order,.order-right'))return false;var position=root.getComputedStyle(el).position;return position!=='fixed'&&position!=='sticky';}
 // Only actual card candidates participate. Page shells, field wrappers and
 // plain containers never suppress a card. The outermost eligible card owns
 // decoration; an inner selected card keeps its business state unchanged.
 function edgeCard(el){if(!edgeCandidate(el))return false;var ancestor=el.parentElement&&el.parentElement.closest(cardSelector);while(ancestor){if(edgeCandidate(ancestor))return false;ancestor=ancestor.parentElement&&ancestor.parentElement.closest(cardSelector);}return true;}
 function updateEdge(el,rec,eligible){
  var edge=eligible&&!disabled(el)&&(rec.hover||selected(el));
  ownClass(el,'cui-edge-host',edge,rec);ownClass(el,'cui-edge-active',edge,rec);
  if(edge)decoration(el,'cui-edge-segment',rec);
  else rec.nodes=rec.nodes.filter(function(node){if(node.classList.contains('cui-edge-segment')){node.remove();return false;}return true;});
 }
 function clean(el){var rec=records.get(el);if(!rec)return;if(intersection)intersection.unobserve(el);rec.nodes.forEach(function(node){node.remove();});rec.classes.forEach(function(name){el.classList.remove(name);});el.style.removeProperty('--cui-pointer-x');el.style.removeProperty('--cui-pointer-y');tracked.delete(el);records.delete(el);}
 function apply(el){
  if(!el||el.nodeType!==1||el.closest('[data-cui-owned="effects"]')||(!records.has(el)&&!el.matches(selector)))return;
  if(nativeContent(el)||optedOut(el)){clean(el);return;}
  var rec=records.get(el);if(!rec){rec={nodes:[],classes:new Set(),visible:false,reveal:false,hover:false};records.set(el,rec);tracked.add(el);if(intersection)intersection.observe(el);}
  var ordinary=el.matches('.cui-button,.btn-aurora,.cra1-header__login')&&!el.matches('.cui-button--ghost,.cui-button--icon,.cui-button--link,.cui-button--danger,.el-button--text')&&!disabled(el);
  ownClass(el,'cui-rainbow',ordinary,rec);if(ordinary)decoration(el,'cui-button-glow',rec);
  var eligible=edgeCard(el),card=eligible&&el.matches(clickableCardSelector)&&safeLift(el);
  ownClass(el,'cui-edge-card',eligible,rec);rec.hover=!!(eligible&&!preference.matches&&!doc.hidden&&mouseTarget&&mouseTarget.isConnected&&el.contains(mouseTarget));
  updateEdge(el,rec,eligible);
  ownClass(el,'cui-pointer-card',card,rec);
  if(!card)ownClass(el,'cui-pointer-active',false,rec);
 }
 function cleanupDisconnected(){tracked.forEach(function(el){if(!el.isConnected)clean(el);});animations.forEach(function(el,animation){if(!el.isConnected){animation.cancel();animations.delete(animation);}});}
 function scan(node){if(!started||!node||node.nodeType!==1&&node.nodeType!==9)return;if(node.nodeType===1)apply(node);node.querySelectorAll(selector).forEach(apply);cleanupDisconnected();}
 function update(changes){if(!started)return;changes.forEach(function(change){if(change.target.nodeType!==1)return;if(change.type==='childList'||change.type==='attributes'){apply(change.target);change.target.querySelectorAll(selector).forEach(apply);}if(change.type==='childList'){var card=change.target.closest('.cui-pointer-card');if(card&&card!==change.target)apply(card);}if(change.type==='attributes'){var parent=change.target.closest('.el-radio-button,.el-checkbox-button');if(parent)parent.querySelectorAll('.el-radio-button__inner,.el-checkbox-button__inner').forEach(apply);}});cleanupDisconnected();}
 function animate(el,frames,options){if(preference.matches||doc.hidden||!el.animate)return;animations.forEach(function(target,previous){if(target===el){previous.cancel();animations.delete(previous);}});var anim=el.animate(frames,options);animations.set(anim,el);var done=function(){animations.delete(anim);};anim.onfinish=done;anim.oncancel=done;return anim;}
 function reveal(el,rec,inView,entry){
  if(!el.hasAttribute('data-cui-reveal')||el.closest('[data-enter],[data-reveal],dialog,[role="dialog"],.cui-popover,.el-popover')||(el.parentElement&&el.parentElement.closest('[data-cui-reveal]'))||!safeLift(el)||preference.matches||doc.hidden)return;
  if(!inView||entry.intersectionRatio<.12){if(rec.reveal){rec.reveal=false;if(!el.contains(doc.activeElement)){var exit=entry.boundingClientRect.top<0?-8:8;animate(el,[{opacity:1,translate:'0 0'},{opacity:.35,translate:'0 '+exit+'px'}],{duration:140,easing:'ease-out'});}}return;}
  if(rec.reveal)return;rec.reveal=true;
  var dy=entry.boundingClientRect.top<0?-8:8;
  animate(el,[{opacity:.15,translate:'0 '+dy+'px'},{opacity:1,translate:'0 0'}],{duration:340,easing:'cubic-bezier(.23,1,.32,1)'});
 }
 function settle(){animations.forEach(function(el,anim){anim.cancel();});animations.clear();doc.querySelectorAll('.cui-ripple-clip[data-cui-owned="effects"]').forEach(function(node){node.remove();});}
 function sync(){var paused=preference.matches||doc.hidden;doc.documentElement.toggleAttribute('data-cui-effects-paused',paused);if(paused){settle();pointer=null;mouseTarget=null;tracked.forEach(function(el){var rec=records.get(el);if(rec){rec.hover=false;ownClass(el,'cui-pointer-active',false,rec);updateEdge(el,rec,el.classList.contains('cui-edge-card'));}});}}
 function ripple(event){
  if(preference.matches||doc.hidden||event.button>0||!event.target.closest)return;
  var el=event.target.closest('.cui-button,.cui-choice,.cui-tabs__trigger');if(!el||optedOut(el)||nativeContent(el)||disabled(el)||el.matches('.cui-button--ghost,.cui-button--icon,.cui-button--link')||!el.animate)return;
  var rect=el.getBoundingClientRect(),size=Math.max(rect.width,rect.height)*2,clip=doc.createElement('span'),wave=doc.createElement('span');clip.className='cui-ripple-clip';clip.dataset.cuiOwned='effects';clip.setAttribute('aria-hidden','true');wave.className='cui-ripple';var x=event.clientX-rect.left,y=event.clientY-rect.top;
  wave.style.cssText='width:'+size+'px;height:'+size+'px;left:'+(x-size/2)+'px;top:'+(y-size/2)+'px;';clip.appendChild(wave);el.appendChild(clip);
  var anim=animate(wave,[{transform:'scale(0)',opacity:1},{transform:'scale(1)',opacity:0}],{duration:460,easing:'cubic-bezier(.23,1,.32,1)'});
  if(anim){var done=function(){animations.delete(anim);clip.remove();};anim.onfinish=done;anim.oncancel=done;}else clip.remove();
 }
 function pointerOver(event){if(preference.matches||doc.hidden||event.pointerType!=='mouse'||!event.target.closest)return;mouseTarget=event.target;var el=event.target.closest('.cui-edge-card');if(!el||el.contains(event.relatedTarget)||disabled(el))return;var rec=records.get(el);if(rec){rec.hover=true;updateEdge(el,rec,true);}}
 function pointerMove(event){if(preference.matches||doc.hidden||event.pointerType!=='mouse'||!event.target.closest)return;mouseTarget=event.target;var el=event.target.closest('.cui-pointer-card');if(!el||disabled(el))return;pointer={el:el,x:event.clientX,y:event.clientY};if(raf)return;raf=root.requestAnimationFrame(function(){raf=0;var data=pointer;if(!data||!data.el.isConnected)return;var rect=data.el.getBoundingClientRect(),rec=records.get(data.el);if(!rec||!rec.hover)return;data.el.style.setProperty('--cui-pointer-x',(data.x-rect.left)+'px');data.el.style.setProperty('--cui-pointer-y',(data.y-rect.top)+'px');ownClass(data.el,'cui-pointer-active',true,rec);});}
 function pointerOut(event){if(event.pointerType==='mouse')mouseTarget=event.relatedTarget&&event.relatedTarget.nodeType===1?event.relatedTarget:null;var el=event.target.closest&&event.target.closest('.cui-edge-card');if(!el||el.contains(event.relatedTarget))return;if(pointer&&pointer.el===el)pointer=null;var rec=records.get(el);if(rec){rec.hover=false;ownClass(el,'cui-pointer-active',false,rec);updateEdge(el,rec,true);}}
 function focusIn(event){animations.forEach(function(el,anim){if(el.contains(event.target)){anim.cancel();animations.delete(anim);}});}
 function start(options){
  if(started||!allowed())return;started=true;managed=!!(options&&options.managed);
  if(root.IntersectionObserver)intersection=new root.IntersectionObserver(function(entries){entries.forEach(function(entry){var el=entry.target,rec=records.get(el);if(!rec)return;rec.visible=entry.isIntersecting;ownClass(el,'cui-effect-offscreen',!entry.isIntersecting,rec);reveal(el,rec,entry.isIntersecting,entry);});},{threshold:[0,.12]});
  if(!managed&&root.MutationObserver){observer=new root.MutationObserver(function(changes){var nodes=new Set();changes.forEach(function(change){if(change.type==='childList')change.addedNodes.forEach(function(node){if(node.nodeType===1&&!(node.dataset&&node.dataset.cuiOwned==='effects'))nodes.add(node);});});nodes.forEach(scan);update(changes);});observer.observe(doc.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','aria-selected','aria-pressed','aria-disabled','aria-busy','aria-invalid','disabled','data-disabled','data-selected','data-state','data-cui-edge','data-cui-interactive','data-cui-effects']});}
  doc.addEventListener('pointerdown',ripple,true);doc.addEventListener('pointerover',pointerOver,{passive:true});doc.addEventListener('pointermove',pointerMove,{passive:true});doc.addEventListener('pointerout',pointerOut,{passive:true});doc.addEventListener('focusin',focusIn);doc.addEventListener('visibilitychange',sync);
  if(preference.addEventListener)preference.addEventListener('change',sync);else if(preference.addListener)preference.addListener(sync);
  sync();scan(doc);
 }
 function destroy(){if(!started)return;started=false;if(observer)observer.disconnect();if(intersection)intersection.disconnect();observer=intersection=null;if(raf)root.cancelAnimationFrame(raf);raf=0;pointer=mouseTarget=null;settle();tracked.forEach(clean);doc.documentElement.removeAttribute('data-cui-effects-paused');doc.removeEventListener('pointerdown',ripple,true);doc.removeEventListener('pointerover',pointerOver);doc.removeEventListener('pointermove',pointerMove);doc.removeEventListener('pointerout',pointerOut);doc.removeEventListener('focusin',focusIn);doc.removeEventListener('visibilitychange',sync);if(preference.removeEventListener)preference.removeEventListener('change',sync);else if(preference.removeListener)preference.removeListener(sync);}
 shared.UIEffects={start:start,scan:scan,update:update,destroy:destroy};
})(typeof window!=='undefined'?window:globalThis);
