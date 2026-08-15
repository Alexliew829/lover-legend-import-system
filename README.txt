Lover Legend 进口成本与库存系统 — 正式版 V5.2 Stable

设计原则：
1. 同步速度以 V4.20 为基线。
2. 业务功能以 V4.25 为基线。
3. Google Sheet 结构以已确认正确的 Lover Legend Import Cost Database 为唯一标准。
4. 安全优先：旧前端、错 Schema、Revision 冲突不得覆盖正式数据库。

正式数据库 Spreadsheet ID：
1TD3pcl-LrB63xk6q0bjRc6lvheUxKo_OOqmsdlpNWDA

V5.2 重点保护：
- 不自动新增/移动/重命名数据库栏位。
- Products / Imports / Batches / Settings / Logs 必须与 Canonical Schema 完全一致。
- 旧 V4.20/V4.25 前端没有 V5.2 clientVersion + schemaVersion，因此后端会阻止其 Push。
- 新前端即使某对象缺少字段，后端也先与 Sheet 原记录按 ID 合并，避免缺字段被写成空白。
- 日常同步不执行格式化，减少 Apps Script API 调用。
- V5.2 第一次启动固定执行 Full Pull；未完成首次 Pull 前，前端不会建立 dirty 队列，后端也不会接受 Push。
- 首次 Pull 成功后取得 bootstrap token；每次写入必须同时通过 clientVersion、Schema、bootstrap token、Revision 四层检查。

成本逻辑继续沿用 V4.25：库存卖出/修改不应改写原进口成本快照；内地杂费及海外运费比例继续按原有逻辑读取与保存。
