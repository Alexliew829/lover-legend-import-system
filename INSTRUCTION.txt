Lover Legend 进口成本与库存系统 — 正式版 V5.7 Stable

V5.7 以 V5.6 完美运行版为唯一基准，只新增库存卡片「原成本」显示。

原成本显示规则：
- 放在「当前库存」旁边。
- 显示该产品当前仍有库存的最新进口批次原单价。
- 保留原币种 CNY / VND / NTD / IDR，不转换成 RM。
- 多批进口时优先对应卡片上最新仍有库存的进口编号。
- 仅显示既有 Imports.unitPrice / currency，不新增库存字段，不改变任何成本计算。

V5.6 的最低售价快速同步、库存、进口、成本、FIFO、History 与完整同步逻辑全部保留。
Schema：LL-IMPORT-2026-08-CANONICAL-4，不变。
