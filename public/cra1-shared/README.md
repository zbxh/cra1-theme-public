# CRA1 三端共用组件

官网、会员中心和购物车使用同一份基础组件。三个主题仍分别保存内容、外观及自定义 CSS / JS。

## 维护位置

- `src/request.js`：V10 请求、当前登录凭据、语言、上传、超时、取消和错误契约。
- `src/ui.js`：账户及客服下拉、焦点管理、HTTP/HTTPS 复制、提示消息和基础图标。
- `src/avatar.js`：三端使用的同一套确定性头像。
- `src/header-search.js`：搜索数据、结果渲染、中文输入、键盘操作和请求取消。
- `src/nav-auth.css`：三端导航“登录 / 注册”按钮，官网同款深色渐变与悬停彩色柔光，统一 32px 高度。
- `src/components.css`：按钮、输入框、选择框、文本域、卡片和消息样式。
- `src/header-search.css`、`src/user-panel.css`、`src/header-support.css`：共用顶部组件样式。
- `src/v10-axios.js`：保留 V10 插件的 Axios 返回格式、权限、操作密码及 iframe 兼容。
- `src/context.js`：识别当前主题，供共用样式使用。
- `src/business-icons.js`、`src/business-icons.css`：业务图标配色、标准渐隐柔边与深色卡片适配；使用已有 DOM 观察机制，不新增动画、轮询或请求。
- `src/motion.js`、`src/motion.css`：一次性页面入场、40ms分步节奏、交互反馈及面板过渡；复用已有DOM观察器，数据刷新不重播，隐藏标签与减少动效时停止。
- `src/ambient.js`：首页浅色雾背景的可见性、标签页和减少动效暂停控制，无逐帧脚本。

源文件是唯一维护位置。当前已交付测试版为 `20261020-cra1-beta-v1`；实际加载版本由 `cra1-theme/release.json` 及私有发行指针选择，不以此处文字作为版本开关。旧资源保留用于回退和已打开的页面。源码中的后续修订须经新的暂存构建与发行流程才会进入运行版本。

视觉基准固定为官网 `component-preview.html` 的 `20261010-preview-v10` 版本。`src/tokens.css` 维护钛灰银与香槟金令牌，`src/aliases.json` 登记旧官网及 Element 组件的对应类，`src/styles.js` 在初次加载和动态渲染时补充 `cui-*` 类；旧类、原有 DOM、组件实现和业务事件保留。已有 React/Alpine 共用组件的变体不由适配器重写。`src/adapters.css` 处理第三方控件与挂在 body 的浮层。`theme-sources/` 只维护三个主题的布局样式，不复制组件外观规则。

## 已接入的页面

| 组件 | 官网 | 会员中心 | 购物车 |
| --- | --- | --- | --- |
| 搜索界面、结果及键盘操作 | 官网页头 | 共用 topMenu | 共用 topMenu |
| 头像和账户下拉交互 | Alpine 适配 | Vue 适配 | 复用 Vue 适配 |
| 客服下拉 | 官网现有客服入口 | 基础组件可复用 | 基础组件可复用 |
| 按钮、输入控件 | 官网按钮及表单 | React、Element、登录提交 | Element、商品选配及购买按钮 |
| 卡片 | 普通及重点营销卡片 | React Card、信息及统计卡 | 商品卡、选配及价格面板 |
| 提示消息 | 共用事件可调用 | React useToast 接入 | 共用事件可调用 |
| 复制 | 客服账号 | 面板登录信息、安全信息 | 共用方法可调用 |
| 请求契约 | API 返回 data | React 返回完整业务响应；Vue 保留 Axios 响应 | Axios 适配 |

菜单树、商品选配、支付和服务器操作继续通过原业务组件及系统插件执行。
React 的 Radix 弹窗和 Vue 的 Element 弹窗保留各自的框架实现。

## 使用方式

```js
const search = CRA1Shared.HeaderSearch.mount(element, {
  context: 'website',
  includeHosts: false,
  copy: { placeholder: '搜索产品、新闻、公告、文档' },
});
// 在组件销毁时调用，清理定时器、未完成请求及事件监听。
search.destroy();

const result = await CRA1Shared.Request.request('/product', {
  params: { page: 1, limit: 6 },
  unauthorized: 'ignore',
});
const copied = await CRA1Shared.UI.copy('客服账号');
CRA1Shared.UI.toast(copied ? '已复制' : '复制失败，请手动复制', copied ? 'success' : 'error');
```

