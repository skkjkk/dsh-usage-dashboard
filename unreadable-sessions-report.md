# 读不到的会话清单（DSH 0.1.5-rc.1，2026/9/11 21:37:10）

## 结论摘要

| 类别 | 数量 | 官方 API 能否读取 |
|---|---|---|
| ✅ 可读（v3 格式产物） | 21 | 能 |
| 🟥 旧版子代理会话（裸 uuid 目录，v0 日志） | 173 | **不能** —— 目录名不符合 `session-<id>` 布局，`findLog` 定位不到 |
| 🟧 普通会话（session-* 目录，v0 日志）被迁移器拒读 | 1 | **不能** —— subagent/descriptor version≠3 |
| 🟨 普通会话（session-* 目录，v0 日志）可迁移 | 147 | 能（首次读取时自动迁移，但每次冷启动都要重新付出迁移解码代价）|

根因：

1. **173 个旧版子代理会话**：v0 时代的子代理日志存放在以裸 `<uuid>` 命名的目录里（现版本布局是 `session-<uuid>/`）。DSH 0.1.5 的 `findLog` 按 `encodeSegment(header.id)` 拼路径，定位不到这些目录 → `SessionPersistenceNotFoundError`。
2. **v0 普通会话**：日志格式版本 0，需经 `dsh-session-format-v0-to-v1` 迁移器。含 `subagent/descriptor` version≠3 事件或清单外事件类型时直接抛 `SessionFormatUnsupportedMigrationError`（源码 1582/1586 行）。

## 旧版子代理会话（放弃读取）（173 个）

这批即你决定直接放弃的部分。

