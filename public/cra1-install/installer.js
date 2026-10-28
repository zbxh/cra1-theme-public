(function(){
  'use strict';
  const root=document.getElementById('installer'),status=document.getElementById('status'),form=document.getElementById('setup');
  const checkButton=document.getElementById('check'),installButton=document.getElementById('install'),feedback=document.getElementById('setup-status');
  let busy=false,ready=false,installed=false;
  function failure(message,needsCheck=false){return Object.assign(new Error(message),{needsCheck});}
  async function request(body){
    let token;
    try{token=localStorage.getItem('backJwt');}catch(_){throw failure('浏览器无法读取管理员登录状态，请允许本站存储后重新登录。',true);}
    if(!token)throw failure('请先在同一浏览器登录 V10 超级管理员账号，再返回此页。',true);
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),60000);
    try{
      const response=await fetch('api.php',{method:'POST',credentials:'same-origin',signal:controller.signal,headers:{'Content-Type':'application/json','X-CSRF-Token':root.dataset.csrf,Authorization:'Bearer '+token},body:JSON.stringify(body)});
      let data;
      try{data=await response.json();}catch(error){
        if(error.name==='AbortError')throw error;
        if([403,404].includes(response.status))throw failure('安装接口无法访问（HTTP '+response.status+'），请检查 public/cra1-install/api.php 是否完整、可读，以及目录访问权限和网站访问规则；处理后点击“验证并检查”。',true);
        throw failure('安装服务返回异常，请点击“验证并检查”确认当前安装状态。',true);
      }
      if((response.status===401||response.status===403)&&[401,403].includes(data?.status))throw failure('管理员登录已失效或权限不足，请重新登录后点击“验证并检查”。',true);
      if(!response.ok||!data||typeof data!=='object'||typeof data.status!=='number')throw failure('安装服务暂不可用，请点击“验证并检查”确认当前安装状态。',true);
      if(data.status!==200)throw failure(data.status>=500?'安装服务暂不可用，请点击“验证并检查”确认当前安装状态。':typeof data.msg==='string'&&data.msg?data.msg:'操作未完成，请检查填写内容后重试。',data.status>=500||[401,403].includes(data.status));
      if(!data.data||typeof data.data!=='object')throw failure('安装服务返回不完整，请点击“验证并检查”确认当前安装状态。',true);
      return data.data;
    }catch(error){
      if(error.name==='AbortError')throw failure('等待安装服务超时，请点击“验证并检查”确认当前安装状态，勿重复安装。',true);
      if(error.needsCheck!==undefined)throw error;
      throw failure('无法连接安装服务，请检查网络后点击“验证并检查”确认当前安装状态。',true);
    }finally{clearTimeout(timer);}
  }
  function text(tag,value){const node=document.createElement(tag);node.textContent=value;return node;}
  function message(value,state='error'){
    feedback.textContent=value;feedback.dataset.state=state;feedback.hidden=!value;
  }
  function lock(value,action){
    busy=value;root.querySelectorAll('button,input').forEach(node=>node.disabled=value);
    checkButton.disabled=value||installed;installButton.disabled=value||!ready||installed;
    checkButton.textContent=value&&action==='check'?'正在检查…':'验证并检查';
    installButton.textContent=value&&action==='install'?'正在安装…':'完成安装';
    form.setAttribute('aria-busy',value&&action==='install'?'true':'false');
  }
  function clearField(input){
    input.removeAttribute('aria-invalid');input.removeAttribute('aria-describedby');
    document.getElementById('error-'+input.name)?.remove();
  }
  function fieldError(input,value){
    const error=text('span',value);error.id='error-'+input.name;error.className='field-error';
    input.setAttribute('aria-invalid','true');input.setAttribute('aria-describedby',error.id);input.after(error);
  }
  function validate(){
    const fields=form.elements,errors=[];
    form.querySelectorAll('input').forEach(clearField);
    if(!/^[a-z][a-z0-9]{5,31}$/.test(fields.entry.value))errors.push([fields.entry,'后台地址需为 6–32 位小写字母和数字，并以字母开头。']);
    if(!/^[A-Za-z0-9_-]{3,32}$/.test(fields.username.value))errors.push([fields.username,'管理账号需为 3–32 位字母、数字、下划线或短横线。']);
    const passwordLength=Array.from(fields.password.value).length;
    if(passwordLength<12||passwordLength>128||fields.password.value.includes('\0'))errors.push([fields.password,'管理密码需为 12–128 个字符。']);
    if(!fields.confirm.value)errors.push([fields.confirm,'请再次输入管理密码。']);
    else if(fields.password.value!==fields.confirm.value)errors.push([fields.confirm,'两次密码不一致，请重新确认。']);
    let validUrl=false;
    try{
      const raw=fields.canonical.value,url=new URL(raw);
      validUrl=raw===raw.trim()&&url.protocol==='https:'&&!!url.hostname&&!url.username&&!url.password&&url.pathname==='/'&&!url.search&&!url.hash&&url.origin===location.origin;
    }catch(_){}
    if(!validUrl)errors.push([fields.canonical,'请填写与当前安装页面一致的本站 HTTPS 地址，不带页面路径。']);
    errors.forEach(([input,value])=>fieldError(input,value));
    if(errors.length){message('请先修改标红的填写项，再点击“完成安装”。');errors[0][0].focus();return false;}
    message('');return true;
  }
  form.addEventListener('input',event=>{if(event.target instanceof HTMLInputElement)clearField(event.target);});
  checkButton.addEventListener('click',async()=>{
    if(busy||installed)return;ready=false;lock(true,'check');message('');status.textContent='正在验证身份并自动检查安装环境…';form.hidden=true;
    document.getElementById('checks').replaceChildren();
    try{
      const data=await request({action:'check'}),out=document.getElementById('checks');
      if(!Array.isArray(data.checks)||!['install','maintenance'].includes(data.mode))throw failure('检查结果不完整，请重新点击“验证并检查”。',true);
      const labels={pass:'通过',warning:'提示',blocked:'请处理',unverified:'待检查'};
      for(const row of data.checks){const p=text('p',`${labels[row.status]||'提示'} · ${row.label}：${row.detail}`);p.dataset.state=row.status;out.append(p);}
      if(data.identity){
        const system=data.environment?.system_version;
        out.prepend(text('p',`${data.identity.display_name} · ${data.version||data.release}${data.release_channel==='test'?'（测试版）':''}${system?' · V10 '+system:''}`));
      }
      if(data.mode==='maintenance'){installed=true;form.reset();status.textContent='此站已安装酷锐A1主题，请从现有主题后台进入“主题管理”。';return;}
      ready=data.installation_ready===true;
      status.textContent=ready?'运行环境检查通过，请设置主题后台。':'运行环境暂不满足，请处理下面提示后重新检查。';form.hidden=!ready;
      if(!form.elements.canonical.value)form.elements.canonical.value=location.origin;
    }catch(error){status.textContent=error.message;}finally{lock(false);}
  });
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy||installed)return;
    if(!ready){message('请先点击“验证并检查”，确认当前环境和安装状态。');return;}
    if(!validate())return;
    const values=Object.fromEntries(new FormData(form));delete values.confirm;
    lock(true,'install');message('正在安装主题后台，请稍候…','pending');status.textContent='正在安装主题后台…';
    try{
      const result=await request({...values,action:'install'});
      if(!['admin_url','username','password'].every(key=>typeof result[key]==='string'&&result[key]))throw failure('安装结果不完整，请点击“验证并检查”确认当前安装状态。',true);
      let adminUrl;
      try{adminUrl=new URL(result.admin_url,location.origin);}catch(_){throw failure('后台地址返回异常，请点击“验证并检查”确认当前安装状态。',true);}
      if(adminUrl.origin!==location.origin)throw failure('后台地址返回异常，请点击“验证并检查”确认当前安装状态。',true);
      installed=true;ready=false;form.hidden=true;form.reset();message('');
      const out=document.getElementById('credentials');out.replaceChildren();
      for(const [label,value]of[['后台地址',result.admin_url],['账号',result.username],['密码',result.password]])out.append(text('dt',label),text('dd',value));
      document.getElementById('admin-link').href=result.admin_url;document.getElementById('success').hidden=false;status.textContent='安装成功，初始化入口已锁定。';
      document.getElementById('success').scrollIntoView({block:'nearest'});
    }catch(error){
      if(error.needsCheck)ready=false;
      status.textContent=error.message;message(error.message);feedback.focus();
    }finally{delete values.password;lock(false);}
  });
  document.getElementById('hide-password').addEventListener('click',()=>{const nodes=document.querySelectorAll('#credentials dd');if(nodes[2])nodes[2].textContent='已隐藏';});
})();