Vue/Alpine 使用 `CRA1Shared.UI.createPopover` 维护开合、外部点击、Esc、方向键和焦点；
通过 `onOpenChange` 同步本框架的状态，`manageVisibility: false` 让框架继续控制显示。
账户菜单启用 `hover: true`，鼠标悬停展开、移出 160ms 后收起；触屏保留点击，键盘保留 ArrowDown / Esc 和焦点管理。搜索与客服入口共用尺寸与悬停表面，Esc 收起按钮没有悬停底色。
同组下拉互斥，销毁时调用 `destroy()`。

旧组件适配通过文档上的 `data-cra1-theme` 限定于 酷锐A1主题，默认主题和插件源码不改动。`cui-*` 是保留的共用组件接口。三个主题仍保留自己的布局和自定义 CSS / JS，字体和控件均使用 px，避免 V10 根字号机制放大组件。官网与会员旧变量按语义映射，辅助文字色和浅色背景分别处理。

普通卡片使用较轻的银灰阴影和淡金色光晕；明确标记的重点卡片使用较轻的香槟金柔光。辅助文字、状态文案及模块说明使用配套深浅颜色，避免系统异步配色覆盖主题语义色。首页轮播雾背景只动画四层渐变的 transform / opacity，离屏、隐藏标签或减少动效时停止。 强调型文字铭牌（`cui-badge--accent`）使用煤黑到暗金的静态渐变；成功、警告、错误和中性状态标签保持语义色。卡片悬停没有位移，鼠标、键盘、触屏及减少动效状态均独立适配。导航“登录 / 注册”按钮由 `src/nav-auth.css` 统一为官网深色渐变、悬停彩色柔光和白色文字，桌面及手机高度均为 32px；登录表单提交和普通业务按钮仍使用正常控件尺寸。

## 构建及验证

使用站点唯一发行入口，显式指定站外的新暂存目录：

```bash
CRA1_RELEASE_STAGE=/path/to/new-stage \
CRA1_RELEASE_ID=new-release-name \
CRA1_RELEASE_CHANNEL=test node cra1-theme/scripts/build.mjs
```

构建只生成新的不可变 release，拒绝覆盖已有 release，不再重写旧兼容地址。构建开发依赖为 PostCSS，未新增运行时 UI 或动画库。官网 Tailwind 构建需指定 `CRA1_WEB_OUT_DIR`；会员 Vite 构建需指定 `CRA1_MEMBER_OUT_DIR`，均输出到隔离暂存目录。

更新共用源码后必须使用新的 release 名称。统一发行清单与生效指针选择官网、会员、购物车、系统会员首页及后台资源，先发布完整资源并核对 HTTP 校验值，再提交指针；保留旧 CSS 和旧 chunk。完整构建与验收命令见 `cra1-theme/docs/开发与构建.md`，安装和回退见 `cra1-theme/docs/安装更新与回退.md`。

图标柔边使用与轮播相同的双向渐隐蒙版，只作用于底色；图案和原始图片保持清晰。标准柔边宽 7px，静态柔光扩展 5px；无模糊滤镜、逐帧脚本或额外请求。当前验收范围见 `cra1-theme/docs/发行支持矩阵.md`，历史设计记录不作为本发行包依赖。主要页面按 1920、1440、768、390px 验证，业务写入使用隔离测试；正式配置及公开快照不作为测试写入目标。

共用层自有代码适用 `cra1-theme/LICENSE.txt`，免费商用门槛和授权规则见 `cra1-theme/docs/商业授权.md`；第三方依赖和图标保留各自许可。

## 回退

使用交付记录中的源码及会员资源备份恢复引用方；已打开页面可能仍引用新组件包，因此保留新包及旧 chunk。
本次未修改配置结构，无需回退三个配置域的数据或公开快照。

账户菜单“控制台”按钮恢复为原五层彩色雾状渐变及9秒流动动画；减少动效时显示静态彩色。记录见 `docs/theme-style/console-color-20261011.md`。

统一动效记录见 `docs/theme-style/theme-motion-20261011.md`。首屏内容使用250ms淡入与至多8px垂直偏移、40ms交错（最多六块）；会员标签页与展开内容180ms，弹窗与抽屉200ms。操作或键盘聚焦会立即结束所在内容块的入场，减少动效时直接显示。现有官网滚动入场与轮播由原组件继续管理。