| # | 会话 ID | 所属项目 | 创建日期 | 大小 | 深度 | 拒读原因 |
|---|---|---|---|---|---|---|
| 1 | `169c3a52-3e74-44d4-b02c-7c0436021373` | D:\06-Agentworkspace\DeepSeek-harness | 2026-08-13 | 55 KB | 1 | subagent/descriptor version≠3 |
| 2 | `73639b11-be1b-49df-8489-cd1866b44883` | D:\06-Agentworkspace\DeepSeek-harness | 2026-08-14 | 81 KB | 1 | subagent/descriptor version≠3 |
| 3 | `0cae5416-0868-4cd9-8e0c-02edd695cff7` | D:\06-Agentworkspace\DeepSeek-harness | 2026-08-17 | 172 KB | 1 | subagent/descriptor version≠3 |
| 4 | `6ffe4df7-2db3-46ad-9a8e-2e09ec90a2ca` | D:\06-Agentworkspace\DeepSeek-harness | 2026-08-17 | 138 KB | 1 | subagent/descriptor version≠3 |
| 5 | `8cc92568-62c7-4e40-8e39-2a3e2e5d217f` | D:\06-Agentworkspace\DeepSeek-harness | 2026-08-17 | 188 KB | 1 | subagent/descriptor version≠3 |
| 6 | `72e44c25-3628-4670-8a66-43faee73e34b` | D:\06-Agentworkspace\DeepSeek-harness | 2026-08-18 | 28 KB | 1 | subagent/descriptor version≠3 |
| 7 | `c5b5d7e3-2e1f-4bf5-8864-4a049eebb6a6` | D:\06-Agentworkspace\DeepSeek-harness | 2026-08-18 | 28 KB | 1 | subagent/descriptor version≠3 |
| 8 | `86fd3cdd-3251-45b3-8d85-f4883f86fe8b` | D:\06-Agentworkspace\DeepSeek-harness | 2026-08-20 | 28 KB | 1 | subagent/descriptor version≠3 |
| 9 | `94c5d34e-97ff-43e1-a64e-af92df8662c7` | D:\06-Agentworkspace\DeepSeek-harness | 2026-08-30 | 111 KB | 1 | subagent/descriptor version≠3 |
| 10 | `c0d3ffed-4def-4287-93a6-d14f92a1aa53` | D:\06-Agentworkspace\DeepSeek-harness | 2026-08-30 | 75 KB | 1 | subagent/descriptor version≠3 |
| 11 | `32a00fd6-7689-4cdf-b83f-3ebdcf4a5570` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-04 | 52 KB | 1 | subagent/descriptor version≠3 |
| 12 | `45968aac-dcc0-4470-8567-4c10e0d0c93d` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-04 | 33 KB | 1 | subagent/descriptor version≠3 |
| 13 | `63731dac-2f85-42ac-8af8-bc7e5c6de294` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-04 | 227 KB | 1 | subagent/descriptor version≠3 |
| 14 | `6414ca85-e478-425b-aca5-51fabe2a8826` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-04 | 33 KB | 1 | subagent/descriptor version≠3 |
| 15 | `70594b92-eeef-414b-b252-6b14c7baebb4` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-04 | 33 KB | 1 | subagent/descriptor version≠3 |
| 16 | `72ea73d3-234d-490d-ac8f-ce64934dca0d` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-04 | 130 KB | 1 | subagent/descriptor version≠3 |
| 17 | `8c57dae5-0d36-445e-b3e2-b22a19f1eefd` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-04 | 40 KB | 1 | subagent/descriptor version≠3 |
| 18 | `8c5dfd33-154b-4709-a4d2-b3b73acc9c04` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-04 | 1088 KB | 1 | subagent/descriptor version≠3 |
| 19 | `8da9c624-d7b4-4d28-9005-c2f15ef930c6` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-04 | 34 KB | 1 | subagent/descriptor version≠3 |
| 20 | `f78a0258-8875-4d24-b337-b96424027f49` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-04 | 320 KB | 1 | subagent/descriptor version≠3 |
| 21 | `0e3a4fb4-b1eb-4fc0-a89c-6205cccaeb9a` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-05 | 528 KB | 1 | subagent/descriptor version≠3 |
| 22 | `1921a56c-b692-4d02-ad73-3c03aff78ee7` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-05 | 1543 KB | 1 | subagent/descriptor version≠3 |
| 23 | `200ca8c2-168c-49a2-b878-4dce2d0b1fd4` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-05 | 369 KB | 1 | subagent/descriptor version≠3 |
| 24 | `208f08c5-cd3d-4092-b557-9d1106357add` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-05 | 214 KB | 1 | subagent/descriptor version≠3 |
| 25 | `28da3ce1-fe48-47f0-b796-1b09105d221b` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-05 | 80 KB | 1 | subagent/descriptor version≠3 |
| 26 | `29b23143-f81c-4e81-9eee-c11b28607bc8` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-05 | 94 KB | 1 | subagent/descriptor version≠3 |
| 27 | `39b5c1eb-66c2-4075-bb57-da04272b4b0c` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-05 | 665 KB | 1 | subagent/descriptor version≠3 |
| 28 | `3de35862-d4ec-49b9-a4e6-1675a405392c` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-05 | 1367 KB | 1 | subagent/descriptor version≠3 |
| 29 | `43a47d5e-4f41-41cc-b8ef-5f92a0f632ed` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-05 | 687 KB | 1 | subagent/descriptor version≠3 |
| 30 | `43de7a87-73e7-4ef9-a946-959fdf79fe21` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-05 | 61 KB | 1 | subagent/descriptor version≠3 |
| 31 | `4c247263-ec45-4c44-957e-e02b401ca24e` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-05 | 1888 KB | 1 | subagent/descriptor version≠3 |
| 32 | `503eb96e-ba1d-4b37-8ffa-018848563334` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-05 | 1836 KB | 1 | subagent/descriptor version≠3 |
| 33 | `5695ca33-8ab9-4e67-971c-ee0f852c06b6` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-05 | 931 KB | 1 | subagent/descriptor version≠3 |
| 34 | `642aa085-5239-4957-a5c1-f5c6059852df` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-05 | 231 KB | 1 | subagent/descriptor version≠3 |
| 35 | `6b9112e7-547f-4de8-bad9-8de4d1267775` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-05 | 61 KB | 1 | subagent/descriptor version≠3 |
| 36 | `6e88cc46-ec85-4eef-8c18-c9993a6918b3` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-05 | 124 KB | 1 | subagent/descriptor version≠3 |
| 37 | `9083cf9a-3211-4447-8fe3-f578234a04ad` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-05 | 338 KB | 1 | subagent/descriptor version≠3 |
| 38 | `a17fd2e4-b41a-47e2-92bc-606715d24df2` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-05 | 645 KB | 1 | subagent/descriptor version≠3 |
| 39 | `b1aaaef3-7d28-4761-ada5-86f753e0912e` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-05 | 1813 KB | 1 | subagent/descriptor version≠3 |
| 40 | `b6fef0ca-b8d3-45f3-8636-e915faba0beb` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-05 | 765 KB | 1 | subagent/descriptor version≠3 |
| 41 | `bb90c227-776b-4dd3-b9e1-64d2ec336f78` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-05 | 128 KB | 1 | subagent/descriptor version≠3 |
| 42 | `db68beb9-8d6a-4023-b666-e0ef1e4464a0` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-05 | 1681 KB | 1 | subagent/descriptor version≠3 |
| 43 | `e62648af-76e8-464d-895c-2e1b38c7bf7b` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-05 | 66 KB | 1 | subagent/descriptor version≠3 |
| 44 | `e9c711e3-7c91-47e2-b420-4b1373e7d3db` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-05 | 405 KB | 1 | subagent/descriptor version≠3 |
| 45 | `eb04a01b-9cc6-4847-94fd-9d3dff72c6f6` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-05 | 259 KB | 1 | subagent/descriptor version≠3 |
| 46 | `ef0b2e16-a2df-422a-9eef-f2c8998889f3` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-05 | 178 KB | 1 | subagent/descriptor version≠3 |
| 47 | `ef598cfc-dbe5-47c7-a14b-2efb75ffa59b` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-05 | 235 KB | 1 | subagent/descriptor version≠3 |
| 48 | `efeab922-c97b-4bee-84b8-de33e66e1231` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-05 | 643 KB | 1 | subagent/descriptor version≠3 |
| 49 | `f4b92cbb-aea1-4271-a722-14e745053def` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-05 | 1827 KB | 1 | subagent/descriptor version≠3 |
| 50 | `fe78ab6a-8a55-4fc2-b2f0-b40cda358a4e` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-05 | 100 KB | 1 | subagent/descriptor version≠3 |
| 51 | `ff050f7a-ce1b-4187-ae0a-9faf4dafd682` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-05 | 141 KB | 1 | subagent/descriptor version≠3 |
| 52 | `04cab246-6ec1-4bb3-9056-311e63213400` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-06 | 4220 KB | 3 | subagent/descriptor version≠3 |
| 53 | `0833da44-83af-472b-a0f5-208cb9ca5c4c` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-06 | 4158 KB | 1 | subagent/descriptor version≠3 |
| 54 | `0bb915d6-2ff7-4c58-9938-e1fd4a3d82af` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-06 | 3409 KB | 1 | subagent/descriptor version≠3 |
| 55 | `126c6f05-2ef1-44d8-9fd0-535ef9c993d9` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-06 | 4206 KB | 3 | subagent/descriptor version≠3 |
| 56 | `145a52ad-d557-418f-a3cd-44b3f33729d2` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-06 | 3572 KB | 1 | subagent/descriptor version≠3 |
| 57 | `15a37119-b347-47aa-9076-dde6d3a6add0` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-06 | 251 KB | 1 | subagent/descriptor version≠3 |
| 58 | `18ce63e1-0316-49c0-b58b-b7ff0096f8f4` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-06 | 3472 KB | 1 | subagent/descriptor version≠3 |
| 59 | `2764fcbb-dec0-4f2e-bd8c-e521719a86f6` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-06 | 3496 KB | 1 | subagent/descriptor version≠3 |
| 60 | `27be26c2-a14b-42cb-84b3-dc9b5213adda` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-06 | 4116 KB | 1 | subagent/descriptor version≠3 |
| 61 | `28fd277d-abe4-4b60-9477-73e9347ea56b` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-06 | 56 KB | 1 | subagent/descriptor version≠3 |
| 62 | `31723aa2-582f-4cee-b360-c2248ec1a3ce` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-06 | 3655 KB | 1 | subagent/descriptor version≠3 |
| 63 | `384f3643-4d7f-4e9a-9396-b2770014e947` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-06 | 3420 KB | 1 | subagent/descriptor version≠3 |
| 64 | `3aa738e9-e88a-4f97-afae-258b563a6329` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-06 | 3402 KB | 1 | subagent/descriptor version≠3 |
| 65 | `3daa1fea-18f4-4aaf-b8d2-7e8bce584d6e` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-06 | 4173 KB | 2 | subagent/descriptor version≠3 |
| 66 | `4f34ddde-1897-4855-af09-ce934405e646` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-06 | 4547 KB | 1 | subagent/descriptor version≠3 |
| 67 | `50321ceb-321d-44ac-b935-60527904074b` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-06 | 3877 KB | 1 | subagent/descriptor version≠3 |
| 68 | `52389fdf-0f1e-4105-b364-2baa488b45c3` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-06 | 4288 KB | 1 | subagent/descriptor version≠3 |
| 69 | `5f5c6cd5-2037-49f2-856f-200c394200c1` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-06 | 3541 KB | 1 | subagent/descriptor version≠3 |
| 70 | `68548128-9703-479b-8931-2e7f3dcae4ba` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-06 | 4138 KB | 3 | subagent/descriptor version≠3 |
| 71 | `6b9cdcec-2f4f-43b0-95b7-8a10aa66475d` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-06 | 4120 KB | 2 | subagent/descriptor version≠3 |
| 72 | `7d976c3c-59d7-4c39-abfe-6e75eed0ecb8` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-06 | 3992 KB | 1 | subagent/descriptor version≠3 |
| 73 | `8a67f296-84c3-4b6b-852d-9acf1e91f859` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-06 | 3404 KB | 1 | subagent/descriptor version≠3 |
| 74 | `8f1a986e-2530-4faf-8841-773144bb6307` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-06 | 3601 KB | 1 | subagent/descriptor version≠3 |
| 75 | `9239392e-9fcc-4fd1-961e-94dd38fc894c` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-06 | 4557 KB | 1 | subagent/descriptor version≠3 |
| 76 | `ac191312-cc25-46fd-924e-977a05dc48c1` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-06 | 4422 KB | 1 | subagent/descriptor version≠3 |
| 77 | `b3e25098-004e-4964-b527-0467b5394fe5` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-06 | 4066 KB | 2 | subagent/descriptor version≠3 |
| 78 | `c126830c-7a30-47ad-9ce9-7caf29fb23bb` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-06 | 151 KB | 1 | subagent/descriptor version≠3 |
| 79 | `cb385c8d-6f25-41e6-9a61-baa43a6daaf9` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-06 | 64 KB | 1 | subagent/descriptor version≠3 |
| 80 | `cc9186e5-e133-4f6a-9d6e-7392cbbaf8d3` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-06 | 3470 KB | 1 | subagent/descriptor version≠3 |
| 81 | `fc34d982-19de-4c46-9307-03268b029f6e` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-06 | 3570 KB | 1 | subagent/descriptor version≠3 |
| 82 | `fcb6c3e1-e4f3-4f42-8e2c-03949bbcd772` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-06 | 3584 KB | 1 | subagent/descriptor version≠3 |
| 83 | `fce3dce4-deab-4120-819a-c02ffb0af0d9` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-06 | 4151 KB | 2 | subagent/descriptor version≠3 |
| 84 | `fc49a19d-7d93-4cb6-a188-2b76c67dbb73` | D:\06-Agentworkspace\DeepSeek-harness\dsh-remote-portal | 2026-08-19 | 254 KB | 1 | subagent/descriptor version≠3 |
| 85 | `0b1a9eae-b8ce-4162-ae64-fb1f75390146` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-17 | 562 KB | 1 | subagent/descriptor version≠3 |
| 86 | `1929a173-da6c-4f2e-bef8-482b6fc27b32` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-17 | 136 KB | 1 | subagent/descriptor version≠3 |
| 87 | `24ceaec3-b2bf-436f-984f-9501832978fd` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-17 | 265 KB | 1 | subagent/descriptor version≠3 |
| 88 | `28b5aa1f-c40b-4741-bc64-1c545ef5e772` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-17 | 222 KB | 1 | subagent/descriptor version≠3 |
| 89 | `2ec2e886-cc3f-4f0c-8a15-64686731dada` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-17 | 867 KB | 1 | subagent/descriptor version≠3 |
| 90 | `3d817408-1ac0-4ca6-b21f-b10bbaa80905` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-17 | 1387 KB | 1 | subagent/descriptor version≠3 |
| 91 | `429e346a-6e77-47cc-ba32-f3c7f18dd03d` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-17 | 724 KB | 1 | subagent/descriptor version≠3 |
| 92 | `42ccefaa-8075-4b39-b905-7c815e0b7434` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-17 | 23 KB | 1 | subagent/descriptor version≠3 |
| 93 | `43c5769c-e9a9-4946-909b-9862b77ca39e` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-17 | 729 KB | 1 | subagent/descriptor version≠3 |
| 94 | `525b6af2-e4e0-4253-af82-3f0bb5937d37` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-17 | 395 KB | 1 | subagent/descriptor version≠3 |
| 95 | `791a92b0-5fc8-4f9f-953a-8a2234dd8e7a` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-17 | 472 KB | 1 | subagent/descriptor version≠3 |
| 96 | `7d2bdd66-2c26-4247-a505-4fafd97c941e` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-17 | 1341 KB | 1 | subagent/descriptor version≠3 |
| 97 | `860a4842-3930-4668-9ebf-398b5f1574a0` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-17 | 331 KB | 1 | subagent/descriptor version≠3 |
| 98 | `90645157-c9cb-4cc7-8fc9-315ae35ee7b8` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-17 | 1334 KB | 1 | subagent/descriptor version≠3 |
| 99 | `9850300d-2d80-41f4-a92d-d76198629af0` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-17 | 166 KB | 1 | subagent/descriptor version≠3 |
| 100 | `a1061daf-c036-4aa1-a014-3eaf37b3062c` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-17 | 212 KB | 1 | subagent/descriptor version≠3 |
| 101 | `aec89a06-df10-47f3-a3a2-cbc84fa4ef2d` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-17 | 438 KB | 1 | subagent/descriptor version≠3 |
| 102 | `b1c38f68-6fff-4975-94a8-d8758e4d786c` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-17 | 33 KB | 1 | subagent/descriptor version≠3 |
| 103 | `bc58fe9d-0e28-4df0-9e03-070ea87bb58f` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-17 | 1245 KB | 1 | subagent/descriptor version≠3 |
| 104 | `c41d7416-9260-4cf6-93a1-ada6c5bce9ce` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-17 | 33 KB | 1 | subagent/descriptor version≠3 |
| 105 | `c557175b-6aa8-4d07-94fe-ca13ca490769` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-17 | 138 KB | 1 | subagent/descriptor version≠3 |
| 106 | `c9194fba-af10-4c67-81aa-5422053cecf5` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-17 | 194 KB | 1 | subagent/descriptor version≠3 |
| 107 | `ce14d2d7-d68e-4f8f-a2c8-a872ddc36d31` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-17 | 1341 KB | 1 | subagent/descriptor version≠3 |
| 108 | `d5c62eac-fa0a-4cc3-8c70-5ce11de165db` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-17 | 242 KB | 1 | subagent/descriptor version≠3 |
| 109 | `d7056fe4-5a82-4cf5-ae1b-33f9fb4b8cef` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-17 | 238 KB | 1 | subagent/descriptor version≠3 |
| 110 | `d9eee916-c00f-47c0-bd9c-03367aa6501a` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-17 | 732 KB | 1 | subagent/descriptor version≠3 |
| 111 | `debb6076-3f44-41b7-ae19-882234f9991e` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-17 | 23 KB | 1 | subagent/descriptor version≠3 |
| 112 | `e9f8b077-fc87-4a6c-a368-f60709158695` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-17 | 23 KB | 1 | subagent/descriptor version≠3 |
| 113 | `eeee7858-13f0-4272-b71e-9eace5979a69` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-17 | 23 KB | 1 | subagent/descriptor version≠3 |
| 114 | `f4861440-469c-4dcd-9db7-974f1cd0c866` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-17 | 1284 KB | 1 | subagent/descriptor version≠3 |
| 115 | `e37d5a2e-dfe3-4c61-b6e3-331aa13cbbf3` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-18 | 155 KB | 1 | subagent/descriptor version≠3 |
| 116 | `17a6d54d-c8d8-4a4c-9b11-47e558775300` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-20 | 335 KB | 1 | subagent/descriptor version≠3 |
| 117 | `1e5af871-f959-4575-9af8-9800be6a137c` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-20 | 175 KB | 1 | subagent/descriptor version≠3 |
| 118 | `86e03f6a-657b-4e28-87be-50e1aa977ba3` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-20 | 31 KB | 1 | subagent/descriptor version≠3 |
| 119 | `8acf5f5f-0719-4a67-9122-89da831ed3bf` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-20 | 192 KB | 1 | subagent/descriptor version≠3 |
| 120 | `fe04fc04-21ab-4c07-8a7a-9210b3b01576` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-20 | 31 KB | 1 | subagent/descriptor version≠3 |
| 121 | `5fcced1e-4b25-41c8-a098-04529e2bae78` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-21 | 426 KB | 1 | subagent/descriptor version≠3 |
| 122 | `9b41a438-99ab-45f4-beec-a5e581bd832c` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-21 | 539 KB | 1 | subagent/descriptor version≠3 |
| 123 | `cf3a7321-d52b-4f96-96da-2c6b3df84108` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-21 | 440 KB | 1 | subagent/descriptor version≠3 |
| 124 | `01cddff2-eca6-48ca-b359-0b2cbf97aac0` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-22 | 230 KB | 1 | subagent/descriptor version≠3 |
| 125 | `74c28e6a-dca2-4c1e-96f0-53bf4d77cff6` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-22 | 64 KB | 1 | subagent/descriptor version≠3 |
| 126 | `4f8fd77c-5eba-4ad1-899b-1bb3abeffb6a` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-28 | 745 KB | 1 | subagent/descriptor version≠3 |
| 127 | `63904b5e-f304-4f3d-b276-5020c8dc6772` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-28 | 143 KB | 1 | subagent/descriptor version≠3 |
| 128 | `755f6fc7-4070-4ba6-b81f-a85d058f3817` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-28 | 322 KB | 1 | subagent/descriptor version≠3 |
| 129 | `7ba3597e-5e7b-408a-83b7-6c226eaba591` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-28 | 747 KB | 1 | subagent/descriptor version≠3 |
| 130 | `99f4e355-8ba4-4f46-82c2-8feb5d770d98` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-28 | 1358 KB | 1 | subagent/descriptor version≠3 |
| 131 | `9ae4786b-31c2-4445-934e-1bcc9712a587` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-28 | 1295 KB | 1 | subagent/descriptor version≠3 |
| 132 | `9af133b1-e019-47a8-9f4a-38accb431a22` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-28 | 1476 KB | 1 | subagent/descriptor version≠3 |
| 133 | `c94f51b0-1d5b-42d5-bc41-a737894ecb36` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-28 | 477 KB | 1 | subagent/descriptor version≠3 |
| 134 | `cc350ae4-2763-4fde-b3b0-918a8e7de95c` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-28 | 241 KB | 1 | subagent/descriptor version≠3 |
| 135 | `aff6bbcf-498b-494f-aebf-e6822041cb29` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-29 | 276 KB | 1 | subagent/descriptor version≠3 |
| 136 | `0e6337c3-94f3-41b8-9633-d667c5efb38e` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-09-06 | 1092 KB | 1 | subagent/descriptor version≠3 |
| 137 | `13d9f1d7-8538-4c6c-994a-1c0134ec0025` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-09-06 | 1387 KB | 1 | subagent/descriptor version≠3 |
| 138 | `3f8aa80a-c651-4626-9161-f36da49a9efa` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-09-06 | 1998 KB | 1 | subagent/descriptor version≠3 |
| 139 | `403b820e-22ae-4ad9-8d2e-f7e00991641b` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-09-06 | 1898 KB | 1 | subagent/descriptor version≠3 |
| 140 | `54873eca-f20d-4d0a-8bb0-30560cb0e683` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-09-06 | 1497 KB | 1 | subagent/descriptor version≠3 |
| 141 | `5cfc2dd7-d3a1-42ea-9d62-523049935825` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-09-06 | 339 KB | 1 | subagent/descriptor version≠3 |
| 142 | `60cf3498-9b0a-4fae-a99e-fb87047d0e7c` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-09-06 | 1242 KB | 1 | subagent/descriptor version≠3 |
| 143 | `6c258401-8d30-4973-9685-d6d632b80da2` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-09-06 | 1326 KB | 1 | subagent/descriptor version≠3 |
| 144 | `720900b3-0b27-4366-b785-77b83c75c0a4` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-09-06 | 201 KB | 2 | subagent/descriptor version≠3 |
| 145 | `78280aa1-b19c-4c3a-acca-b61dc2b79a77` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-09-06 | 343 KB | 1 | subagent/descriptor version≠3 |
| 146 | `7d73954a-1f45-483b-8fd8-ce1236eed743` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-09-06 | 529 KB | 1 | subagent/descriptor version≠3 |
| 147 | `7dbff8c3-573c-4da2-9d59-bc5d686ebcc5` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-09-06 | 854 KB | 1 | subagent/descriptor version≠3 |
| 148 | `7efaffa8-85c3-4035-9144-b729af45916c` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-09-06 | 375 KB | 1 | subagent/descriptor version≠3 |
| 149 | `823e85d2-c2e9-4ccf-95d3-295d2b6ceffe` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-09-06 | 1949 KB | 1 | subagent/descriptor version≠3 |
| 150 | `83e6a1cb-f0a0-4689-a609-72c82ec30cf8` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-09-06 | 1891 KB | 1 | subagent/descriptor version≠3 |
| 151 | `9bcb3625-c809-47b2-87c9-3bc70c85d6ff` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-09-06 | 2005 KB | 1 | subagent/descriptor version≠3 |
| 152 | `9c2818aa-1a01-4931-aacb-92a67cc81165` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-09-06 | 570 KB | 1 | subagent/descriptor version≠3 |
| 153 | `bcf006f8-5142-45b5-93a3-09f0e08bd3a7` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-09-06 | 1939 KB | 1 | subagent/descriptor version≠3 |
| 154 | `c0cf42b6-27fd-42c6-9044-183eb80ea765` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-09-06 | 1931 KB | 1 | subagent/descriptor version≠3 |
| 155 | `cab6e937-d429-47b2-8f05-33ec359badb5` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-09-06 | 158 KB | 1 | subagent/descriptor version≠3 |
| 156 | `cb09de1a-82cd-4d1d-be48-0f5269420b81` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-09-06 | 582 KB | 1 | subagent/descriptor version≠3 |
| 157 | `cf1b324e-96f7-4039-91da-cb83d48840c4` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-09-06 | 1968 KB | 1 | subagent/descriptor version≠3 |
| 158 | `da7a229b-626b-4d86-b5b8-f444caec884b` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-09-06 | 359 KB | 1 | subagent/descriptor version≠3 |
| 159 | `e1828158-db4d-4058-b22e-66b899697710` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-09-06 | 619 KB | 1 | subagent/descriptor version≠3 |
| 160 | `e3a338e2-6722-4d44-ae03-b24a5396d3aa` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-09-06 | 1974 KB | 1 | subagent/descriptor version≠3 |
| 161 | `e8c70c47-020b-4722-8449-ed9635abd622` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-09-06 | 2212 KB | 1 | subagent/descriptor version≠3 |
| 162 | `ea18ffe6-09a9-478d-9909-4d852a4b675d` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-09-06 | 312 KB | 1 | subagent/descriptor version≠3 |
| 163 | `4b24ef8d-5ea6-4408-bb38-fc9d84e104d4` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-09-07 | 1946 KB | 1 | subagent/descriptor version≠3 |
| 164 | `c239a3f4-085c-4baf-a32d-c79f3900af02` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-09-07 | 1876 KB | 1 | subagent/descriptor version≠3 |
| 165 | `703f9983-9bbe-408a-ad9c-4ae6f89df144` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-09-10 | 193 KB | 1 | 目录布局不被识别 |
| 166 | `a085273a-4e6d-417f-ad4e-68d52b0cad16` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-09-10 | 58 KB | 1 | 目录布局不被识别 |
| 167 | `cf1fe9f4-2696-4c41-91e0-e2e50a05d5dd` | D:\06-Agentworkspace\ZCode\selection-translator | 2026-08-13 | 135 KB | 1 | subagent/descriptor version≠3 |
| 168 | `d5a6f320-c372-4b9f-87f5-5b8fb2750cdf` | D:\06-Agentworkspace\ZCode\selection-translator | 2026-08-13 | 39 KB | 1 | subagent/descriptor version≠3 |
| 169 | `f6d113ef-6c5b-41a0-82a4-5150e976d584` | D:\06-Agentworkspace\ZCode\selection-translator | 2026-08-13 | 122 KB | 1 | subagent/descriptor version≠3 |
| 170 | `7f6fb0dc-67c7-426a-bbae-ae3252c9bede` | D:\PythonProject\EvoAgent(2) | 2026-09-09 | 299 KB | 1 | 目录布局不被识别 |
| 171 | `89d45b2e-e07f-4408-bc5c-e545c5701b85` | D:\PythonProject\EvoAgent(2) | 2026-09-09 | 174 KB | 1 | 目录布局不被识别 |
| 172 | `9d0762dd-8fd6-497b-8cb2-ef8740ccd2d8` | D:\PythonProject\EvoAgent(2) | 2026-09-09 | 406 KB | 1 | 目录布局不被识别 |
| 173 | `b4dbac26-bb42-46dc-bee7-e77acb8911d3` | D:\PythonProject\EvoAgent(2) | 2026-09-09 | 710 KB | 1 | 目录布局不被识别 |

