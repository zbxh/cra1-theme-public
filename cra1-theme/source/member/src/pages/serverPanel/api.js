import { get as baseGet, api as requestApi, put as basePut, del } from '../../lib'

/**
 * 服务器控制面板 API 层 —— 端点逐一对应旧面板
 * public/plugins/server/mf_cloud/template/clientarea/pc/default/api/cloud.js
 * （Axios baseURL=/console/v1，此处沿用 src/lib.js 的封装：JWT/401/超时一致）。
 * 模块前缀可替换：mf_cloud / mf_dcim 共用同一套路由形态（DCIM 无备份快照/VPC/NAT）。
 */

export const createServerApi = (module, hostId, signal, transport) => {
  const M = module // 'mf_cloud' | 'mf_dcim'
  const p = `/${M}/${hostId}`
  const pp = `/product/` // 订购页级接口需要 product_id，单独传
  // 只读刷新可取消；业务写请求仍按原有契约执行。
  const send = transport || requestApi
  const get = (path, params) => send(path, { params, signal })
  const post = (path, body) => send(path, { method: 'POST', body })
  const put = transport ? (path, body) => send(path, { method: 'PUT', body }) : basePut

  return {
    withSignal: nextSignal => createServerApi(module, hostId, nextSignal, transport),
    /* ---- 实例信息 ---- */
    // 实例全量详情（CloudController::detail）
    detail: (params) => get(p, params),
    // 轻量详情（数据中心/IP/电源状态/镜像）——状态轮询后刷新用
    detailPart: () => get(`${p}/part`),
    // 运行状态 pending|on|off|suspend|operating|fault + desc
    status: () => get(`${p}/status`),
    // 登录信息（username/password/port/rescue/panel_pass 等）
    remoteInfo: () => get(`${p}/remote_info`),
    remoteSummary: () => get(`${p}/remote_info`, { metadata_only: 1 }),
    // IPv4 列表 list[]{ip,subnet_mask,gateway}
    ipList: (params) => get(`${p}/ip`, params),
    // IPv6 列表
    ipv6List: (params) => get(`${p}/ipv6`, params),

    /* ---- 电源 ---- */
    powerOn: (body) => post(`${p}/on`, body),
    powerOff: (body) => post(`${p}/off`, body),
    reboot: (body) => post(`${p}/reboot`, body),
    hardOff: (body) => post(`${p}/hard_off`, body),
    hardReboot: (body) => post(`${p}/hard_reboot`, body),

    /* ---- 控制台 ---- */
    // POST 返回 url/vnc_url/vnc_pass/password/token；GET ?tmp_token= 为 noVNC 页面
    vnc: (body) => post(`${p}/vnc`, body),

    /* ---- 监控 / 流量 ---- */
    // chart?type=cpu|memory|disk_io|bw&start_time=&dev=
    chart: (params) => get(`${p}/chart`, params),
    // 实时占用 cpu_usage/memory_total/memory_usable/memory_usage
    realData: () => get(`${p}/real_data`),
    // 流量汇总 total/used/leave/reset_flow_date/flow_packet
    flow: (params) => get(M === 'mf_cloud' ? `/cra1-theme/module/mf_cloud/${hostId}/flow` : `${p}/flow`, params),
    // 流量曲线 list[]{time,in,out} + unit
    flowData: (params) => get(`${p}/flow_data`, params),
    // 已购买流量包列表（不是可购买套餐）。
    trafficPackage: (params) => get(`${p}/traffic_package`, params),
    flowPacketList: (params) => get(`/host/${hostId}/flow_packet`, params),

    /* ---- 磁盘 ---- */
    diskList: (params) => get(M === 'mf_cloud' ? `/cra1-theme/module/mf_cloud/${hostId}/disk` : `${p}/disk`, params),
    diskMount: (diskId, body) => post(`${p}/disk/${diskId}/mount`, body),
    diskUnmount: (diskId, body) => post(`${p}/disk/${diskId}/unmount`, body),
    deleteFailedDisk: (diskId) => del(`/cra1-theme/module/mf_cloud/${hostId}/disk/${diskId}/failed`),
    // 购买磁盘询价/下单
    diskPrice: (body) => post(`${p}/disk/price`, body),
    diskOrder: (body) => send(`${p}/disk/order`, { method: 'POST', body, orderCreation: true }),
    // 扩容询价/下单
    diskResizePrice: (body) => post(`${p}/disk/resize`, body),
    diskResizeOrder: (body) => post(`${p}/disk/resize/order`, body),
    // 磁盘档位（订购页配置：data_disk 分组 {type:step|radio, min_value, max_value, step, other_config.disk_type}）
    orderPage: (productId, params) => get(`${pp}${productId}/${M}/order_page`, params),
    // 线路配置（IP/IPv6 数量档位：{ip:[...], ipv6:[...]}）
    lineConfig: (productId, lineId) => get(`${pp}${productId}/mf_cloud/line/${lineId}`),

    /* ---- 快照 / 备份 ---- */
    snapshotList: (params) => get(`${p}/snapshot`, params),
    createSnapshot: (body) => post(`${p}/snapshot`, body),
    restoreSnapshot: (body) => post(`${p}/snapshot/restore`, body),
    delSnapshot: (snapshotId, params) => del(`${p}/snapshot/${snapshotId}`, params),
    backupList: (params) => get(`${p}/backup`, params),
    createBackup: (body) => post(`${p}/backup`, body),
    restoreBackup: (body) => post(`${p}/backup/restore`, body),
    delBackup: (backupId, params) => del(`${p}/backup/${backupId}`, params),
    // 数量升降级（含空间模式）
    backupConfig: (params) => get(`${p}/backup_config`, params),
    backupConfigOrder: (body) => post(`${p}/backup_config/order`, body),

    /* ---- 重装 / 镜像 / SSH ---- */
    // 订购页镜像列表（分页）
    image: (productId, params) => get(`${pp}${productId}/${M}/image`, params),
    imageCheck: (params) => get(`${p}/image/check`, params),
    imageOrder: (body) => post(`${p}/image/order`, body),
    sshKeyList: (params) => get(`/ssh_key`, params),
    reinstall: (body) => post(`${p}/reinstall`, body),
    manualResourceOs: (manualResourceId) => get(`/manual_resource/${manualResourceId}/os`),

    /* ---- 密码 / 救援 / RDP ---- */
    resetPassword: (body) => post(`${p}/reset_password`, body),
    rescue: (body) => post(`${p}/rescue`, body),
    exitRescue: (body) => post(`${p}/rescue/exit`, body),
    simulatePhysicalMachine: (body) => post(`${p}/simulate_physical_machine`, body),
    // 返回 JSON {content,name}，由调用方生成下载文件。
    downloadRdp: () => get(`${p}/download_rdp`),
    downloadRdpUrl: `/console/v1${p}/download_rdp`,

    /* ---- 升降级 ---- */
    // 套餐版：可升级套餐
    recommendConfig: () => get(`${p}/recommend_config`),
    recommendConfigPrice: (params) => get(`${p}/recommend_config/price`, params),
    recommendConfigOrder: (body) => post(`${p}/recommend_config/order`, body),
    // 自选配置（cpu/memory 定价形态）
    commonConfig: (params) => get(`${p}/common_config`, params),
    commonConfigOrder: (body) => post(`${p}/common_config/order`, body),
    // 产品级（新版配置升降级，走系统 host 路由）
    productUpgradeList: (params) => get(`/host/${hostId}/product_upgrade`, params),
    productUpgradeConfig: (params) => get(`/host/${hostId}/product_upgrade/config`, params),
    productUpgradePrice: (body) => post(`/host/${hostId}/product_upgrade/price`, body),
    productUpgradeOrder: (body) => post(`/host/${hostId}/product_upgrade/order`, body),
    // IP 防御升级（config/price 均需 ip 参数）
    defenceConfig: (params) => get(`${p}/upgrade_defence_config`, params),
    defencePrice: (params) => get(`${p}/upgrade_defence/price`, params),
    defenceOrder: (body) => post(`${p}/upgrade_defence/order`, body),
    // 流量包下单（host 维度：POST /host/:id/flow_packet_order）
    flowPacketOrder: (body) => post(`/host/${hostId}/flow_packet_order`, body),
    // 退订/停用（addon 通用能力）
    refundMsg: () => get(`/refund/host/${hostId}/refund`),
    refundPage: (params) => get(`/refund`, params),
    refundApply: (body) => post(`/refund`, body),
    refundCancel: (refundId) => put(`/refund/${refundId}/cancel`),

    /* ---- 网络 ---- */
    // 附加 IP
    ipNumPrice: (params) => get(`${p}/ip_num`, params),
    ipNumOrder: (body) => post(`${p}/ip_num/order`, body),
    // VPC
    vpcNetworkList: (params) => get(`${p}/vpc_network`, params),
    vpcNetworkCreate: (body) => post(`${p}/vpc_network`, body),
    vpcNetworkChange: (body) => put(`${p}/vpc_network`, body),
    vpcNetworkDelete: (vpcId) => del(`${p}/vpc_network/${vpcId}`),
    usableVpcNetwork: (params) => get(`/mf_cloud/vpc_network/host`, params),
    // NAT
    natAcl: (params) => get(`${p}/nat_acl`, params),
    addNatAcl: (body) => post(`${p}/nat_acl`, body),
    delNatAcl: (params) => del(`${p}/nat_acl`, params),
    natWeb: (params) => get(`${p}/nat_web`, params),
    addNatWeb: (body) => post(`${p}/nat_web`, body),
    delNatWeb: (params) => del(`${p}/nat_web`, params),

    /* ---- 安全组（addon idcsmart_cloud）---- */
    securityGroupList: (params) => get(`/security_group`, params),
    bindSecurityGroup: (sgId, body) => post(`/security_group/${sgId}/host/${body.host_id}`, body),
    unbindSecurityGroup: (sgId, body) => del(`/security_group/${sgId}/host/${body.host_id}`, body),

    /* ---- 日志 ---- */
    log: (params) => get(`${p}/log`, params),

    /* ---- 系统 host 级 ---- */
    // 详情 / 备注 / 自动释放时间
    hostDetail: () => get(`/host/${hostId}`),
    notes: (body) => put(`/host/${hostId}/notes`, body),
    autoRelease: (body) => put(`/host/${hostId}/auto_release_time`, body),
    // 续费（addon idcsmart_renew）
    renewPage: (params) => get(`/host/${hostId}/renew`, params),
    renew: (body) => post(`/host/${hostId}/renew`, body),
    renewAutoStatus: (params) => get(`/host/${hostId}/renew/auto`, params),
    renewAutoSet: (body) => put(`/host/${hostId}/renew/auto`, body),
    // 优惠码（实例内页）
    promoCode: (params) => get(`/promo_code/host/${hostId}/promo_code`, params),
    // 按需/包年包月互转
    demandToPrepaymentPrice: () => get(`/host/${hostId}/on_demand_to_recurring_prepayment`),
    demandToPrepayment: (body) => post(`/host/${hostId}/on_demand_to_recurring_prepayment`, body),
    durationToDemandPrice: () => get(`/host/${hostId}/recurring_prepayment_to_on_demand`),
    durationToDemand: (body) => post(`/host/${hostId}/recurring_prepayment_to_on_demand`, body),
    cancelDurationToDemand: () => del(`/host/${hostId}/recurring_prepayment_to_on_demand`),

    /* ---- 订单记录 ----
       host_id 过滤覆盖所有「订单子项绑定了本机」的订单（新购/续费/升降级/计费转换/插件型人工订单）；
       后台手动创建的人工订单不绑定机器 ID（只写 description），需按主机标识文本匹配，
       见 OrderTab 的 keywords 二次查询（OrderModel.php:239 支持按 host.name 搜索）。 */
    orderList: (params) => get('/order', params),
    orderDetail: (id) => get(`/order/${id}`),
  }
}

/** 探测产品属于哪个云模块：先 mf_cloud 后 mf_dcim；都不中返回 null（走 ModuleView 回退） */
export async function detectServerModule(hostId) {
  const candidates = ['mf_cloud', 'mf_dcim']
  for (const m of candidates) {
    try {
      const res = await baseGet(`/${m}/${hostId}`)
      const d = res.data
      if (d && (d.id || d.ip !== undefined || d.data_center)) return { module: m, detail: d }
    } catch (e) {
      // 404/非本模块产品：继续探测
    }
  }
  return null
}
