/* Browser receipts prevent resubmitting the same checkout after a lost reply. */
(function (root) {
  'use strict';
  var shared=root.CRA1Shared, prefix='cra1:checkout:v1:';
  function account() {
    try { var info=JSON.parse(root.atob(shared.Request.getToken().split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).info;
      if(!/^[1-9]\d*$/.test(String(info.id)))return '';
      return info.id+':'+(info.sub_account_id||info.sub_id||0);
    }catch(e){return '';}
  }
  function canonical(value) {
    if(Array.isArray(value))return value.map(canonical);
    if(value&&typeof value==='object'){var next={};Object.keys(value).sort().forEach(function(k){next[k]=canonical(value[k]);});return next;}
    return value;
  }
  function uncertain() { var e=new Error('暂时无法确认下单结果，请先到财务中心查看是否已生成订单，避免重复下单。');e.code='CHECKOUT_UNCERTAIN';e.uncertain=true;return e; }
  function read(key) { var raw=root.localStorage.getItem(key);if(!raw)return null;var r=JSON.parse(raw);if(!r||!['pending','unknown','created'].includes(r.state)||!r.attempt)throw uncertain();return r; }
  function write(key,r) { var value=JSON.stringify(r);root.localStorage.setItem(key,value);if(root.localStorage.getItem(key)!==value)throw uncertain();return r; }
  function definite(e) {
    var status=Number(e?.data?.status||e?.response?.data?.status||e?.status);
    return !e?.uncertain&&!['BAD_RESPONSE','NETWORK','TIMEOUT'].includes(e?.code)&&[400,401,403,404,409,422,429].includes(status);
  }
  async function priorOrder(receipt) {
    try {
      if(!/^[1-9]\d*$/.test(String(receipt.orderId)))throw new Error();
      var result=await shared.Request.request('/order/'+receipt.orderId),order=result?.data?.order;
      if(Number(result?.status)!==200||!order||typeof order!=='object'||Array.isArray(order))throw new Error();
      // V10 returns an empty object for orders that are no longer available,
      // including deleted and cancelled orders. A failed read is not that result.
      if(Object.keys(order).length===0)return null;
      if(Number(order.id)!==Number(receipt.orderId))throw new Error();
      return order;
    }catch(cause){
      var error=new Error('暂时无法读取原订单，请稍后重试，或到财务中心查看订单。');
      error.code='CHECKOUT_LOOKUP_FAILED';throw error;
    }
  }
  async function submit(kind,params,send,options) {
    options=options||{};
    var token=shared.Request.getToken(),owner=account();if(!owner)throw new Error('登录状态无法确认，请刷新页面后重试');
    var fingerprint=shared.CheckoutHash(kind+':'+JSON.stringify(canonical(options.identity||params)));
    var key=prefix+owner+':'+fingerprint,lock='cra1-checkout:'+owner+':'+fingerprint;
    var intentKey=options.intent?key+':'+options.intent:key;
    function save(r){write(intentKey,r);return write(key,r);}
    function finish(r){write(intentKey,r);if(read(key)?.attempt===r.attempt)write(key,r);return r;}
    function forget(r,unavailable){
      var keys=[key,intentKey];if(unavailable&&r.intent)keys.push(key+':'+r.intent);
      keys.forEach(function(k){if(read(k)?.attempt===r.attempt)root.localStorage.removeItem(k);});
    }
    async function run() {
      if(token!==shared.Request.getToken())throw uncertain();
      var old=read(intentKey)||read(key);
      while(old){
        if(old.state==='pending'&&Date.now()-Number(old.startedAt)>120000){
          old=Object.assign({},old,{state:'unknown'});
          write(key+':'+old.intent,old);write(key,old);
        }
        if(old.state!=='created'){
          if(old.state==='pending'||!options.intent||old.intent===options.intent)throw uncertain();
          // A fresh selection starts a deliberate checkout. Keep the unresolved
          // receipt under its old intent; refreshing that checkout still stops.
          write(key+':'+old.intent,old);root.localStorage.removeItem(key);old=null;
        }
        if(old){
          var order=await priorOrder(old);
          if(token!==shared.Request.getToken())throw uncertain();
          if(!order||(options.intent&&old.intent!==options.intent&&['Paid','Cancelled','Refunded'].includes(order.status))){
            forget(old,!order);
            // An older per-visit receipt must not erase or hide a newer order.
            old=read(intentKey)||read(key);continue;
          }
          return {data:{status:200,data:{order_id:old.orderId}}};
        }
      }
      var attempt=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)+'-'+Math.random().toString(36).slice(2);
      var receipt=save({state:'pending',attempt:attempt,intent:options.intent||'',startedAt:Date.now()});
      // Web Locks serializes tabs. Storage-only browsers also verify ownership
      // after yielding before any business request leaves the browser.
      if(!root.navigator?.locks){await new Promise(function(r){root.setTimeout(r,60);});if(read(key)?.attempt!==attempt)throw uncertain();}
      try{
        if(token!==shared.Request.getToken())throw uncertain();
        var response=await send(),body=response?.data,id=body?.data?.order_id;
        if(Number(body?.status)!==200){var rejection=new Error(body?.msg||'订单未提交');rejection.data=body;throw rejection;}
        if(!/^[1-9]\d*$/.test(String(id)))throw uncertain();
        finish(Object.assign({},receipt,{state:'created',orderId:Number(id)}));return response;
      }catch(e){
        if(read(key)?.attempt===attempt){if(definite(e)){root.localStorage.removeItem(key);root.localStorage.removeItem(intentKey);}else save(Object.assign({},receipt,{state:'unknown'}));}
        throw e;
      }
    }
    if(root.navigator?.locks)return root.navigator.locks.request(lock,run);
    return run();
  }
  shared.Checkout={submit:submit};
})(window);