## 被拒读的普通会话（1 个）

| # | 会话 ID | 所属项目 | 创建日期 | 大小 | 深度 | 拒读原因 |
|---|---|---|---|---|---|---|
| 1 | `session-81dabb13-1d28-4994-ab52-f24fabb9d052` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-04 | 864 KB | 1 | subagent/descriptor version≠3 |

## 可迁移的普通会话（数据没丢）（147 个）

这些是正常的 v0 历史会话，官方 API 首次读取会自动迁移成功，数据可以恢复。

| # | 会话 ID | 所属项目 | 创建日期 | 大小 | 深度 | 拒读原因 |
|---|---|---|---|---|---|---|
| 1 | `session-ebd67325-ae69-4b8e-9705-16d8ee0de114` | D:\01-论文和文献\05-研究生-毕业论文 | 2026-09-02 | 1023 KB | 0 | 目录布局不被识别 |
| 2 | `session-7830ae98-cecc-42aa-a3a4-1346273f390a` | D:\01-论文和文献\05-研究生-毕业论文 | 2026-09-05 | 2003 KB | 0 | 目录布局不被识别 |
| 3 | `session-a895518f-ba77-46ee-8da7-e6625ed7561f` | D:\01-论文和文献\05-研究生-毕业论文 | 2026-09-05 | 507 KB | 0 | 目录布局不被识别 |
| 4 | `session-ae9d60cb-c15e-4cbf-9d7f-d8602dccfb95` | D:\01-论文和文献\05-研究生-毕业论文 | 2026-09-05 | 47 KB | 0 | 目录布局不被识别 |
| 5 | `session-6b1012b3-97fd-4b09-ab1c-691ae9f0610e` | D:\06-Agentworkspace\DeepSeek-harness | 2026-08-13 | 607 KB | 0 | 目录布局不被识别 |
| 6 | `session-bbc104e2-a77f-4db2-a9c4-6fd6d99a2baa` | D:\06-Agentworkspace\DeepSeek-harness | 2026-08-13 | 1067 KB | 0 | 目录布局不被识别 |
| 7 | `session-1261990a-c983-4260-af7c-a0e19ef67a8f` | D:\06-Agentworkspace\DeepSeek-harness | 2026-08-14 | 1116 KB | 0 | 目录布局不被识别 |
| 8 | `session-22329b35-13bd-4ebe-8c73-91cf5ed275ee` | D:\06-Agentworkspace\DeepSeek-harness | 2026-08-14 | 12343 KB | 0 | 目录布局不被识别 |
| 9 | `session-33033e21-48e9-4ba2-b0cb-7f3c75bb1e45` | D:\06-Agentworkspace\DeepSeek-harness | 2026-08-14 | 1995 KB | 0 | 目录布局不被识别 |
| 10 | `session-5eb8c9c7-5641-47fe-a8f4-83f0733329ab` | D:\06-Agentworkspace\DeepSeek-harness | 2026-08-14 | 358 KB | 0 | 目录布局不被识别 |
| 11 | `session-76e249aa-78f7-44d6-88f3-27326a189460` | D:\06-Agentworkspace\DeepSeek-harness | 2026-08-14 | 519 KB | 0 | 目录布局不被识别 |
| 12 | `session-c9fef30a-4e2e-420c-90d0-c1cd24ddb9e1` | D:\06-Agentworkspace\DeepSeek-harness | 2026-08-14 | 868 KB | 0 | 目录布局不被识别 |
| 13 | `session-cbfca71b-2c01-47c8-aeba-31d0c9617771` | D:\06-Agentworkspace\DeepSeek-harness | 2026-08-14 | 1223 KB | 0 | 目录布局不被识别 |
| 14 | `session-d47f0a58-bf7f-4a4a-98ab-dac8e102df10` | D:\06-Agentworkspace\DeepSeek-harness | 2026-08-14 | 57 KB | 0 | 目录布局不被识别 |
| 15 | `session-04faf9b7-d341-4096-bc73-40a4d225a8a8` | D:\06-Agentworkspace\DeepSeek-harness | 2026-08-15 | 679 KB | 0 | 目录布局不被识别 |
| 16 | `session-196958b6-c0aa-4d10-8c12-5c847d6159ae` | D:\06-Agentworkspace\DeepSeek-harness | 2026-08-15 | 10217 KB | 0 | 目录布局不被识别 |
| 17 | `session-6c8eee10-5fa1-450c-952e-51a6f84d5f85` | D:\06-Agentworkspace\DeepSeek-harness | 2026-08-15 | 1611 KB | 0 | 目录布局不被识别 |
| 18 | `session-0c7af4e9-b5df-4540-8487-7d49f850d8d5` | D:\06-Agentworkspace\DeepSeek-harness | 2026-08-16 | 370 KB | 0 | 目录布局不被识别 |
| 19 | `session-44323808-c83b-41a1-9eae-f30f5ad1b631` | D:\06-Agentworkspace\DeepSeek-harness | 2026-08-17 | 475 KB | 0 | 目录布局不被识别 |
| 20 | `session-74e5d2db-ecf9-4644-bf60-1164630f27c3` | D:\06-Agentworkspace\DeepSeek-harness | 2026-08-17 | 21 KB | 0 | 目录布局不被识别 |
| 21 | `session-8a8dcf30-e0e6-474e-9d8d-d841881020b1` | D:\06-Agentworkspace\DeepSeek-harness | 2026-08-17 | 105 KB | 0 | 目录布局不被识别 |
| 22 | `session-9f6680f6-09b4-4e3c-888a-a96b9b4a885e` | D:\06-Agentworkspace\DeepSeek-harness | 2026-08-17 | 76 KB | 0 | 目录布局不被识别 |
| 23 | `session-0c4564bf-0053-4033-bc5d-e7a1101b0b27` | D:\06-Agentworkspace\DeepSeek-harness | 2026-08-18 | 1453 KB | 0 | 目录布局不被识别 |
| 24 | `session-0ff81187-a776-4b70-8bcc-0fe466f01bed` | D:\06-Agentworkspace\DeepSeek-harness | 2026-08-18 | 1612 KB | 0 | 目录布局不被识别 |
| 25 | `session-9cc6b040-650e-40c9-9c0a-6d7a25eded37` | D:\06-Agentworkspace\DeepSeek-harness | 2026-08-18 | 112 KB | 0 | 目录布局不被识别 |
| 26 | `session-18f011d7-80aa-4867-9890-6a586390b0c5` | D:\06-Agentworkspace\DeepSeek-harness | 2026-08-19 | 464 KB | 0 | 目录布局不被识别 |
| 27 | `session-6bcb0aea-ac26-49da-808c-596992354961` | D:\06-Agentworkspace\DeepSeek-harness | 2026-08-19 | 608 KB | 0 | 目录布局不被识别 |
| 28 | `session-6cbddac0-da5b-4f25-91fe-891c59e38595` | D:\06-Agentworkspace\DeepSeek-harness | 2026-08-19 | 130 KB | 0 | 目录布局不被识别 |
| 29 | `session-b9690648-0eb2-4224-a7ff-8255d00300dd` | D:\06-Agentworkspace\DeepSeek-harness | 2026-08-19 | 232 KB | 0 | 目录布局不被识别 |
| 30 | `session-6d0b2095-e369-4a1d-b2c1-4922e39a943a` | D:\06-Agentworkspace\DeepSeek-harness | 2026-08-20 | 491 KB | 0 | 目录布局不被识别 |
| 31 | `session-8e014b6f-ea01-4919-8ea1-fcff9d1f7946` | D:\06-Agentworkspace\DeepSeek-harness | 2026-08-20 | 319 KB | 0 | 目录布局不被识别 |
| 32 | `session-30b064fb-c301-47cd-9cfe-68b0bf17e209` | D:\06-Agentworkspace\DeepSeek-harness | 2026-08-27 | 362 KB | 0 | 目录布局不被识别 |
| 33 | `session-11abc420-73a8-4cb4-8722-99288103e7c6` | D:\06-Agentworkspace\DeepSeek-harness | 2026-08-28 | 217 KB | 0 | 目录布局不被识别 |
| 34 | `session-2ed1dd03-7f21-430b-88aa-8b7085f5d8f2` | D:\06-Agentworkspace\DeepSeek-harness | 2026-08-30 | 77 KB | 0 | 目录布局不被识别 |
| 35 | `session-9eccc0b1-326b-4e6b-b776-14b950981c33` | D:\06-Agentworkspace\DeepSeek-harness | 2026-08-30 | 468 KB | 0 | 目录布局不被识别 |
| 36 | `session-059f20eb-de6c-4f3e-98c9-c97ea7e4d519` | D:\06-Agentworkspace\DeepSeek-harness | 2026-08-31 | 284 KB | 0 | 目录布局不被识别 |
| 37 | `session-13b14a8b-c5ab-42d8-9a89-d8bc6f5dbbb9` | D:\06-Agentworkspace\DeepSeek-harness | 2026-08-31 | 52 KB | 0 | 目录布局不被识别 |
| 38 | `session-15572e37-8e5d-4bc8-b704-1b69093a7e21` | D:\06-Agentworkspace\DeepSeek-harness | 2026-08-31 | 118 KB | 0 | 目录布局不被识别 |
| 39 | `session-80705ccf-0708-4819-84e7-d5cbe2218f8a` | D:\06-Agentworkspace\DeepSeek-harness | 2026-08-31 | 1240 KB | 0 | 目录布局不被识别 |
| 40 | `session-28e025e1-c1b0-440a-9550-40df675fa7bd` | D:\06-Agentworkspace\DeepSeek-harness | 2026-09-03 | 253 KB | 0 | 目录布局不被识别 |
| 41 | `session-a184b4eb-da35-4017-9afe-eaab7d85cdbc` | D:\06-Agentworkspace\DeepSeek-harness | 2026-09-03 | 483 KB | 0 | 目录布局不被识别 |
| 42 | `session-b4a81b92-825e-46f5-afbe-c0c8af6fc033` | D:\06-Agentworkspace\DeepSeek-harness | 2026-09-03 | 949 KB | 0 | 目录布局不被识别 |
| 43 | `session-107b4c51-2d16-41b1-a89d-f7acee1a29ad` | D:\06-Agentworkspace\DeepSeek-harness | 2026-09-04 | 34 KB | 0 | 目录布局不被识别 |
| 44 | `session-a78df895-dc21-4653-bee3-75fe2a52a65c` | D:\06-Agentworkspace\DeepSeek-harness | 2026-09-04 | 235 KB | 0 | 目录布局不被识别 |
| 45 | `session-d439e127-5e12-441e-b15a-662a8dacada8` | D:\06-Agentworkspace\DeepSeek-harness | 2026-09-04 | 176 KB | 0 | 目录布局不被识别 |
| 46 | `session-2c615d6a-f7f2-40f5-8788-e2ef20e12d17` | D:\06-Agentworkspace\DeepSeek-harness | 2026-09-07 | 760 KB | 0 | 目录布局不被识别 |
| 47 | `session-6d47a2e5-c897-4d16-b419-b491e84dbcbb` | D:\06-Agentworkspace\DeepSeek-harness | 2026-09-07 | 75 KB | 0 | 目录布局不被识别 |
| 48 | `session-caff0ddd-2dc2-4cc5-93ca-4339f5482aba` | D:\06-Agentworkspace\DeepSeek-harness | 2026-09-07 | 360 KB | 0 | 目录布局不被识别 |
| 49 | `session-208eb475-aa7c-4a52-9759-8c0e5e012d05` | D:\06-Agentworkspace\DeepSeek-harness | 2026-09-08 | 524 KB | 0 | 目录布局不被识别 |
| 50 | `session-fbb5d0a2-1c57-4eb5-bf70-e283f1467285` | D:\06-Agentworkspace\DeepSeek-harness | 2026-09-08 | 2129 KB | 0 | 目录布局不被识别 |
| 51 | `session-0c952ac0-b9d9-4c13-ab65-b080e8f5c0e5` | D:\06-Agentworkspace\DeepSeek-harness | 2026-09-10 | 115 KB | 0 | 目录布局不被识别 |
| 52 | `session-aed0c4c4-603e-4d19-abcd-9b421b106344` | D:\06-Agentworkspace\DeepSeek-harness | 2026-09-10 | 94 KB | 0 | 目录布局不被识别 |
| 53 | `session-6771964e-9a10-414c-89c8-b3649373b9d6` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-03 | 1132 KB | 0 | 目录布局不被识别 |
| 54 | `session-adb5d5a2-83c1-4986-8092-638762d64a87` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-03 | 1399 KB | 0 | 目录布局不被识别 |
| 55 | `session-c6ef2b77-35ca-40f0-9bc6-d3273f478da7` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-03 | 288 KB | 0 | 目录布局不被识别 |
| 56 | `session-dc1ad735-0ef3-4a76-b543-be107a52ad27` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-03 | 404 KB | 0 | 目录布局不被识别 |
| 57 | `session-e1de8292-bc05-4e97-aa06-11e7d8c46893` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-03 | 1475 KB | 0 | 目录布局不被识别 |
| 58 | `session-f0023277-1e24-4ecb-a922-dd6a2339c657` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-03 | 602 KB | 0 | 目录布局不被识别 |
| 59 | `session-189c750a-6eb6-42c2-9a3a-9e9b40a1a9ad` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-04 | 2538 KB | 0 | 目录布局不被识别 |
| 60 | `session-5b84e56a-f1f2-4394-b51d-b9146f29613f` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-04 | 100 KB | 0 | 目录布局不被识别 |
| 61 | `session-95a2e704-718c-4dee-a362-085013324e3c` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-04 | 6443 KB | 0 | 目录布局不被识别 |
| 62 | `session-224e2762-9eb8-4a2e-a35d-eda1f8779a9f` | D:\06-Agentworkspace\DeepSeek-harness\dsh-browser-agent-sidebar | 2026-09-05 | 8382 KB | 0 | 目录布局不被识别 |
| 63 | `session-e34d9b5c-5495-467d-a4e0-c00abfafb01d` | D:\06-Agentworkspace\DeepSeek-harness\dsh-remote-portal | 2026-08-19 | 1434 KB | 0 | 目录布局不被识别 |
| 64 | `session-a537065f-716a-402d-abed-4f5332bc6fb4` | D:\06-Agentworkspace\DeepSeek-harness\dsh-remote-portal | 2026-08-21 | 435 KB | 0 | 目录布局不被识别 |
| 65 | `session-8abec75b-57d3-475f-b93c-7d29675362e1` | D:\06-Agentworkspace\DeepSeek-harness\dsh-remote-portal | 2026-09-06 | 0 KB | 0 | 目录布局不被识别 |
| 66 | `session-46618d71-7b2b-46c4-ab9d-203490a32bfc` | D:\06-Agentworkspace\DeepSeek-harness\dsh-token-damage | 2026-08-19 | 1147 KB | 0 | 目录布局不被识别 |
| 67 | `session-98402c6d-635c-47ce-b924-906d61f12fac` | D:\06-Agentworkspace\DeepSeek-harness\dsh-token-damage | 2026-08-19 | 294 KB | 0 | 目录布局不被识别 |
| 68 | `session-cd51f1a2-c899-4aa7-b6f4-07a8d8e65a40` | D:\06-Agentworkspace\DeepSeek-harness\dsh-token-damage | 2026-08-20 | 466 KB | 0 | 目录布局不被识别 |
| 69 | `session-f300c3be-2ade-438a-afad-fd401567c24f` | D:\06-Agentworkspace\DeepSeek-harness\dsh-token-damage | 2026-08-20 | 181 KB | 0 | 目录布局不被识别 |
| 70 | `session-5c9312e1-3b15-4e35-991d-2c68fe62212b` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-17 | 2264 KB | 0 | 目录布局不被识别 |
| 71 | `session-8a1a90b1-3aeb-4d0e-9b62-130cfe1287d2` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-17 | 3550 KB | 0 | 目录布局不被识别 |
| 72 | `session-dbef5480-a405-4f22-a235-04a269902617` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-17 | 327 KB | 0 | 目录布局不被识别 |
| 73 | `session-f6621222-2ce1-4c47-9c8a-b6fcd0afee98` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-17 | 130 KB | 0 | 目录布局不被识别 |
| 74 | `session-3bcca4b0-efad-4743-a4ee-febf1f846d82` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-18 | 1020 KB | 0 | 目录布局不被识别 |
| 75 | `session-5841d0a7-9848-48ac-a303-14385721e373` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-18 | 106 KB | 0 | 目录布局不被识别 |
| 76 | `session-dd6e4456-a4ff-453b-9359-fd779aec88a3` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-18 | 329 KB | 0 | 目录布局不被识别 |
| 77 | `session-17452356-4211-41cc-9959-1c4cae6ef17d` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-19 | 438 KB | 0 | 目录布局不被识别 |
| 78 | `session-84755214-f448-43fb-831d-866730fa02d5` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-19 | 253 KB | 0 | 目录布局不被识别 |
| 79 | `session-9c2bebb9-f177-4e17-a474-bfebfa19d8a7` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-19 | 1399 KB | 0 | 目录布局不被识别 |
| 80 | `session-e9d8e650-bed5-48c0-80b9-f861db655d04` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-19 | 1860 KB | 0 | 目录布局不被识别 |
| 81 | `session-30be4fe1-30c1-44fc-bba7-3f015e4c2436` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-20 | 152 KB | 0 | 目录布局不被识别 |
| 82 | `session-33895978-33df-4d50-a6bb-65e600a45397` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-20 | 1660 KB | 0 | 目录布局不被识别 |
| 83 | `session-3ebd270f-9810-4110-988f-955c8e9d0885` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-20 | 1388 KB | 0 | 目录布局不被识别 |
| 84 | `session-484cf6ba-90da-49cc-9d5d-4be73e877408` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-20 | 851 KB | 0 | 目录布局不被识别 |
| 85 | `session-67c64d57-050e-4459-aa98-8f2afa656eb7` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-20 | 1354 KB | 0 | 目录布局不被识别 |
| 86 | `session-ac3dddb3-a594-4719-8799-d0ade3263fc1` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-20 | 151 KB | 0 | 目录布局不被识别 |
| 87 | `session-7ebdfa22-59cd-4c03-8387-8d88a91577c0` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-21 | 2724 KB | 0 | 目录布局不被识别 |
| 88 | `session-a5e86804-310e-4687-b1ea-3154e76a5539` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-21 | 1602 KB | 0 | 目录布局不被识别 |
| 89 | `session-147f1ad2-1ea5-4a89-94a2-bb90548cdac2` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-27 | 1313 KB | 0 | 目录布局不被识别 |
| 90 | `session-421a3ec7-4455-4c2a-85ae-6d0261b0d31a` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-28 | 2779 KB | 0 | 目录布局不被识别 |
| 91 | `session-299f42f3-4de9-4e52-ac40-18c538a15cc5` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-29 | 5460 KB | 0 | 目录布局不被识别 |
| 92 | `session-614f0967-309a-4c41-9501-8915e8f161bb` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-29 | 1479 KB | 0 | 目录布局不被识别 |
| 93 | `session-250bb04a-5015-48b9-9ce6-723a79d90b05` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-30 | 2853 KB | 0 | 目录布局不被识别 |
| 94 | `session-9f5e9647-3785-45ad-b2ab-1320499b19fd` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-08-31 | 1206 KB | 0 | 目录布局不被识别 |
| 95 | `session-43429282-86fe-48b4-b760-a1727b615038` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-09-01 | 4400 KB | 0 | 目录布局不被识别 |
| 96 | `session-ce6ddaa4-f620-43fb-aeaf-0a8697fce885` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-09-01 | 1101 KB | 0 | 目录布局不被识别 |
| 97 | `session-e9ea84ef-cbbf-4e13-ad14-1fe60cc4af05` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-09-01 | 478 KB | 0 | 目录布局不被识别 |
| 98 | `session-f1fb959c-6c73-403f-92c0-3c63de4f46c7` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-09-01 | 454 KB | 0 | 目录布局不被识别 |
| 99 | `session-b4e2ebed-77ac-4342-9299-8cd07b1ecbd6` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-09-02 | 1468 KB | 0 | 目录布局不被识别 |
| 100 | `session-4c00eb1b-4252-4dda-95e4-ccf937ade2c9` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-09-06 | 1547 KB | 0 | 目录布局不被识别 |
| 101 | `session-e62557f2-c00e-43d0-958e-8e90186fd463` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-09-06 | 5031 KB | 0 | 目录布局不被识别 |
| 102 | `session-18027ca1-0b8f-48b7-b172-1bb50e9d2210` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-09-07 | 471 KB | 0 | 目录布局不被识别 |
| 103 | `session-42ea410f-074a-48f4-8f08-3d0932431ba6` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-09-07 | 226 KB | 0 | 目录布局不被识别 |
| 104 | `session-6be1dd8c-715e-4c70-b14f-ccb86af06df1` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-09-07 | 936 KB | 0 | 目录布局不被识别 |
| 105 | `session-91743dde-b547-44d4-a5bc-107d5546609f` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-09-07 | 1672 KB | 0 | 目录布局不被识别 |
| 106 | `session-ab4bf6d9-2166-44b7-a48e-509aee3edd4d` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-09-07 | 1328 KB | 0 | 目录布局不被识别 |
| 107 | `session-ad95169f-a783-4560-a8af-27880692ae6b` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-09-07 | 1579 KB | 0 | 目录布局不被识别 |
| 108 | `session-8e079afc-6ea8-4ce3-98cf-56841344e36c` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-09-08 | 2817 KB | 0 | 目录布局不被识别 |
| 109 | `session-ad461a8c-7cd0-45d7-9dbf-225b83da363d` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-09-08 | 1 KB | 0 | 目录布局不被识别 |
| 110 | `session-ee37f7cd-fc99-4e90-9883-b8d26f46a5e3` | D:\06-Agentworkspace\DeepSeek-harness\dsh-usage-dashboard | 2026-09-08 | 1568 KB | 0 | 目录布局不被识别 |
| 111 | `session-27a6aa9a-78bc-4a35-afa1-840ffb5beadb` | D:\06-Agentworkspace\DeepSeek-harness\dsh-web-ui | 2026-08-19 | 1127 KB | 0 | 目录布局不被识别 |
| 112 | `session-ea9c1011-f11e-4c84-8027-7a9f116e9dca` | D:\06-Agentworkspace\DeepSeek-harness\dsh-web-ui | 2026-08-19 | 0 KB | 0 | 目录布局不被识别 |
| 113 | `session-0f374028-4ddd-4584-b50b-229c841dc22f` | D:\06-Agentworkspace\DeepSeek-harness\leetcode-hot-100 | 2026-08-30 | 486 KB | 0 | 目录布局不被识别 |
| 114 | `session-fff56c62-64c8-4c7d-98ff-cc68fed6dec1` | D:\06-Agentworkspace\DeepSeek-harness\leetcode-hot-100 | 2026-08-30 | 447 KB | 0 | 目录布局不被识别 |
| 115 | `session-47bfac96-ea50-4ff2-8848-a5eecb17ef2e` | D:\06-Agentworkspace\DeepSeek-harness\leetcode-hot-100 | 2026-08-31 | 167 KB | 0 | 目录布局不被识别 |
| 116 | `session-65a521e3-9ee4-4ad3-94ff-8002ed4c906a` | D:\06-Agentworkspace\DeepSeek-harness\leetcode-hot-100 | 2026-08-31 | 385 KB | 0 | 目录布局不被识别 |
| 117 | `session-731abc77-29f7-4e3a-9a21-2ce149d271f3` | D:\06-Agentworkspace\DeepSeek-harness\leetcode-hot-100 | 2026-08-31 | 244 KB | 0 | 目录布局不被识别 |
| 118 | `session-be117f4c-9f5e-41c7-ace5-ec9104c08e17` | D:\06-Agentworkspace\DeepSeek-harness\leetcode-hot-100 | 2026-08-31 | 151 KB | 0 | 目录布局不被识别 |
| 119 | `session-781255e3-d689-4a68-a73e-ab5e89d343c1` | D:\06-Agentworkspace\DeepSeek-harness\leetcode-hot-100 | 2026-09-01 | 398 KB | 0 | 目录布局不被识别 |
| 120 | `session-adeead88-5828-415b-a4dc-25dc8bacd093` | D:\06-Agentworkspace\DeepSeek-harness\leetcode-hot-100 | 2026-09-01 | 245 KB | 0 | 目录布局不被识别 |
| 121 | `session-fbbda49e-621f-4d0a-9f2e-5e9d7560f501` | D:\06-Agentworkspace\DeepSeek-harness\leetcode-hot-100 | 2026-09-02 | 194 KB | 0 | 目录布局不被识别 |
| 122 | `session-9e6b2c32-0125-4529-b5ef-eedad085fcb6` | D:\06-Agentworkspace\DeepSeek-harness\leetcode-hot-100 | 2026-09-03 | 462 KB | 0 | 目录布局不被识别 |
| 123 | `session-f2be586b-3c3d-4ea1-8781-83f68bc71899` | D:\06-Agentworkspace\DeepSeek-harness\leetcode-hot-100 | 2026-09-04 | 98 KB | 0 | 目录布局不被识别 |
| 124 | `session-b6c01d10-ed6f-453a-852e-e50c074a6afa` | D:\06-Agentworkspace\DeepSeek-harness\leetcode-hot-100 | 2026-09-07 | 128 KB | 0 | 目录布局不被识别 |
| 125 | `session-d1e5ac04-5637-4d7d-9536-45c189e5a000` | D:\06-Agentworkspace\DeepSeek-harness\leetcode-hot-100 | 2026-09-09 | 414 KB | 0 | 目录布局不被识别 |
| 126 | `session-ebfaceee-2d81-4183-9d98-9f08b6158b4b` | D:\06-Agentworkspace\DeepSeek-harness\leetcode-hot-100 | 2026-09-09 | 1143 KB | 0 | 目录布局不被识别 |
| 127 | `session-879caf96-9a63-45ea-87c7-53c7d5a3afb1` | D:\06-Agentworkspace\DeepSeek-harness\patent | 2026-09-08 | 1014 KB | 0 | 目录布局不被识别 |
| 128 | `session-88f23f81-d886-4bd7-ac1a-2d8a772acec9` | D:\06-Agentworkspace\DeepSeek-harness\patent | 2026-09-08 | 2202 KB | 0 | 目录布局不被识别 |
| 129 | `session-96966019-efd8-4077-a802-96f27fc441c7` | D:\06-Agentworkspace\DeepSeek-harness\patent | 2026-09-08 | 75 KB | 0 | 目录布局不被识别 |
| 130 | `session-a3336f80-4968-469e-b690-0ec4583e4be9` | D:\06-Agentworkspace\DeepSeek-harness\patent | 2026-09-08 | 652 KB | 0 | 目录布局不被识别 |
| 131 | `session-1d4a58aa-cd54-4535-99e7-9cbe93d622f4` | D:\06-Agentworkspace\Reasonix\resume | 2026-08-24 | 1703 KB | 0 | 目录布局不被识别 |
| 132 | `session-5c99d2b5-4a8f-446c-aa9a-c6817bb9f811` | D:\06-Agentworkspace\ZCode\selection-translator | 2026-08-13 | 398 KB | 0 | 目录布局不被识别 |
| 133 | `session-71745226-0306-497b-b780-f6858efa5a06` | D:\06-Agentworkspace\ZCode\selection-translator | 2026-08-13 | 202 KB | 0 | 目录布局不被识别 |
| 134 | `session-9408d9b8-48ce-41a2-a941-3a1d458a74c3` | D:\06-Agentworkspace\ZCode\selection-translator | 2026-08-13 | 43 KB | 0 | 目录布局不被识别 |
| 135 | `session-73219e4f-c9a4-4aba-bcac-5a7fd30f8af3` | D:\06-Agentworkspace\ZCode\selection-translator | 2026-09-08 | 87 KB | 0 | 目录布局不被识别 |
| 136 | `session-aded5f19-90e0-4d90-afbb-4564ec21bc85` | D:\PythonProject\EvoAgent(2) | 2026-08-26 | 3539 KB | 0 | 目录布局不被识别 |
| 137 | `session-58e32a43-6751-4a87-81f9-8056bc47811f` | D:\PythonProject\EvoAgent(2) | 2026-08-28 | 673 KB | 0 | 目录布局不被识别 |
| 138 | `session-1032b020-0ce3-4140-adfd-166d173be771` | D:\PythonProject\EvoAgent(2) | 2026-08-31 | 449 KB | 0 | 目录布局不被识别 |
| 139 | `session-2e9cef5b-1ebf-4c57-99db-b00ce90d8723` | D:\PythonProject\EvoAgent(2) | 2026-08-31 | 789 KB | 0 | 目录布局不被识别 |
| 140 | `session-514a734d-3c80-4fc3-8a10-c5901cfc1f34` | D:\PythonProject\EvoAgent(2) | 2026-08-31 | 518 KB | 0 | 目录布局不被识别 |
| 141 | `session-8a02c5ef-d6da-400b-a80b-4062cf2221fc` | D:\PythonProject\EvoAgent(2) | 2026-08-31 | 636 KB | 0 | 目录布局不被识别 |
| 142 | `session-0a76bbf1-c5b9-4338-8570-e938aa147eb6` | D:\PythonProject\EvoAgent(2) | 2026-09-01 | 263 KB | 0 | 目录布局不被识别 |
| 143 | `session-9c18d16f-dd69-4526-884c-ebd1cbe0d520` | D:\PythonProject\EvoAgent(2) | 2026-09-01 | 987 KB | 0 | 目录布局不被识别 |
| 144 | `session-62550c90-382a-4eb7-8a0e-9d2506d0402a` | D:\PythonProject\EvoAgent(2) | 2026-09-02 | 1332 KB | 0 | 目录布局不被识别 |
| 145 | `session-a019d559-5079-485a-95dd-364649cc9e6a` | D:\PythonProject\EvoAgent(2) | 2026-09-02 | 509 KB | 0 | 目录布局不被识别 |
| 146 | `session-f7ec7db6-7f66-4e84-a6b7-8c2ba99967fc` | D:\PythonProject\EvoAgent(2) | 2026-09-04 | 213 KB | 0 | 目录布局不被识别 |
| 147 | `session-253ee7ec-ad25-4917-9b76-1a5af2137feb` | D:\PythonProject\EvoAgent(2) | 2026-09-06 | 229 KB | 0 | 目录布局不被识别 |
