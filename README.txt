Lover Legend 进口成本与库存系统 — 正式版 V11.6 Stable

V8.7 以 V7.6 Stable 为唯一基础，新增 Sales System 销售库存待处理提醒。

- 只读 Sales V25.6 getSalesInventoryFeed；Sales 不会自动扣 Import 库存。
- 首页持续提示尚未在 Import System 记录为「实际卖出」的对应销售。
- 提示包含主播/Fair、销售日期时间、产品和未处理数量。
- 点击「去修改库存」会跳到产品/进口 修改/编辑并搜索对应产品。
- 只有选择「实际卖出」才会核销提醒；库存修正不会核销。
- Sales 数量增加后只提醒差额；销售删除/取消后停止提醒。
- 核销关系保存在既有 Products.stockAdjustmentsJson 中，不新增 Sheet 栏位。
- V7.6 的备注、Backup/Restore、FIFO、成本、History、同步逻辑全部保留。
