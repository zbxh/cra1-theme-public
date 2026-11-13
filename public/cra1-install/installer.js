(function(){
  'use strict';
  window.CRA1Shared?.UIEffects?.start();
  const root=document.getElementById('installer'),status=document.getElementById('status'),form=document.getElementById('setup');
  const checkButton=document.getElementById('check'),installButton=document.getElementById('install'),feedback=document.getElementById('setup-status');
  const maintenance=document.getElementById('maintenance'),updateButton=document.getElementById('update'),backup=document.getElementById('backup-confirmed'),updateFeedback=document.getElementById('update-status');
  let busy=false,ready=false,installed=false,confirmation=null,updateState=null;
  function failure(message,needsCheck=false){return Object.assign(new Error(message),{needsCheck});}
  async function request(body){
    let token='';
    try{token=localStorage.getItem('backJwt')||'';}catch(_){}
    const headers={'Content-Type':'application/json','X-CSRF-Token':root.dataset.csrf};
    if(token)headers.Authorization='Bearer '+token;
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),60000);
    try{
      const response=await fetch('api.php',{method:'POST',credentials:'same-origin',signal:controller.signal,headers,body:JSON.stringify(body)});
      let data;
      try{data=await response.json();}catch(error){
        if(error.name==='AbortError')throw error;
        throw failure('安装接口未返回有效数据（HTTP '+response.status+'）。请检查网站错误日志及 public/cra1-install/api.php 是否完整、可读，处理后点击“重新检测”。',true);
      }
      if(!data||typeof data!=='object'||typeof data.status!=='number')throw failure('安装接口返回的数据格式不完整（HTTP '+response.status+'），请点击“重新检测”确认状态。',true);
      if(!response.ok||data.status!==200){
        const reason=typeof data.msg==='string'&&data.msg?data.msg:
          [401,403].includes(data.status)?'本站已安装主题，请登录 V10 系统超级管理员后完成解压更新，或从原主题后台上传安装包。':
          '操作未完成（HTTP '+response.status+'，状态 '+data.status+'），请重新检测并查看网站错误日志。';
        throw failure(reason,data.error?.needs_check===true||!response.ok||data.status>=500||[401,403].includes(data.status));
      }
      if(!data.data||typeof data.data!=='object')throw failure('安装服务返回不完整，请点击“重新检测”确认当前安装状态。',true);
      return data.data;
    }catch(error){
      if(error.name==='AbortError')throw failure('等待服务超时，请点击“重新检测”确认当前安装或更新状态，勿重复提交。',true);
      if(error.needsCheck!==undefined)throw error;
      throw failure('无法连接安装服务，请检查网络后点击“重新检测”确认当前安装状态。',true);
    }finally{clearTimeout(timer);}
  }
  function text(tag,value){const node=document.createElement(tag);node.textContent=value;return node;}
  function message(value,state='error'){
    feedback.textContent=value;feedback.dataset.state=state;feedback.hidden=!value;
  }
  function lock(value,action){
    busy=value;root.querySelectorAll('button,input').forEach(node=>node.disabled=value);
    checkButton.disabled=value||installed;installButton.disabled=value||!ready||installed;
    checkButton.textContent=value&&action==='check'?'正在准备…':'重新检测';
    installButton.textContent=value&&action==='install'?'正在安装…':'完成安装';
    updateButton.disabled=value||!confirmation||(updateState!=='interrupted'&&!backup.checked);
    updateButton.textContent=value&&action==='update'?'正在更新…':value&&action==='recover_update'?'正在恢复…':updateState==='interrupted'?'恢复未完成的更新':'完成更新';
    maintenance.setAttribute('aria-busy',value&&['update','recover_update'].includes(action)?'true':'false');
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
    errors.forEach(([input,value])=>fieldError(input,value));
    if(errors.length){message('请先修改标红的填写项，再点击“完成安装”。');errors[0][0].focus();return false;}
    message('');return true;
  }
  form.addEventListener('input',event=>{if(event.target instanceof HTMLInputElement)clearField(event.target);});
  function adminLink(node,value){
    const url=new URL(value,location.origin);
    if(url.origin!==location.origin||!/^\/[a-z0-9]{6,32}\/index\.php$/.test(url.pathname)||url.search||url.hash)throw failure('后台地址返回异常，请重新检查。',true);
    node.href=url.pathname;
  }
  backup.addEventListener('change',()=>lock(false));
  async function inspect(){
    if(busy||installed)return;ready=false;confirmation=null;updateState=null;backup.checked=false;lock(true,'check');message('');status.textContent='正在准备安装页面…';form.hidden=true;maintenance.hidden=true;document.getElementById('update-success').hidden=true;updateFeedback.hidden=true;
    const environment=document.getElementById('environment');environment.hidden=true;environment.open=false;
    document.getElementById('checks').replaceChildren();
    try{
      const data=await request({action:'check'}),out=document.getElementById('checks');
      if(!Array.isArray(data.checks)||!['install','maintenance'].includes(data.mode))throw failure('检查结果不完整，请点击“重新检测”。',true);
      environment.hidden=false;
      const labels={pass:'通过',warning:'提示',blocked:'请处理',unverified:'待检查'};
      for(const row of data.checks){const p=text('p',`${labels[row.status]||'提示'} · ${row.label}：${row.detail}`);p.dataset.state=row.status;out.append(p);}
      if(data.identity){
        const system=data.environment?.system_version;
        out.prepend(text('p',`${data.identity.display_name} · ${data.version||data.release}${data.release_channel==='test'?'（测试版）':''}${system?' · V10 '+system:''}`));
      }
      if(data.mode==='maintenance'){
        form.reset();
        if(!data.update_state){status.textContent='此站已安装酷锐A1主题，请从现有主题后台进入“主题管理”。';return;}
        if(!['current','ready','interrupted'].includes(data.update_state)||typeof data.admin_url!=='string')throw failure('更新检查结果不完整，请重新检查。',true);
        adminLink(document.getElementById('existing-admin-link'),data.admin_url);
        updateState=data.update_state;
        if((data.can_update===true||data.can_recover===true)&&/^[a-f0-9]{64}$/.test(data.confirmation||''))confirmation=data.confirmation;
        maintenance.hidden=false;document.getElementById('update-options').hidden=updateState!=='ready'||!confirmation;updateButton.hidden=!confirmation;
        document.getElementById('maintenance-title').textContent=updateState==='current'?'主题已是当前版本':updateState==='interrupted'?'恢复未完成的更新':'完成主题更新';
        document.getElementById('maintenance-summary').textContent=updateState==='current'?'当前安装包已生效，无需重复更新。':updateState==='interrupted'?'恢复本次未完成事务的文件和生效版本后，可重新检查并更新。解压前已覆盖的文件需从网站备份恢复。':`检测到已解压的 ${data.version||'新版'}${data.release_channel==='test'?' 测试版':''}，检查通过后点击“完成更新”。`;
        status.textContent=updateState==='current'?'已确认当前主题文件和生效版本一致。':confirmation?'检查通过，请在下方继续。':'更新暂不能继续，请处理检查提示后重试。';return;
      }
      ready=data.installation_ready===true;
      environment.open=!ready;
      status.textContent=ready?'请设置主题后台，完成后即可使用。':'运行环境暂不满足，请处理运行信息中的提示后重新检测。';form.hidden=!ready;
    }catch(error){status.textContent=error.message;}finally{checkButton.hidden=false;lock(false);}
  }
  checkButton.addEventListener('click',inspect);
  updateButton.addEventListener('click',async()=>{
    if(busy||!confirmation||(updateState!=='interrupted'&&!backup.checked))return;
    const action=updateState==='interrupted'?'recover_update':'update';
    lock(true,action);updateFeedback.hidden=false;updateFeedback.dataset.state='pending';updateFeedback.textContent=action==='update'?'正在完成主题更新，请勿关闭页面…':'正在恢复，请稍候…';
    try{
      const result=await request({action,confirmation,backup_confirmed:backup.checked});
      if(action==='recover_update'){
        if(result.restored!==true)throw failure('恢复结果不完整，请重新检查。',true);
        confirmation=null;updateButton.hidden=true;updateFeedback.textContent='已恢复，请点击“重新检测”后继续更新。';status.textContent=updateFeedback.textContent;return;
      }
      if(result.updated!==true||typeof result.admin_url!=='string')throw failure('更新结果不完整，请重新检查当前状态。',true);
      adminLink(document.getElementById('updated-admin-link'),result.admin_url);
      confirmation=null;maintenance.hidden=true;document.getElementById('update-success').hidden=false;status.textContent='主题更新完成，请刷新页面。';
      document.getElementById('update-success').scrollIntoView({block:'nearest'});
    }catch(error){
      confirmation=null;status.textContent=error.message;updateFeedback.dataset.state='error';updateFeedback.textContent=error.message+' 请先点击“重新检测”确认状态。';updateFeedback.focus();
    }finally{lock(false);}
  });
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy||installed)return;
    if(!ready){message('页面尚未准备完成，请点击“重新检测”确认当前安装状态。');return;}
    if(!validate())return;
    const values=Object.fromEntries(new FormData(form));delete values.confirm;
    lock(true,'install');message('正在安装主题后台，请稍候…','pending');status.textContent='正在安装主题后台…';
    try{
      const result=await request({...values,action:'install'});
      if(!['admin_url','username','password'].every(key=>typeof result[key]==='string'&&result[key]))throw failure('安装结果不完整，请点击“重新检测”确认当前安装状态。',true);
      let adminUrl;
      try{adminUrl=new URL(result.admin_url,location.origin);}catch(_){throw failure('后台地址返回异常，请点击“重新检测”确认当前安装状态。',true);}
      if(adminUrl.origin!==location.origin)throw failure('后台地址返回异常，请点击“重新检测”确认当前安装状态。',true);
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
  if(!checkButton.disabled)inspect();
})();
