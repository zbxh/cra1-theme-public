/* Framework-neutral header primitives. Alpine and Vue only supply data/actions. */
(function (root) {
  'use strict';
  var shared=root.CRA1Shared=root.CRA1Shared||{}, sequence=0;
  if (shared.HeaderActions) return;
  var paths={
    support:'<path d="M4 13v-3a8 8 0 0 1 16 0v3"/><rect x="2.5" y="10" width="4" height="8" rx="2"/><rect x="17.5" y="10" width="4" height="8" rx="2"/><path d="M19.5 18v1a2 2 0 0 1-2 2H14"/><rect x="10" y="19.5" width="4" height="3" rx="1.5"/>',
    cart:'<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3h2.2l2.2 11.2a1.6 1.6 0 0 0 1.6 1.3h8.6a1.6 1.6 0 0 0 1.6-1.3L20 7H6"/>',
    message:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 7 8.5 6 8.5-6"/>',
    language:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a16 16 0 0 1 0 18 16 16 0 0 1 0-18Z"/>',
    edit:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/>',
    logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    security:'<path d="M12 3 5 6v5c0 4.5 2.7 7.8 7 10 4.3-2.2 7-5.5 7-10V6l-7-3Z"/>',
    finance:'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
    arrow:'<path d="m9 6 6 6-6 6"/>',
    link:'<path d="M10 13a5 5 0 0 0 7 .5l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7-.5l-3 3a5 5 0 0 0 7 7l2-2"/>'
  };
  function icon(name) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(paths[name]||paths.link)+'</svg>'; }
  function el(tag,cls,text) { var n=root.document.createElement(tag); if(cls)n.className=cls; if(text!==undefined)n.textContent=String(text); return n; }
  function glyph(name,cls) { var n=el('span',cls||'cra1-header-glyph'); n.innerHTML=icon(name); n.setAttribute('aria-hidden','true'); return n; }
  function link(parent,text,url,cls,options) {
    var a=el('a',cls,text); a.href=url;
    if(options&&options.onNavigate)a.addEventListener('click',function(e){if(!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&e.button===0){e.preventDefault();options.onNavigate(url);}});
    parent.appendChild(a); return a;
  }
  function label(options,key,fallback) { return options.labels&&options.labels[key]!==undefined?options.labels[key]:fallback; }
  function mountAccount(host,options) {
    options=options||{}; host.classList.add('cra1-account','cra1-account--header');
    var trigger=el('button','cra1-account__trigger'); trigger.type='button'; trigger.setAttribute('aria-label','账户菜单'); trigger.setAttribute('aria-haspopup','true');
    var avatar=el('span','cra1-account__avatar'); trigger.appendChild(avatar);
    var panel=el('div','cra1-account__menu cra1-account__menu--rich cra1-shared-panel'); panel.hidden=true; panel.setAttribute('role','region'); panel.setAttribute('aria-label','账户信息与常用功能');
    var first=el('div','cra1-upanel__section'),row=el('div','cra1-upanel__row'),large=el('span','cra1-account__avatar cra1-upanel__avatar'),identity=el('div','cra1-upanel__id'),name=el('span','cra1-upanel__name'),username=el('span','cra1-upanel__username');
    name.appendChild(username); var edit=link(name,'','/account.htm','cra1-upanel__mini-btn',options); edit.setAttribute('aria-label','进入账户信息'); edit.appendChild(glyph('edit'));
    var id=el('span','cra1-upanel__sub'); identity.append(name,id); row.append(large,identity); first.appendChild(row);
    var tags=el('div','cra1-upanel__tags'),consoleLink=link(tags,'','/home.htm','cra1-upanel__tag cra1-upanel__tag--console',options),fog=el('span','cra1-upanel__tag-fog'); fog.setAttribute('aria-hidden','true'); consoleLink.append(fog,el('span','cra1-upanel__tag-txt','控制台'));
    link(tags,label(options,'basic','基本资料'),'/account.htm','cra1-upanel__tag',options);
    link(tags,label(options,'accountSecurity','安全设置'),'/account.htm?tab=security','cra1-upanel__tag',options); first.appendChild(tags);
    var logout=el('button','cra1-upanel__logout'); logout.type='button';logout.append(glyph('logout'),root.document.createTextNode('退出登录')); var loggingOut=false;
    logout.addEventListener('click',async function(){if(loggingOut)return;loggingOut=true;logout.disabled=true;try{if(options.onLogout)await options.onLogout();}finally{loggingOut=false;logout.disabled=false;}});first.appendChild(logout);
    var security=el('div','cra1-upanel__section'),head=link(security,'','/security.htm','cra1-upanel__head',options);head.append(glyph('security'),el('span','',label(options,'security','安全中心')),glyph('arrow','cra1-upanel__chev'));
    var links=el('div','cra1-upanel__links');[['安全概览','overview'],['API 密钥','api'],['SSH 密钥','ssh']].forEach(function(x){link(links,x[0],'/security.htm?tab='+x[1],'cra1-upanel__link',options);});security.appendChild(links);
    var finance=el('div','cra1-upanel__section'),fhead=link(finance,'','/finance.htm','cra1-upanel__head',options);fhead.append(glyph('finance'),el('span','',label(options,'finance','财务信息')),glyph('arrow','cra1-upanel__chev'));
    var balanceRow=el('div','cra1-upanel__kv'),balance=el('span','cra1-upanel__kv-value'),amount=el('span','cra1-upanel__balance');balance.appendChild(amount);link(balance,'余额记录','/finance.htm?tab=credit','cra1-upanel__link',options);balanceRow.append(el('span','cra1-upanel__kv-label','可用余额'),balance);
    var orderRow=el('div','cra1-upanel__kv'),order=el('span','cra1-upanel__kv-value');link(order,'查看订单','/finance.htm?tab=orders','cra1-upanel__link',options);orderRow.append(el('span','cra1-upanel__kv-label','我的订单'),order);finance.append(balanceRow,orderRow);
    panel.append(first,security,finance);host.replaceChildren(trigger,panel);
    var popover=shared.UI.createPopover({root:host,trigger:trigger,panel:panel,hover:true,beforeOpen:options.beforeOpen,onOpenChange:options.onOpenChange});
    function update() {
      var u=options.getUser?options.getUser():options.user||{};if(!u)return;
      shared.Avatar.register(u);var style=shared.Avatar.style(u),text=shared.Avatar.letter(u);
      [avatar,large].forEach(function(n){n.style.backgroundImage=style.backgroundImage||'';n.style.backgroundSize='cover';n.style.backgroundPosition='center';n.textContent=text;});
      username.textContent=u.username||u.name||u.email||u.phone||'会员';username.title=username.textContent;
      id.textContent='账号 ID：'+(u.id||u.accountId||'—');amount.textContent=shared.Runtime.money(u.credit||0);
    }
    function avatarChanged(e){var u=options.getUser?options.getUser():options.user;if(u&&String(u.id||u.accountId)===String(e.detail.id))update();}
    root.addEventListener('cra1:avatar-updated',avatarChanged);update();
    return {update:update,setOpen:popover.setOpen,close:popover.close,toggle:popover.toggle,openWithFocus:popover.openWithFocus,destroy:function(){popover.destroy();root.removeEventListener('cra1:avatar-updated',avatarChanged);host.replaceChildren();}};
  }
  function safeUrl(url,image) { return typeof url==='string'&&!/[\x00-\x20\\]/.test(url)&& (image?/^(?:https?:\/\/|\/(?!\/))/i:/^(?:https?:\/\/|\/(?!\/)|#|tel:|mailto:)/i).test(url); }
  function mountSupport(host,options) {
    options=options||{};host.classList.add('cra1-header-support');
    var trigger=el('button','cra1-header-support__trigger');trigger.type='button';trigger.setAttribute('aria-label','客服');trigger.setAttribute('aria-haspopup','true');trigger.innerHTML=icon('support');
    var panel=el('div','cra1-header-support__panel cra1-shared-panel');panel.hidden=true;panel.id='cra1-support-'+(++sequence);panel.setAttribute('role','region');panel.setAttribute('aria-label','客服与联系');
    host.replaceChildren(trigger,panel);var popover=shared.UI.createPopover({root:host,trigger:trigger,panel:panel,hover:true,beforeOpen:options.beforeOpen});
    function update(config) {
      config=config||(options.getConfig?options.getConfig():options.config)||{};panel.replaceChildren();
      host.hidden=!config.enabled||!config.groups||!config.groups.length;if(host.hidden){popover.close();return;}
      config.groups.forEach(function(group){
        var section=el('div','cra1-header-support__section');if(group.title)section.appendChild(el('p','cra1-header-support__title',group.title));
        (group.items||[]).forEach(function(item){
          var action=item.action==='link'&&safeUrl(item.href,false)?'link':item.action==='copy'?'copy':'text';
          var n=el(action==='link'?'a':action==='copy'?'button':'div','cra1-header-support__item'+(action==='text'?' cra1-header-support__item--text':''));n.setAttribute('aria-label',(action==='copy'?'复制':'')+(item.label||'联系信息'));
          if(action==='link'){n.href=item.href;if(item.external&&item.newWindow){n.target='_blank';n.rel='noopener noreferrer';}}
          if(item.showIcon){
            var art=el('span','cra1-header-support__icon');art.setAttribute('aria-hidden','true');
            if(item.icon_svg){art.innerHTML=item.icon_svg;}else if(item.icon_img&&safeUrl(item.icon_img,true)){var img=el('img');img.src=item.icon_img;img.alt='';img.loading='lazy';art.appendChild(img);}else art.innerHTML=icon('link');
            var vars=shared.IconStyle?shared.IconStyle.vars(item.icon_style,false):{};Object.keys(vars).forEach(function(k){art.style.setProperty(k,vars[k]);});n.appendChild(art);
          }
          if(item.showText)n.appendChild(el('span','',item.label||''));
          if(action==='copy'){n.type='button';n.addEventListener('click',async function(){var ok=await shared.UI.copy(item.copy||'');status.hidden=false;status.textContent=ok?'账号已复制':'复制失败，请手动复制：'+(item.copy||'');});}section.appendChild(n);
        });panel.appendChild(section);
      });
      var status=el('p','cra1-header-support__status');status.hidden=true;status.setAttribute('role','status');status.setAttribute('aria-live','polite');panel.appendChild(status);
    }
    update();return {update:update,close:popover.close,toggle:popover.toggle,destroy:function(){popover.destroy();host.replaceChildren();}};
  }
  shared.HeaderActions={icon:icon,mountAccount:mountAccount,mountSupport:mountSupport};
})(typeof window!=='undefined'?window:globalThis);
