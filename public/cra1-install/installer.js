(function(){
  'use strict';
  const root=document.getElementById('installer'),status=document.getElementById('status'),form=document.getElementById('setup');
  let busy=false;
  async function request(body){
    const token=localStorage.getItem('backJwt');
    if(!token)throw new Error('请先在同一浏览器登录 V10 超级管理员账号，再返回此页。');
    const response=await fetch('api.php',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':root.dataset.csrf,Authorization:'Bearer '+token},body:JSON.stringify(body)});
    const data=await response.json();if(data.status!==200)throw new Error(data.msg||'操作未完成');return data.data;
  }
  function text(tag,value){const node=document.createElement(tag);node.textContent=value;return node;}
  function lock(value){busy=value;root.querySelectorAll('button,input').forEach(node=>node.disabled=value);}
  document.getElementById('check').addEventListener('click',async()=>{
    if(busy)return;lock(true);status.textContent='正在验证身份并自动检查安装环境…';form.hidden=true;
    try{
      const data=await request({action:'check'}),out=document.getElementById('checks');out.replaceChildren();
      const labels={pass:'通过',warning:'提示',blocked:'请处理',unverified:'待检查'};
      for(const row of data.checks){const p=text('p',`${labels[row.status]} · ${row.label}：${row.detail}`);p.dataset.state=row.status;out.append(p);}
      if(data.identity){
        const system=data.environment?.system_version;
        const info=text('p',`${data.identity.display_name} · ${data.version||data.release}${data.release_channel==='test'?'（测试版）':''}${system?' · V10 '+system:''}`);out.prepend(info);

      }
      if(data.mode==='maintenance'){status.textContent='此站已有 CRA1 安装，请从现有主题后台进入“主题管理”。';return;}
      const ready=data.installation_ready===true;
      status.textContent=ready?'运行环境检查通过，请设置主题后台。':'运行环境暂不满足，请处理下面提示后重新检查。';form.hidden=!ready;
      form.elements.canonical.value=location.origin;
    }catch(error){status.textContent=error.message;}finally{lock(false);}
  });
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;
    const values=Object.fromEntries(new FormData(form));if(values.password!==values.confirm){status.textContent='两次密码不一致';return;}
    delete values.confirm;lock(true);status.textContent='正在安装并启用主题…';
    try{
      const result=await request({...values,action:'install'});form.hidden=true;form.reset();
      const out=document.getElementById('credentials');out.replaceChildren();
      for(const [label,value]of[['后台地址',result.admin_url],['账号',result.username],['密码',result.password]]){out.append(text('dt',label),text('dd',value));}
      const link=document.getElementById('admin-link');link.href=result.admin_url;document.getElementById('success').hidden=false;status.textContent='安装成功，初始化入口已锁定。';
    }catch(error){status.textContent=error.message;}finally{delete values.password;lock(false);}
  });
  document.getElementById('hide-password').addEventListener('click',()=>{const nodes=document.querySelectorAll('#credentials dd');if(nodes[2])nodes[2].textContent='已隐藏';});
})();
