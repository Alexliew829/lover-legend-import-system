Lover Legend 进口成本与库存系统 — 正式版 V5.5 Stable

V5.5 基于 V5.4 Stable，只调整「最低售价」视觉提示：最低售价文字与金额改为红色、金额加粗，方便识别为可长按修改项目。

功能逻辑、库存、成本、FIFO、History、同步与 Google Sheet Schema 全部保持 V5.4 不变。

部署：
1. 如果 V5.4 已经成功执行过 upgradeProductsSchemaV54()，这次不要再运行 Schema 升级函数。
2. 替换 V5.5 Code.gs，Save，Deploy New Version。
3. 上传 V5.5 Frontend。

最低售价：Products.minimumPrice，默认0，显示2位小数；只作为销售底价资料，不参与库存成本计算。
