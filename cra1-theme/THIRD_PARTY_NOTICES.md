# 第三方内容与发行边界

自有代码采用 `LICENSE.txt`；第三方原有版权与许可不变。商业发行前必须通过 `licenses/dependency-inventory.json` 及候选包中的 `docs/asset-inventory.json` 的逐项门禁，不能以本文件替代缺失的再分发授权。

- React、React DOM：MIT；Lucide：ISC；Radix UI：MIT；Tailwind CSS、daisyUI：MIT；Vite：MIT。具体版本和原文由锁文件及 `scripts/inventory.py` 导出。
- Lightning CSS：MPL-2.0；caniuse-lite 数据：CC-BY-4.0。按实际分发内容分别保留许可，不能将工具依赖的许可扩展到全部主题。
- QRCode 实现：保留源码内 MIT 声明，见后台源码 `src/vendor/qrcode.mjs`。
- V10/default、官方模块与商业插件不在本许可证范围内。发行包不得包含其源文件；运行时复用的原生组件须登记依赖并针对用户合法安装环境验证。
- Font Awesome、Simple Icons、其他图标集和商标分别核实版本与许可。未完成溯源的素材不能认定可再分发。
- 已匹配上游图形数据的 1,910 份图标及派生文件，登记在 `docs/asset-rights.json`；固定包完整性、来源及许可原文校验值见 `docs/icon-source-evidence.json`，原文和作者署名见 `licenses/icons/ATTRIBUTION.md`。这只覆盖登记文件，不延伸到其他素材，也不授予商标使用或品牌背书权。
- 本站横幅、产品图、方案图、参考图和其他用户媒体不因存在于主题目录就成为可发行素材。未能核实来源的资产须替换或取得凭证。

当前状态是待门禁验收的候选工程。未核实的第三方及素材记录保留为发行阻断项。
