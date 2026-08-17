Lover Legend 进口成本与库存系统 — 正式版 V5.6 Stable

V5.6 以 V5.5 完美运行版为基础，只优化「最低售价」保存同步速度。

最低售价保存：
- 只写入 Products 对应产品的 minimumPrice 和 updatedAt。
- 不再触发完整 Products / Imports / Batches Snapshot Push。
- 保留 Revision 冲突、Bootstrap Token、Schema、Write Guard、LockService 保护。
- 失败/冲突时不会静默覆盖资料。

其他库存、进口、成本、FIFO、History 及原有完整同步逻辑不改变。
Schema：LL-IMPORT-2026-08-CANONICAL-4。
