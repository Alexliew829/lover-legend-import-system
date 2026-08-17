Lover Legend 进口成本与库存系统 — 正式版 V5.4 Stable

V5.4 基于 V5.3 完美运行版，只新增「最低售价」。

重要部署：
1. 先把 V5.4 Code.gs 放进 Apps Script 并 Save。
2. 手动运行 upgradeProductsSchemaV54() 一次。它只会在 Products 最右边追加「最低售价」，现有产品填 0.00，不移动旧栏。
3. 运行 validateDatabaseBaseline()，确认 stock 1132 / inventoryValue 667101.48 / schemaOk true。
4. Deploy New Version。
5. 最后上传 V5.4 Frontend。

最低售价：Products.minimumPrice，默认0，显示2位小数；只影响底价资料，不参与库存成本计算。
Backup/Restore/Excel 均保留最低售价。
