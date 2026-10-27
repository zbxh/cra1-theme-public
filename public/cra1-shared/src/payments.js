/* One native controller, with a page, an embedded surface and the legacy modal. */
(function (root) {
  'use strict';
  var shared=root.CRA1Shared=root.CRA1Shared||{}, loads=root.__CRA1_SCRIPT_LOADS__=root.__CRA1_SCRIPT_LOADS__||{}, current=null;
  var prefix='cra1:payment:v1:', maxAge=86400000;
  function validId(id) { return /^[1-9]\d*$/.test(String(id)) && Number.isSafeInteger(Number(id)); }
  function localUrl(value) {
    if(typeof value!=='string'||!value.trim())return '';
    try { var u=new URL(value,root.location.origin);if(u.origin!==root.location.origin || u.username || u.password || /[\r\n\\]/.test(value))return '';['jwt','token','queryParam','authorization'].forEach(function(k){u.searchParams.delete(k)});return u.pathname+u.search+u.hash; } catch(e) { return ''; }
  }
  // This decoded ID only namespaces a browser hint. APIs authorize every read/write.
  function accountKey() {
    try { var part=shared.Request.getToken().split('.')[1].replace(/-/g,'+').replace(/_/g,'/'), info=JSON.parse(root.atob(part)).info;
      return validId(info.id) ? String(info.id)+':'+String(info.sub_account_id||info.sub_id||0) : ''; } catch(e) { return ''; }
  }
  function key(id) { var account=accountKey();return account && validId(id) ? prefix+account+':'+id : ''; }
  function details(value) {
    var out={};
    ['diskId','status','size','count','isBackup','imageId','image_id','packageId','billing_cycle','resources','configuration','action'].forEach(function(k){
      var v=value?.[k];if(v===undefined)return;
      if(k==='configuration' && v && typeof v==='object') { var config={};Object.keys(v).filter(function(n){return /^(cpu|memory|disk|bandwidth|flow|image_id|line_id|peak_defence|data_disk|system_disk)$/.test(n)}).forEach(function(n){if(['string','number','boolean'].includes(typeof v[n]))config[n]=v[n]});out[k]=config; }
      else if(k==='resources' && Array.isArray(v))out[k]=v.filter(function(n){return /^(host|detail|usage|flowCurve|disks|backup|orders|remote|ipv4|ipv6)$/.test(n)});
      else if(['string','number','boolean'].includes(typeof v))out[k]=typeof v==='string'?v.slice(0,120):v;
    });return out;
  }
  function remember(options) {
    var k=key(options.orderId);if(!k)return;
    var record={orderId:Number(options.orderId),source:localUrl(options.returnTo || root.location.href),hostId:validId(options.hostId)?Number(options.hostId):null,
      operation:/^[a-zA-Z][a-zA-Z0-9]{0,48}$/.test(options.operation||'')?options.operation:'order',gateway:typeof options.gateway==='string'?options.gateway.slice(0,100):'',details:details(options.context),created:Date.now(),result:''};
    if(record.source.split('?')[0]==='/cashier.htm')record.source='/orderDetail.htm?id='+record.orderId;
    try { root.sessionStorage.setItem(k,JSON.stringify(record)); } catch(e) { /* Payment works without browser storage. */ }
  }
  function context(id) {
    var k=key(id);if(!k)return null;
    try { var r=JSON.parse(root.sessionStorage.getItem(k));if(!r || r.orderId!==Number(id) || Date.now()-r.created>maxAge || !localUrl(r.source)) {root.sessionStorage.removeItem(k);return null}return r; } catch(e) { return null; }
  }
  function mark(id,result) { var r=context(id);if(r){r.result=result;try{root.sessionStorage.setItem(key(id),JSON.stringify(r))}catch(e){}} }
  function navigate(options) {
    if(!validId(options?.orderId))throw new Error('订单信息无效，请从订单列表重新打开');
    remember(options);root.location.assign('/cashier.htm?id='+encodeURIComponent(options.orderId));
    return {orderId:Number(options.orderId),url:'/cashier.htm?id='+options.orderId};
  }
  async function resume(options) {
    var account=accountKey(), found=[];if(!account)return found;
    var keys=[];try { for(var i=0;i<root.sessionStorage.length;i++){var k=root.sessionStorage.key(i);if(k.startsWith(prefix+account+':'))keys.push(k)} } catch(e){return found}
    for(var k of keys) {
      var id=k.split(':').pop(), r=context(id);if(!r)continue;
      if(options?.hostId && String(r.hostId)!==String(options.hostId))continue;
      if(!options?.hostId && localUrl(root.location.href)!==r.source)continue;
      try {
        var response=await shared.Request.request('/order/'+id,{signal:options?.signal}), order=response.data?.order;
        if(options?.signal?.aborted)return found;
        if(!order?.id)continue;
        if(order.status==='Paid'){found.push(r);root.sessionStorage.removeItem(k);options?.onPaid?.(r,order)}
        else if(r.result && r.result!=='paid'){root.sessionStorage.removeItem(k);options?.onUpdated?.(r,order)}
      } catch(e) { if(options?.signal?.aborted)return found; }
    }return found;
  }
  function load(src) {
    if (loads[src]) return loads[src];
    loads[src]=new Promise(function(resolve,reject){
      var script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=function(){delete loads[src];script.remove();reject(new Error('支付组件加载失败，请重试'));};document.head.appendChild(script);
    });return loads[src];
  }
  function open(options){
    if(!validId(options?.orderId))throw new Error('订单信息无效，请从订单列表重新打开');
    if(current)current.close();
    var vm=null,holder=null,closed=false,pageMode=options.mode==='page'||!!options.container;
    var returnFocus=document.activeElement;
    function cleanup(){if(vm){vm.$destroy();vm=null}if(holder){holder.remove();holder=null}document.removeEventListener('api:unauthorized',cancel);root.removeEventListener('pagehide',dispose);if(current===handle)current=null;if(!pageMode&&returnFocus&&returnFocus.isConnected&&returnFocus.focus)returnFocus.focus()}
    function dispose(){if(closed)return;closed=true;cleanup()}
    function cancel(){if(closed)return;closed=true;try{if(vm&&vm.$refs.cashier)vm.$refs.cashier.zfClose()}finally{cleanup();options.onCancel&&options.onCancel()}}
    var handle={close:cancel,destroy:dispose,ready:null};current=handle;
    handle.ready=(async function(){
      try {
        if(!root.Vue)throw new Error('支付组件未就绪，请刷新后重试');
        var base=root.__CRA1_PAYMENT_BASE__||'/clientarea/template/pc/cra1';
        var cssHref='/clientarea/template/pc/cra1/css/finance.css';if(!document.querySelector('link[data-cra1-cashier-style]')){var link=document.createElement('link');link.rel='stylesheet';link.href=cssHref;link.setAttribute('data-cra1-cashier-style','');document.head.appendChild(link)}
        if(!root.jQuery)await load('/clientarea/template/pc/default/js/common/jquery.mini.js');
        if(typeof orderDetails==='undefined'||typeof pay==='undefined')await load(base+'/api/finance.js');
        if(typeof payDialog==='undefined')await load(base+'/components/payDialog/payDialog.js');
        if(closed)return;
        var container=typeof options.container==='string'?document.querySelector(options.container):options.container;
        if(pageMode&&(!container||!container.isConnected))throw new Error('支付区域未就绪，请重试');
        holder=document.createElement('div');holder.setAttribute('data-cra1-cashier','');(container||document.body).appendChild(holder);
        vm=new root.Vue({render:function(h){return h(payDialog,{ref:'cashier',props:{pageMode:pageMode,initialGateway:options.gateway||''},on:{paystate:function(state){if(!closed)options.onState?.(state)},payok:function(id){if(closed||String(id)!==String(options.orderId))return;mark(id,'paid');closed=true;cleanup();options.onPaid&&options.onPaid(id)},paypending:function(id){if(closed)return;mark(id,'pending');if(pageMode){options.onUpdated?.(id);return}closed=true;cleanup();options.onUpdated&&options.onUpdated(id);options.onCancel&&options.onCancel()},paycancel:cancel}})}}).$mount(holder);
        holder=vm.$el;
        holder.setAttribute('data-cra1-cashier','');
        document.addEventListener('api:unauthorized',cancel);
        root.addEventListener('pagehide',dispose);
        await vm.$nextTick();
        if(!closed)await vm.$refs.cashier.showPayDialog(Number(options.orderId));
      }catch(error){if(!closed){closed=true;cleanup();throw error}}
    })();
    return handle;
  }
  shared.Payments={open:open,mount:function(container,options){return open(Object.assign({},options,{container:container,mode:'page'}))},navigate:navigate,context:context,mark:mark,resume:resume,localUrl:localUrl};
})(window);
