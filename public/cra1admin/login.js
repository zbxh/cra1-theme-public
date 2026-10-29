(() => {
  'use strict';
  const boot=window.__THEME_AUTH__, $=selector=>document.querySelector(selector);
  const form=$('#authForm'),error=$('#authErr'),submit=$('#authSubmit'),reset=$('#recoveryForm'),resetError=$('#recoveryErr'),resetMessage=$('#recoveryMessage');
  let challenge='',busy=false,resetChallenge='',resetDone=false,retryAt=0;
  const showError=(target,message)=>{target.textContent=message;target.hidden=false;};
  const request=async(action,p={})=>{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
    try{
      const r=await fetch(boot.base+'?r=api.'+action,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':boot.csrf},body:JSON.stringify(p),signal:controller.signal});
      const data=await r.json();if(!data||typeof data.status!=='number')throw new Error('response');return data;
    }finally{clearTimeout(timer);}
  };
  async function captcha(recovery=false){
    const r=await request('auth.captcha');if(r.status!==200)throw new Error('captcha');
    $(recovery?'#resetCaptchaImage':'#captchaImage').src=r.data.image;
    const input=(recovery?reset:form).elements.captcha;input.value='';input.disabled=false;input.required=true;
    if(!recovery)$('#captchaFields').hidden=false;
  }
  function passwordMode(){
    challenge='';$('#passwordFields').hidden=false;$('#mfaFields').hidden=true;$('#backToPassword').hidden=true;
    $('#authTitle').textContent='登录酷锐A1主题后台';$('#authDescription').textContent='使用您的后台账号继续。';submit.textContent='登录';
    form.elements.code.value='';form.elements.password.value='';form.elements.password.required=true;
  }
  $('#refreshCaptcha').onclick=()=>{if(!busy)captcha().catch(()=>showError(error,'验证码暂时无法加载，请刷新后重试。'));};
  $('#backToPassword').onclick=passwordMode;
  form.onsubmit=async e=>{
    e.preventDefault();if(busy)return;busy=true;submit.disabled=true;error.hidden=true;
    try{
      const p=Object.fromEntries(new FormData(form));
      const r=await request(challenge?'auth.mfa':'auth.login',challenge?{challenge,code:p.code,captcha:p.captcha}:p);
      if(r.status!==200){showError(error,r.msg||'登录失败，请重试。');if(r.data?.captcha_required)await captcha();if(r.code==='CHALLENGE_EXPIRED')passwordMode();return;}
      if(r.data?.mfa_required){
        challenge=r.data.challenge;form.elements.password.value='';form.elements.password.required=false;
        $('#passwordFields').hidden=true;$('#captchaFields').hidden=true;form.elements.captcha.disabled=true;
        $('#mfaFields').hidden=false;$('#backToPassword').hidden=false;
        $('#authTitle').textContent='验证您的身份';$('#authDescription').textContent='输入验证器动态码，或使用一次性恢复码。';submit.textContent='验证并登录';form.elements.code.focus();
        if(r.data.captcha_required)await captcha();
      }else window.location.replace(boot.base+'?r=dashboard');
    }catch{showError(error,'连接失败，请稍后重试。');}finally{busy=false;submit.disabled=false;}
  };
  function resetStage(proof){
    $('#resetStartFields').hidden=proof;$('#resetStartFields').disabled=proof;
    $('#resetProofFields').hidden=!proof;$('#resetProofFields').disabled=!proof;
    $('#recoverySubmit').textContent=proof?'验证并重置密码':'发送验证码';$('#resetResend').hidden=!proof;
  }
  $('#forgotPassword').onclick=async()=>{
    if(busy)return;passwordMode();form.hidden=true;reset.hidden=false;reset.reset();resetChallenge='';resetDone=false;
    resetError.hidden=true;resetMessage.hidden=true;$('#recoverySubmit').hidden=false;resetStage(false);
    busy=true;$('#recoverySubmit').disabled=true;
    try{await captcha(true);reset.elements.username.focus();}catch{showError(resetError,'验证码暂时无法加载，请刷新后重试。');}finally{busy=false;$('#recoverySubmit').disabled=false;}
  };
  $('#resetRefreshCaptcha').onclick=()=>{if(!busy)captcha(true).catch(()=>showError(resetError,'验证码暂时无法加载，请重试。'));};
  $('#resetBack').onclick=()=>{if(!busy)window.location.replace(boot.base+'?r=login');};
  const tick=()=>{const remaining=Math.max(0,Math.ceil((retryAt-Date.now())/1000));$('#resetResend').disabled=busy||remaining>0;$('#resetResend').textContent=remaining?`${remaining} 秒后可重新获取`:'重新获取验证码';};
  const timer=setInterval(tick,1000);window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
  $('#resetResend').onclick=async()=>{
    if(busy||Date.now()<retryAt)return;resetError.hidden=true;resetMessage.hidden=true;resetChallenge='';resetStage(false);
    busy=true;$('#recoverySubmit').disabled=true;
    try{await captcha(true);reset.elements.captcha.focus();}catch{showError(resetError,'验证码暂时无法加载，请重试。');}finally{busy=false;$('#recoverySubmit').disabled=false;}
  };
  reset.onsubmit=async e=>{
    e.preventDefault();if(busy||resetDone)return;resetError.hidden=true;
    if(resetChallenge&&reset.elements.new_password.value!==reset.elements.confirm.value){showError(resetError,'两次输入的新密码不一致');return;}
    busy=true;$('#recoverySubmit').disabled=true;tick();
    try{
      const p=Object.fromEntries(new FormData(reset));
      const r=await request(resetChallenge?'auth.recovery.finish':'auth.recovery.begin',resetChallenge?{challenge:resetChallenge,code:p.code,new_password:p.new_password}:{username:p.username,email:p.email,captcha:p.captcha});
      if(r.status!==200){showError(resetError,r.msg||'操作未完成，请重试。');if(!resetChallenge)await captcha(true);return;}
      resetMessage.textContent=r.msg;resetMessage.hidden=false;
      if(resetChallenge){resetDone=true;reset.reset();$('#resetProofFields').hidden=true;$('#resetProofFields').disabled=true;$('#recoverySubmit').hidden=true;$('#resetResend').hidden=true;$('#resetBack').focus();}
      else{resetChallenge=r.data.challenge;retryAt=Date.now()+r.data.retry_after*1000;resetStage(true);reset.elements.code.focus();}
    }catch{showError(resetError,'连接失败，请稍后重试。');if(!resetChallenge)captcha(true).catch(()=>{});}
    finally{busy=false;$('#recoverySubmit').disabled=false;tick();}
  };
})();
