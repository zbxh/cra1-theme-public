/* Runs before page scripts. All business requests stay in this preview fixture. */
(function(){
  'use strict';var boot=window.__THEME_PREVIEW__||{},snap=boot.snapshot||{},common=boot.common||{};
  var authPage=boot.domain==='member'&&['login','regist'].indexOf(boot.editorId)>=0;
  Object.defineProperty(window,'__CRA1_RUNTIME__',{value:{projection_version:2,page:boot.editorId,common:common,auth_appearance:authPage?boot.authAppearance:undefined,auth:authPage?{login:['email-password','phone-password','phone-code'],register:[{type:'email',code:true},{type:'phone',code:true}],reset:['email','phone'],preferred:'email-password',captcha:{}}:{},features:{renew:true,refund:true,ticket:true,news:true,recharge_open:1,withdraw_open:0},links:{},locale:{current:'zh-cn'}},writable:false,configurable:false});
  window.__CRA1_MEMBER_SNAPSHOT__=snap;window.__CRA1_MEMBER_SNAPSHOT_PROMISE__=Promise.resolve(snap);
  window.__CRA1_CART_SNAPSHOT__=snap;window.__CRA1_CART_SNAPSHOT_PROMISE__=Promise.resolve(snap);
  window.__CRA1_FEAT__={ready:true,recharge_open:1,withdraw_open:0};window.__CRA1_COMMON__=common;
  // Theme components normally use browser storage. Keep an in-memory copy in
  // this frame, including property-style access, without touching live tokens.
  function memoryStorage(initial){var values=Object.assign({},initial);return new Proxy({getItem:function(k){return Object.prototype.hasOwnProperty.call(values,k)?String(values[k]):null},setItem:function(k,v){values[k]=String(v)},removeItem:function(k){delete values[k]},clear:function(){values={}},key:function(i){return Object.keys(values)[i]||null}},{get:function(t,k){if(k==='length')return Object.keys(values).length;return k in t?t[k]:values[k]},set:function(t,k,v){values[k]=String(v);return true}})}
  Object.defineProperty(window,'localStorage',{value:memoryStorage({jwt:'preview-demo-token',lang:'zh-cn',common_set_before:JSON.stringify(common)}),configurable:true});
  Object.defineProperty(window,'sessionStorage',{value:memoryStorage({product_information:JSON.stringify({id:1,product_id:1,qty:1,config_options:{},customfield:{}})}),configurable:true});
  try{Object.defineProperty(document,'cookie',{get:function(){return ''},set:function(){},configurable:true})}catch(e){}
  var host={id:1,product_id:1,module:'idcsmart_common',product_name:'演示云服务器',name:'演示实例',status:'Active',ip:'192.0.2.10',due_time:Math.floor(Date.now()/1000)+2592000,type:'server',client_notes:'示例数据',base_info:'2 核 CPU · 4GB 内存',billing_cycle:'month',billing_cycle_name:'月付',billing_cycle_time:2592000,is_delete:0,price:39,renew_amount:39};
  var account={id:1,username:'演示用户',email:'demo@example.com',phone:'138****0000',credit:100,host_num:1,host_active_num:1,unpaid_order:0,consume:100,this_month_consume:39,expiring_count:0};
  var product={id:1,name:'演示云服务器',price:39,cycle:'月',description:'2 核 CPU · 4GB 内存 · 50GB 云盘',type:'server',module:'idcsmart_common',hidden:0,stock_control:0,qty:99,customfield:{is_domain:0}};
  function payload(url,method){
    if(/\/product\/\d+\/config_option(?:\?|$)/.test(String(url)))return{status:200,msg:'示例配置',data:method==='GET'?{content:(boot.moduleHtml||'').replace(/<script\b[^>]*>.*?<\/script>/gs,'')}:{preview:[{name:'配置',value:'2 核 CPU · 4GB 内存'}],price:39,price_total:39,base_price:39,price_client_level_discount:0,price_promo_code_discount:0,price_event_promotion_discount:0}};
    if(method&&!/^(GET|HEAD)$/i.test(method))return{status:400,msg:'预览中不执行业务操作',data:{}};
    var parsedUrl=new URL(String(url),location.href);if(parsedUrl.pathname==='/cra1-shared/compat.php')url='/theme/'+(parsedUrl.searchParams.get('target')||'');var path=String(url).split('?')[0],data={list:[],count:0,account:account,client:account,common:common,product:product,host:host,info:host,menu:[],currency:{prefix:'¥',suffix:''}};
    if(/snapshot/.test(String(url)))return{status:200,msg:'示例数据',data:snap};
    if(/\/(?:cra1-theme|theme)\/access$/.test(path))data={all:true,actions:{},rules:[],known:[],security:[],required_profile:false};
    else if(/\/common$/.test(path))data=Object.assign({common:common},common);
    else if(/\/country$/.test(path))data={list:[{phone_code:'86',name:'中国'},{phone_code:'1',name:'美国'}]};
    else if(/\/index$|\/account$/.test(path))data={account:account};
    else if(/custom.*field|self_defined_field/i.test(path))data={data:[],list:[]};
    else if(/idcsmart_common\/product\/\d+\/configoption/.test(path))data={common_product:{pay_type:'recurring',allow_qty:1,allow_repeat:1,max_qty:10,min_qty:1},configoptions:[{id:1,option_name:'CPU 与内存',option_type:'select',is_show:1,subs:[{id:1,option_name:'2 核 CPU · 4GB 内存'},{id:2,option_name:'4 核 CPU · 8GB 内存'}]}],custom_cycles:[{id:1,name:'月付',is_default:1,amount:39}],cycles:{onetime:'-1.00'}};
    else if(/\/index\/host|\/host$|\/cra1-theme\/member\/products$/.test(path))data={list:[host],count:1};
    else if(/\/mf_cloud\/\d+$/.test(path))data={id:1,ip:'192.0.2.10',cpu:2,memory:4,bw:100,flow:1000,system_disk:{size:50,type:'SSD'},data_disk:[],image:{name:'Ubuntu 22.04'},data_center:{name:'示例地区',country:'CN'},config:{},status:'on'};
    else if(/\/host\/\d/.test(path))data={host:host,info:host,product:product,client:account};
    else if(/product\/group\/first/.test(path))data={list:[{id:1,name:'云产品'}],count:1};
    else if(/product\/group\/second/.test(path))data={list:[{id:1,name:'云服务器',parent_id:1}],count:1};
    else if(/\/product\/\d/.test(path))data={product:product};
    else if(/\/product$/.test(path))data={list:[product],count:1};
    else if(/menu/.test(path))data={menu:[],list:[],navs:[],system_nav:[],plugin_nav:[]};
    else if(/cart/.test(path))data={list:[{id:1,product_id:1,name:product.name,product_name:product.name,qty:1,price:39,amount:39,billing_cycle:'month',config_options:{},customfield:{is_domain:0},description:product.description}],count:1};
    else if(/ticket\/type/.test(path))data={list:[{id:1,name:'技术支持'}],count:1};
    else if(/order/.test(path))data={list:[],count:0,order:{id:1,status:'Unpaid',amount:39,order_num:'演示订单'}};
    return{status:200,msg:'示例数据',data:data};
  }
  var originalFetch=window.fetch.bind(window);
  window.fetch=function(input,options){var u=typeof input==='string'?input:input.url,method=options&&options.method||input.method||'GET';var parsed=new URL(u,location.href);if(/^(GET|HEAD)$/i.test(method)&&parsed.origin===boot.resource_origin&&/^\/(?:web\/cra1|clientarea\/template|cart\/template|home\/template|plugins|upload|cra1-shared)\//.test(parsed.pathname)&&/\.(css|js|svg|png|jpe?g|webp|gif|ico|woff2?)(?:$|\?)/i.test(parsed.pathname))return originalFetch(input,Object.assign({},options,{credentials:'omit'}));return Promise.resolve(new Response(JSON.stringify(payload(u,method)),{status:200,headers:{'Content-Type':'application/json'}}))};
  function PreviewXHR(){this.headers={};this.readyState=0;this.status=0;this.responseType='';this.listeners={};this.upload={addEventListener:function(){},removeEventListener:function(){}};}
  PreviewXHR.prototype.open=function(method,url){this.method=method;this.url=url;this.readyState=1};
  PreviewXHR.prototype.setRequestHeader=function(k,v){this.headers[k]=v};PreviewXHR.prototype.getResponseHeader=function(){return'application/json'};PreviewXHR.prototype.getAllResponseHeaders=function(){return'Content-Type: application/json\r\n'};
  PreviewXHR.prototype.addEventListener=function(k,fn){(this.listeners[k]||(this.listeners[k]=[])).push(fn)};PreviewXHR.prototype.removeEventListener=function(){};PreviewXHR.prototype.abort=function(){};
  PreviewXHR.prototype.send=function(){var self=this;setTimeout(function(){self.status=200;self.readyState=4;self.responseURL=self.url;self.responseText=JSON.stringify(payload(self.url,self.method));self.response=self.responseType==='json'?JSON.parse(self.responseText):self.responseText;['readystatechange','load','loadend'].forEach(function(k){if(self['on'+k])self['on'+k]();(self.listeners[k]||[]).forEach(function(fn){fn.call(self)})})},15)};
  window.XMLHttpRequest=PreviewXHR;
  navigator.sendBeacon=function(){return false};window.open=function(){return null};
  document.addEventListener('submit',function(e){e.preventDefault();e.stopImmediatePropagation()},true);
  document.addEventListener('click',function(e){var a=e.target.closest('a');if(a&&a.getAttribute('href')&&!a.getAttribute('href').startsWith('#')){e.preventDefault();e.stopImmediatePropagation()}},true);
  document.addEventListener('click',function(e){var button=e.target.closest('button,.sub-btn');if(button&&/提交工单|提交订单|立即购买|加入购物车|付款|去续费|重启|关机|开机/.test(button.textContent)){e.preventDefault();e.stopImmediatePropagation()}},true);
  if(boot.moduleHtml){var started=false,observer=new MutationObserver(function(){if(started||!document.querySelector('.common-config'))return;started=true;observer.disconnect();var parsed=new DOMParser().parseFromString(boot.moduleHtml,'text/html'),sources=Array.from(parsed.querySelectorAll('script[src]')).map(function(s){return s.getAttribute('src')});function next(){var src=sources.shift();if(!src)return;var el=document.createElement('script');el.src=src;el.onload=next;document.body.appendChild(el)}next()});observer.observe(document.documentElement,{subtree:true,childList:true})}
  if(boot.domain==='cart'&&boot.editorId==='goodslist'){
    var cartObserver=new MutationObserver(function(){var el=document.querySelector('.template.cart-page'),vm=el&&el.__vue__;if(!vm||vm.__previewReady)return;vm.__previewReady=true;cartObserver.disconnect();
      function sample(){if(!vm.selectedProduct)return;clearTimeout(vm.embedTimer);vm.configState='ready';vm.railState='bridged';vm.railLoading=false;vm.railDurations=[{id:1,name:'月付'}];vm.railDurationId=1;vm.railQty={allow:true,min:1,max:10,cur:1};vm.railPrice={currency:'¥',calcText:'39.00',originText:'',hasDiscount:false};vm.railPreview=[{name:'CPU 与内存',value:'2 核 CPU · 4GB 内存'},{name:'系统盘',value:'50GB SSD'}];var body=vm.$refs.mobileConfigBody;if(body&&!body.children.length)body.innerHTML='<div style="padding:18px">实例配置 · 2 核 CPU / 4GB 内存 / 50GB SSD</div>';}
      vm.$watch('selectedProduct',function(){vm.$nextTick(sample)});vm.$nextTick(sample);vm.railPrimaryAction=vm.railAddCart=function(){vm.$message.info('预览中不执行业务操作')};
    });cartObserver.observe(document.documentElement,{subtree:true,childList:true});
  }
  function applyCode(){var code=snap.custom_code||{};if(code.css_enabled!==false&&code.css){var style=document.createElement('style');style.textContent=code.css;document.head.appendChild(style)}if(code.js_enabled!==false&&code.js){try{(0,eval)(code.js)}catch(e){console.error('自定义脚本预览失败',e)}}}
  document.addEventListener('DOMContentLoaded',function(){try{applyCode()}finally{window.parent.postMessage({type:'theme-preview',state:'ready',nonce:boot.nonce},boot.parent_origin)}},{once:true});
})();
