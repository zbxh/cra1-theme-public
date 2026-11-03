/**
 * CRA1 cart presentation adapter. The server module remains the owner of
 * available configurations, restrictions, quotes and checkout. No plugin file
 * or stored configuration is changed by this adapter.
 */
(function (window) {
  'use strict';
  if (!window.Vue || window.CRA1CartControls) return;
  const Vue = window.Vue;
  const copy = value => JSON.parse(JSON.stringify(value));
  const same = (a, b) => String(a == null ? '' : a) === String(b == null ? '' : b);
  const quoteBatches = new WeakMap();
  function updateDisk(owner,target,value) {
    let batch=quoteBatches.get(owner);
    const schedule=!batch;
    if (!batch) {
      batch={quote:owner.getCycleList,disks:new Map()};
      quoteBatches.set(owner,batch);
      owner.getCycleList=function () {};
    }
    const desired=copy(value);
    batch.disks.set(target,desired);
    Object.keys(desired).forEach(key=>owner.$set(target,key,desired[key]));
    if (schedule) {
      // Register only after Vue has queued its type watcher. Otherwise the
      // restoration could run before the module's capacity reset.
      owner.$nextTick(()=>{
        batch.disks.forEach((desired,disk)=>Object.keys(desired).forEach(key=>owner.$set(disk,key,desired[key])));
        owner.$nextTick(()=>{
          owner.getCycleList=batch.quote;
          quoteBatches.delete(owner);
          if (!owner._isDestroyed) batch.quote.call(owner);
        });
      });
    }
  }
  const paths = {
    image: '<rect x="3" y="3" width="18" height="14" rx="2"/><path d="M8 21h8M12 17v4m-5-9 3-3-3-3m6 6h4"/>',
    storage: '<rect x="3" y="4" width="18" height="6" rx="2"/><rect x="3" y="14" width="18" height="6" rx="2"/><path d="M7 7h.01M7 17h.01M11 7h6M11 17h6"/>',
    network: '<rect x="9" y="3" width="6" height="5" rx="1"/><rect x="3" y="16" width="6" height="5" rx="1"/><rect x="15" y="16" width="6" height="5" rx="1"/><path d="M12 8v4M6 16v-4h12v4"/>',
    security: '<path d="m12 3 8 3v5c0 5-4 8-8 10-4-2-8-5-8-10V6z"/><path d="m8 12 3 3 5-6"/>',
    finance: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h3M15 15h2"/>',
    options: '<path d="M4 6h4m4 0h8M4 12h10m4 0h2M4 18h2m4 0h10"/><circle cx="10" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="8" cy="18" r="2"/>',
    product: '<path d="m12 3 9 5-9 5-9-5zM3 8v9l9 5 9-5V8M12 13v9M7.5 5.5l9 5"/>',
    basic: '<rect x="6" y="6" width="12" height="12" rx="3"/><path d="M9 1v5m6-5v5M9 18v5m6-5v5M1 9h5m-5 6h5M18 9h5m-5 6h5"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>'
  };
  function glyph(name) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (paths[name] || paths.basic) + '</svg>';
  }
  const headingKinds = {
    category_primary:'product', category_secondary:'product', product_model:'product',
    config_method:'options', billing_cycle:'finance', basic:'basic', package:'product',
    instance:'basic', model:'product', image:'image', storage:'storage', network:'network',
    security:'security', other:'options', option:'options', price:'finance'
  };
  // Vue observes the shared state, including when the snapshot arrives after a
  // server-module template was mounted. Embedded pages get the same snapshot.
  const headingState = Vue.observable({icons:{},styles:{},meta:{}});
  function setHeadingSnapshot(snapshot) {
    const icons=snapshot && snapshot.content && snapshot.content.goodslist && snapshot.content.goodslist.heading_icons;
    headingState.icons=icons && typeof icons === 'object' && !Array.isArray(icons) ? icons : {};
    const goods=snapshot && snapshot.content && snapshot.content.goodslist || {};headingState.styles=goods.heading_icon_styles || {};headingState.meta=goods.heading_icon_meta || {};
  }
  setHeadingSnapshot(window.__CRA1_CART_SNAPSHOT__);
  if (window.__CRA1_CART_SNAPSHOT_PROMISE__) window.__CRA1_CART_SNAPSHOT_PROMISE__.then(setHeadingSnapshot);
  function safeIconUrl(value) {
    if (typeof value !== 'string' || /[\s<>"'\\]/.test(value)) return '';
    return /^(?:https:\/\/[^/]+\/|\/(?!\/)[^?#]*\.(?:svg|png|jpe?g|webp|gif|ico)(?:[?#]|$))/i.test(value) ? value : '';
  }
  Vue.component('cra1-cart-heading-icon', {
    props: ['label', 'kind', 'iconId'],
    data() { return {failedUrl:''}; },
    computed: {
      name() {
        if (headingKinds[this.iconId]) return headingKinds[this.iconId];
        if (this.kind) return this.kind;
        const text = String(this.label || '');
        if (/镜像|系统|image/i.test(text)) return 'image';
        if (/存储|磁盘|storage/i.test(text)) return 'storage';
        if (/网络|线路|带宽|network/i.test(text)) return 'network';
        if (/安全|密码|登录|security/i.test(text)) return 'security';
        if (/价格|费用|支付|计费|财务|订单|price|bill/i.test(text)) return 'finance';
        if (/选配|其他|自定义|option/i.test(text)) return 'options';
        if (/产品|型号|套餐|product|package/i.test(text)) return 'product';
        return 'basic';
      },
      tone() { return this.name === 'finance' ? 'finance' : this.name === 'security' ? 'security' : 'compute'; },
      customUrl() { return safeIconUrl(headingState.icons[this.iconId]); },
      iconStyle() { return window.CRA1Shared && window.CRA1Shared.IconStyle ? window.CRA1Shared.IconStyle.vars(headingState.styles[this.iconId],true) : {}; }
    },
    render(h) {
      const attrs={'data-cui-icon-tone':this.tone,'data-cart-heading':this.iconId || '', 'aria-hidden':'true'};
      if(headingState.styles[this.iconId])attrs['data-cui-icon-style']='1';
      const style=this.iconStyle;
      if (this.customUrl && this.failedUrl !== this.customUrl) {
        return h('span', {class:'cl-heading-icon cui-business-icon cui-business-icon--tile',attrs,style}, [
          headingState.meta[this.iconId] && headingState.meta[this.iconId].colorable ? h('span',{class:'cui-icon-mask',style:{'--cui-icon-url':'url("'+this.customUrl+'")'}}) : h('img',{attrs:{src:this.customUrl,alt:'',decoding:'async'},on:{error:()=>{this.failedUrl=this.customUrl;}}})
        ]);
      }
      return h('span', {class:'cl-heading-icon cui-business-icon cui-business-icon--tile',attrs,style,domProps:{innerHTML:glyph(this.name)}});
    }
  });

  // Evaluate the original restriction calculation against a private parameter
  // copy. This lets a modal change type/capacity without touching the quote VM.
  function shadowOwner(owner, index, value) {
    const shadow = Object.create(owner);
    const params = copy(owner.params);
    if (index === 0) params.system_disk = copy(value);
    else params.data_disk[index - 1] = copy(value);
    Object.defineProperties(shadow, {
      params: {value:params, writable:true},
      systemDiskTip: {value:'', writable:true},
      $nextTick: {value:fn => { if (fn) fn.call(shadow); }}
    });
    return shadow;
  }
  function diskContract(owner, index, value) {
    const gift = index === 1 && Number(owner.baseConfig.free_disk_switch) === 1;
    const source = index === 0 ? owner.systemDiskList : owner.dataDiskList;
    const type = (source[0] || {}).type || 'radio';
    const types = gift
      ? [{value:owner.baseConfig.free_disk_type, label:owner.baseConfig.free_disk_type || '默认类型'}]
      : (index === 0 ? owner.systemType : owner.dataType) || [];
    let allowed = [];
    if (index === 0) {
      const shadow = shadowOwner(owner, index, value);
      const def = owner.$options.computed.calcSystemDiskList;
      allowed = (typeof def === 'function' ? def : def.get).call(shadow) || [];
    } else if (type === 'radio') {
      allowed = gift ? owner.calcDataSelect : (owner.dataNumObj[value.disk_type] || []);
    } else {
      allowed = (owner.dataRangArr[value.disk_type] || []).slice();
      if (gift) {
        const floor = Number(owner.baseConfig.free_disk_size);
        allowed = allowed.filter(n => Number(n) >= floor);
        if (!allowed.some(n => Number(n) === floor)) allowed.unshift(floor);
      }
    }
    // All capacities originate in the module's allowed list. The index slider
    // skips forbidden gaps; step alignment uses exactly the module's diskStep.
    let values = allowed.map(item => Number(typeof item === 'object' ? item.value : item)).filter(Number.isFinite);
    if (type !== 'radio') {
      const step = Number(owner.diskStep);
      const aligned = step > 0 ? values.filter(n => n % step === 0) : values;
      values = aligned.length ? aligned : values.slice(0, 1);
      if (gift && !values.includes(Number(owner.baseConfig.free_disk_size))) values.unshift(Number(owner.baseConfig.free_disk_size));
    }
    values = [...new Set(values)].sort((a,b) => a-b);
    const matched = (source || []).find(item => same(item.other_config.disk_type, value.disk_type) &&
      (item.type === 'radio' ? Number(item.value) === Number(value.size) : Number(value.size) >= Number(item.min_value) && Number(value.size) <= Number(item.max_value)));
    const limits = gift ? [] : ((matched && matched.disk_limit) || []).map(item => ({
      id:item.id,
      label:(owner.lang.disk_limit_read_bytes || '读写速度')+'：'+item.read_bytes+'/'+item.write_bytes+' MB/s · IOPS '+item.read_iops+'/'+item.write_iops
    }));
    return {type, types, values, limits, gift};
  }
  function nearest(values, value) {
    return values.reduce((best,n) => Math.abs(n-value) < Math.abs(best-value) ? n : best, values[0]);
  }
  Vue.component('cra1-cart-disk-fields', {
    props: ['owner', 'index', 'value', 'autoCorrect'],
    data() { return {rawSize:String(this.value.size), slideSize:Number(this.value.size)}; },
    computed: {
      contract() { return diskContract(this.owner, this.index, this.value); },
      sliderIndex() { return Math.max(0,this.contract.values.indexOf(this.slideSize)); },
      minimum() { return this.contract.values[0]; },
      maximum() { return this.contract.values[this.contract.values.length-1]; },
      fill() { return this.contract.values.length > 1 ? this.sliderIndex/(this.contract.values.length-1)*100 : 0; }
    },
    watch: {
      'value.size'(size) { this.rawSize=String(size); this.slideSize=Number(size); },
      contract(contract) {
        // Original computed fields also reconciled capacities after CPU,
        // region or image restrictions changed. Keep that behavior for the
        // live disk, while a modal's private draft never edits the owner.
        if (!this.autoCorrect || this.owner.activeName !== 'custom' || !contract.values.length) return;
        const value=Object.assign({},this.value);
        value.size=nearest(contract.values,Number(value.size));
        const limits=diskContract(this.owner,this.index,value).limits;
        if (value.disk_limit_id && !limits.some(item=>same(item.id,value.disk_limit_id))) value.disk_limit_id='';
        if (Number(value.size)!==Number(this.value.size) || !same(value.disk_limit_id,this.value.disk_limit_id)) this.emit(value);
      }
    },
    methods: {
      emit(value) { this.$emit('change',value); },
      changeType(event) {
        const option=this.contract.types.find(item => same(item.value,event.target.value));
        if (!option) return;
        const value=Object.assign({},this.value,{disk_type:option.value,disk_limit_id:''});
        const contract=diskContract(this.owner,this.index,value);
        value.size=contract.values[0];
        if (value.size === undefined) return;
        this.emit(value);
      },
      capacity(size) {
        const n=Number(size), values=this.contract.values;
        if (!values.length || !Number.isFinite(n)) { this.rawSize=String(this.value.size); return; }
        const value=Object.assign({},this.value,{size:nearest(values,n)});
        const limits=diskContract(this.owner,this.index,value).limits;
        if (!limits.some(item=>same(item.id,value.disk_limit_id))) value.disk_limit_id='';
        this.rawSize=String(value.size); this.slideSize=value.size;
        this.emit(value);
      },
      slide(event) {
        this.slideSize=this.contract.values[Number(event.target.value)];
        this.rawSize=String(this.slideSize);
      },
      bump(direction) {
        const values=this.contract.values;
        const current=Math.max(0,values.indexOf(Number(this.value.size)));
        this.capacity(values[Math.max(0,Math.min(values.length-1,current+direction))]);
      },
      performance(event) {
        const option=this.contract.limits.find(item=>same(item.id,event.target.value));
        this.emit(Object.assign({},this.value,{disk_limit_id:option ? option.id : ''}));
      }
    },
    template: '<div class="cl-cart-disk-fields">'+
      '<label class="cl-cart-field-row"><span>磁盘类型</span><span class="cl-cart-select-wrap"><select :value="value.disk_type" @change="changeType" :disabled="contract.gift || contract.types.length < 2" aria-label="磁盘类型"><option v-for="type in contract.types" :key="type.value" :value="type.value">{{type.label && type.label !== owner.lang.mf_no ? type.label : "默认类型"}}</option></select></span></label>'+
      '<div class="cl-cart-capacity" v-if="contract.values.length">'+
        '<div class="cl-cart-capacity-head"><span>容量</span>'+
          '<div class="cl-cart-number" v-if="contract.type !== \'radio\'"><button type="button" @click="bump(-1)" :disabled="Number(value.size) <= minimum" aria-label="减少容量">−</button><input type="number" inputmode="numeric" :min="minimum" :max="maximum" step="any" v-model="rawSize" @change="capacity(rawSize)" @keydown.enter.prevent="capacity(rawSize)" aria-label="磁盘容量 GB"><span>GB</span><button type="button" @click="bump(1)" :disabled="Number(value.size) >= maximum" aria-label="增加容量">+</button></div>'+
        '</div>'+
        '<div class="cl-cart-fixed-grid" v-if="contract.type === \'radio\'" role="group" aria-label="可选容量"><button type="button" v-for="size in contract.values" :key="size" :aria-pressed="Number(value.size) === size ? \'true\' : \'false\'" @click="capacity(size)"><strong>{{size}}</strong><small>GB</small></button></div>'+
        '<template v-else><input class="cl-cart-range" type="range" min="0" :max="Math.max(0,contract.values.length-1)" step="1" :value="sliderIndex" @input="slide" @change="capacity(slideSize)" :disabled="contract.values.length < 2" :style="{\'--range-fill\':fill+\'%\'}" aria-label="调整磁盘容量" :aria-valuetext="slideSize+\' GB\'"><div class="cl-cart-range-labels"><span>{{minimum}} GB</span><span>{{maximum}} GB</span></div></template>'+
      '</div><p class="cl-cart-empty" v-else>当前组合暂无可选容量，请调整其他配置。</p>'+
      '<label class="cl-cart-field-row cl-cart-performance" v-if="contract.limits.length"><span>性能</span><span class="cl-cart-select-wrap"><select :value="value.disk_limit_id || \'\'" @change="performance" aria-label="磁盘性能"><option value="">默认性能</option><option v-for="limit in contract.limits" :key="limit.id" :value="limit.id">{{limit.label}}</option></select></span></label>'+
    '</div>'
  });
  Vue.component('cra1-cart-storage', {
    props: ['owner'],
    data() { return {draft:null,editIndex:-1,baseline:null,dialogError:'',mobile:false,returnFocus:null}; },
    computed: {
      rows() { return this.owner.storeList || []; },
      canAdd() { return this.rows.length < Number(this.owner.baseConfig.disk_limit_num)+1 && this.owner.dataDiskList.length > 0; },
      remaining() { return Math.max(0,Number(this.owner.baseConfig.disk_limit_num)+1-this.rows.length); }
    },
    mounted() { this.mobile=this.owner.$el.classList.contains('m-cloud-m'); },
    beforeDestroy() { this.close(); },
    methods: {
      value(index) { return index === 0 ? this.owner.params.system_disk : this.owner.params.data_disk[index-1]; },
      name(index) { return index === 0 ? '系统盘' : this.isGift(index) ? '赠送数据盘' : '数据盘 '+(index-(Number(this.owner.baseConfig.free_disk_switch) === 1 ? 1 : 0)); },
      isGift(index) { return index === 1 && Number(this.owner.baseConfig.free_disk_switch) === 1; },
      typeLabel(index) {
        const value=this.value(index), types=index === 0 ? this.owner.systemType : this.owner.dataType;
        const type=(types || []).find(item=>same(item.value,value.disk_type));
        return (type && type.label && type.label !== this.owner.lang.mf_no ? type.label : value.disk_type) || '默认类型';
      },
      remove(index) { if (index > 0 && !this.isGift(index)) { this.close(); this.owner.delDataDisk(index); } },
      commit(index,value) {
        const target=this.value(index);
        if (!target) return false;
        const contract=diskContract(this.owner,index,value);
        if (!contract.types.some(item=>same(item.value,value.disk_type)) || !contract.values.includes(Number(value.size))) return false;
        if (value.disk_limit_id && !contract.limits.some(item=>same(item.id,value.disk_limit_id))) return false;
        // One synchronous update: no type handler may reset a newly chosen
        // capacity, and the quote receives the complete disk together.
        // The module watches system type and resets its capacity on the next
        // Vue tick. Coalesce that intermediate quote, then restore the user's
        // validated capacity/performance before issuing one complete quote.
        updateDisk(this.owner,target,value);
        const row=this.rows[index];
        if (row) {
          this.owner.$set(row,'disk_type',target.disk_type);
          this.owner.$set(row,'size',target.size);
          this.owner.$set(row,'disk_text',this.typeLabel(index));
          if (contract.values.length) {
            this.owner.$set(row,'min',contract.values[0]);
            this.owner.$set(row,'max',contract.values[contract.values.length-1]);
          }
        }
        return true;
      },
      open(index,event) {
        this.editIndex=index; this.draft=copy(this.value(index)); this.baseline=JSON.stringify(this.value(index)); this.dialogError='';
        this.returnFocus=event.currentTarget;
        this.$nextTick(()=>this.$refs.dialog.showModal());
      },
      close() {
        if (this.$refs.dialog && this.$refs.dialog.open) this.$refs.dialog.close();
        this.draft=null; this.editIndex=-1; this.dialogError='';
        const button=this.returnFocus; this.returnFocus=null;
        if (button && button.isConnected) button.focus({preventScroll:true});
      },
      apply() {
        if (this.editIndex < 0) return;
        if (JSON.stringify(this.value(this.editIndex)) !== this.baseline) {
          this.dialogError='配置已更新，请取消后重新打开。'; return;
        }
        if (!this.commit(this.editIndex,this.draft)) { this.dialogError='此容量或性能当前不可选，请重新选择。'; return; }
        this.close();
      }
    },
    template: '<section class="cl-cart-controls cl-cart-storage" :data-mobile="mobile ? \'true\' : \'false\'">'+
      '<h3 class="cl-config-heading cl-cart-section-heading"><cra1-cart-heading-icon label="存储配置" icon-id="storage"></cra1-cart-heading-icon><span>存储配置</span></h3>'+
      '<div class="cl-cart-disk-grid"><article class="cl-cart-disk-card" v-for="(row,index) in rows" :key="index" :data-kind="index === 0 ? \'system\' : \'data\'">'+
        '<div class="cl-cart-disk-heading"><div class="cl-cart-disk-name"><h4><span>{{name(index)}}</span><span class="cl-cart-required" v-if="index === 0">必需</span><span class="cl-cart-required" v-else-if="isGift(index)">赠送</span></h4></div><button v-if="index > 0 && !isGift(index)" type="button" class="cl-cart-disk-remove" @click="remove(index)" :aria-label="\'删除\'+name(index)">'+glyph('trash')+'</button></div>'+
        '<div class="cl-cart-disk-compact"><strong>{{value(index).size}} <small>GB</small></strong><span>{{typeLabel(index)}}</span><button type="button" @click="open(index,$event)">调整</button></div>'+
        '<cra1-cart-disk-fields class="cl-cart-desktop-fields" :owner="owner" :index="index" :value="value(index)" :auto-correct="true" @change="commit(index,$event)"></cra1-cart-disk-fields>'+
      '</article></div>'+
      '<button class="cl-cart-add-disk" type="button" v-if="canAdd" @click="owner.addDataDisk()">'+glyph('plus')+'<span>添加数据盘</span><small>还可添加 {{remaining}} 块</small></button>'+
      '<dialog class="cl-cart-disk-dialog" ref="dialog" @cancel.prevent="close" aria-labelledby="cl-cart-disk-dialog-title">'+
        '<div class="cl-cart-dialog-heading"><h3 id="cl-cart-disk-dialog-title">{{editIndex >= 0 ? \'调整\'+name(editIndex) : \'调整磁盘\'}}</h3><button type="button" @click="close" aria-label="关闭">'+glyph('close')+'</button></div>'+
        '<div class="cl-cart-dialog-body" v-if="draft"><cra1-cart-disk-fields :owner="owner" :index="editIndex" :value="draft" @change="draft=$event"></cra1-cart-disk-fields><p class="cl-cart-error" v-if="dialogError" role="alert">{{dialogError}}</p></div>'+
        '<div class="cl-cart-dialog-actions"><button type="button" class="cui-button cui-button--outline" @click="close">取消</button><button type="button" class="cui-button cui-button--primary" @click="apply">应用</button></div>'+
      '</dialog>'+
    '</section>'
  });
  Vue.component('cra1-cart-images', {
    props: ['owner'],
    data() { return {openId:null,focusIndex:0}; },
    computed: {
      groups() {
        const visible=this.owner.calcImageList || [];
        if (!this.owner.imageList.length) return [];
        return this.owner.filterIamge && this.owner.filterIamge.length ? this.owner.filterIamge : visible;
      }
    },
    mounted() { this.owner.isHide=false; },
    methods: {
      sameId:same,
      selected(group) { return (group.image || []).some(version=>same(version.id,this.owner.params.image_id)); },
      version(group) { const version=(group.image || []).find(item=>same(item.id,this.owner.params.image_id)); return version ? version.name : '选择版本'; },
      logo(group) { return group.icon_url || (group.icon ? '/plugins/server/mf_cloud/template/clientarea/pc/default/img/mf_cloud/'+encodeURIComponent(group.icon)+'.svg' : ''); },
      toggle(group) {
        if (this.openId === group.id) { this.openId=null; return; }
        this.openId=group.id;
        this.focusIndex=Math.max(0,(group.image || []).findIndex(item=>same(item.id,this.owner.params.image_id)));
        this.$nextTick(()=>{ this.positionMenu(); this.focusOption(); });
      },
      close(focus) { const id=this.openId; this.openId=null; if (focus) this.$nextTick(()=>{const button=this.$el.querySelector('[data-version-trigger="'+id+'"]');if(button)button.focus({preventScroll:true});}); },
      choose(group,version) {
        this.owner.changeImage(group,this.groups.findIndex(item=>same(item.id,group.id)));
        this.owner.chooseVersion(version,group);
        this.close(true);
      },
      positionMenu() {
        const menu=this.$el.querySelector('[role="listbox"]');
        if (!menu) return;
        const card=menu.parentElement.getBoundingClientRect();
        menu.style.left='0'; menu.style.right='auto';
        const rect=menu.getBoundingClientRect();
        if (rect.right > innerWidth-12) menu.style.left=Math.min(0,innerWidth-12-rect.right)+'px';
        if (card.bottom > innerHeight-160 && card.top > 180) {
          menu.style.top='auto'; menu.style.bottom='calc(100% - 5px)';
          menu.style.maxHeight=Math.min(280,card.top-16)+'px';
        }
      },
      focusOption() {
        const options=this.$el.querySelectorAll('[role="listbox"] [role="option"]');
        if(options[this.focusIndex]) {
          options[this.focusIndex].focus({preventScroll:true});
          const menu=options[this.focusIndex].parentElement;
          const option=options[this.focusIndex];
          if (option.offsetTop < menu.scrollTop) menu.scrollTop=option.offsetTop;
          else if (option.offsetTop+option.offsetHeight > menu.scrollTop+menu.clientHeight) menu.scrollTop=option.offsetTop+option.offsetHeight-menu.clientHeight;
        }
      },
      keys(event,group) {
        if (event.key === 'Escape') { event.preventDefault();this.close(true);return; }
        if (event.key === 'Tab') { this.close(false);return; }
        const count=(group.image || []).length;
        if (['ArrowDown','ArrowUp','Home','End'].includes(event.key)) {
          event.preventDefault();
          this.focusIndex=event.key === 'Home' ? 0 : event.key === 'End' ? count-1 : Math.max(0,Math.min(count-1,this.focusIndex+(event.key === 'ArrowDown'?1:-1)));
          this.focusOption();
        }
      },
      outside(event) { if (!this.$el.contains(event.target)) this.close(false); },
      imageError(event) { event.target.hidden=true; event.target.parentElement.insertAdjacentHTML('beforeend',glyph('image')); }
    },
    created() { document.addEventListener('pointerdown',this.outside); },
    beforeDestroy() { document.removeEventListener('pointerdown',this.outside); },
    template: '<section class="cl-cart-controls cl-cart-images">'+
      '<h3 class="cl-config-heading cl-cart-section-heading"><cra1-cart-heading-icon label="镜像配置" icon-id="image"></cra1-cart-heading-icon><span>镜像配置</span></h3>'+
      '<div class="cl-cart-image-tabs" v-if="owner.marketImageCount > 0"><button type="button" :aria-pressed="owner.imageType === \'public\' ? \'true\' : \'false\'" @click="owner.imageType=\'public\'">{{owner.lang.public_image || \'公共镜像\'}}</button><button type="button" :aria-pressed="owner.imageType === \'market\' ? \'true\' : \'false\'" @click="owner.imageType=\'market\'">{{owner.lang.image_market || \'镜像市场\'}}</button></div>'+
      '<div class="cl-cart-image-grid"><article class="cl-cart-os-card" v-for="group in groups" :key="group.id" :data-selected="selected(group) ? \'true\' : \'false\'" :data-open="openId === group.id ? \'true\' : \'false\'">'+
        '<button type="button" class="cl-cart-os-pick" @click="toggle(group)" :aria-label="\'选择\'+group.name+\'版本\'" :aria-pressed="selected(group) ? \'true\' : \'false\'"><span class="cl-cart-os-logo cui-icon-well"><img v-if="logo(group)" :src="logo(group)" alt="" @error="imageError"><span v-else>'+glyph('image')+'</span></span><span class="cl-cart-os-name">{{group.name}}</span><span class="cl-cart-os-check">'+glyph('check')+'</span></button>'+
        '<button type="button" class="cl-cart-version-trigger" :data-version-trigger="group.id" :aria-expanded="openId === group.id ? \'true\' : \'false\'" aria-haspopup="listbox" @click="toggle(group)" @keydown.down.prevent="toggle(group)"><span>{{version(group)}}</span>'+glyph('down')+'</button>'+
        '<div v-if="openId === group.id" class="cl-cart-version-menu" role="listbox" :aria-label="group.name+\'版本\'" @keydown="keys($event,group)"><button type="button" v-for="(version,versionIndex) in group.image" :key="version.id" role="option" :tabindex="focusIndex === versionIndex ? 0 : -1" :aria-selected="sameId(version.id,owner.params.image_id) ? \'true\' : \'false\'" @click="choose(group,version)" @focus="focusIndex=versionIndex"><span>{{version.name}}</span><small v-if="version.charge && Number(version.price) > 0">{{owner.commonData.currency_prefix}}{{version.price}}</small>'+glyph('check')+'</button></div>'+
      '</article><div v-if="!groups.length" class="cl-cart-empty">暂无可选镜像</div></div>'+
      '<p class="cl-cart-error" v-if="owner.showImage" role="alert">{{owner.lang.mf_tip6}}</p>'+
    '</section>'
  });
  function all(root,selector) {
    let result=[...root.querySelectorAll(selector)];
    root.querySelectorAll('template').forEach(node=>{result=result.concat(all(node.content,selector));});
    return result;
  }
  function transform(content) {
    if (typeof content !== 'string') return content;
    try {
      const template=document.createElement('template'); template.innerHTML=content;
      const fragment=template.content;
      const cloud=!!fragment.querySelector('link[href*="/mf_cloud/"]');
      if (cloud) {
        // The CRA1 phone fork names its duration collection cycleList; its
        // template still referenced an absent calcCycleList alias.
        if (fragment.querySelector('.m-cloud-m')) {
          all(fragment,'cl-picker').forEach(node=>{
            if (node.getAttribute(':columns') === 'calcCycleList') node.setAttribute(':columns','cycleList');
          });
          // The new private-draft dialog replaces this editor entirely. Its
          // old slot bindings would otherwise keep evaluating live disk
          // computations even though the old dialog can no longer be opened.
          all(fragment,'el-dialog').forEach(node=>{
            if (node.getAttribute(':visible.sync') === 'showSystemDisk') node.remove();
          });
        }
        all(fragment,'el-form-item.image,cl-picker').forEach(node=>{
          if (node.tagName.toLowerCase() === 'cl-picker' && node.getAttribute(':label') !== 'lang.cloud_menu_5') return;
          const replacement=document.createElement('cra1-cart-images');
          replacement.setAttribute(':owner','$root');
          node.replaceWith(replacement);
        });
        all(fragment,'el-form-item.store-item,.disk-detail').forEach(node=>{
          const target=node.classList.contains('disk-detail') ? node.closest('.clm-slider-field') : node;
          if (!target) return;
          const replacement=document.createElement('cra1-cart-storage');
          replacement.setAttribute(':owner','$root');
          target.replaceWith(replacement);
        });
      }
      all(fragment,'.com-tit,.config-tit,.custom-label').forEach(node=>{
        if (node.querySelector('cra1-cart-heading-icon')) return;
        const text=node.innerHTML;
        const expression=text.match(/\{\{([^}]+)\}\}/);
        const icon=document.createElement('cra1-cart-heading-icon');
        const bindings={tabsTitle:'config_method',mf_bill_way:'billing_cycle',cycle:'billing_cycle',basic_config:'basic',package_config:'package',cloud_config:'instance',model_config:'model',cloud_menu_5:'image',system_config:'image',net_config:'network',security_group:'security',other_config:'other',option_name:'option'};
        const binding=expression && expression[1].match(/(?:lang\.|item\.)([a-z_]+)|\b(tabsTitle)\b/);
        const iconId=binding && bindings[binding[1] || binding[2]] || 'option';
        icon.setAttribute('icon-id',iconId);
        if (iconId === 'image') node.textContent='镜像配置';
        if (expression) icon.setAttribute(':label',expression[1].trim());
        else icon.setAttribute('label',node.textContent);
        node.classList.add('cl-config-heading');
        node.prepend(icon);
      });
      // The desktop tab header used a CSS-only title. Give it a real, shared
      // icon/title row, while preserving the configurable CSS title.
      all(fragment,'.top-tab').forEach(node=>{
        const title=document.createElement('div');
        title.className='cl-config-heading cl-config-method';
        title.innerHTML='<cra1-cart-heading-icon label="选配方式" icon-id="config_method"></cra1-cart-heading-icon><span class="cl-config-method-label"></span>';
        node.before(title);
        node.classList.add('cl-config-tabs');
      });
      // Some phone templates put their boot scripts inside the Vue root.
      // Keep their execution order, but outside the compiled UI (the direct
      // renderer already extracts them; standalone jQuery pages did not).
      all(fragment,'.m-cloud-m').forEach(node=>{
        const scripts=all(node,'script');
        if (scripts.length) node.after(...scripts);
      });
      return template.innerHTML;
    } catch (error) {
      console.warn('[CRA1CartControls] 保留原商品配置界面',error);
      return content;
    }
  }
  window.CRA1CartControls={transform,version:'20261012-cart-heading-v1'};
})(window);
