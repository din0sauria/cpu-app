# Fallout 实验报告

## 实验目标

本实验围绕 Fallout（CVE-2018-12126，MSBDS）展开，评估在 Meltdown 相关硬件修复之后，Store Buffer 相关的瞬态转发是否仍能在当前平台形成可观测泄露。

## 攻击机理概述

Fallout 主要利用 Write Transient Forwarding 与 Data Bounce 两类原语：前者尝试让 faulting load 错误接收 Store Buffer 中的陈旧值，后者则用来判断虚拟地址是否存在物理页 backing。攻击成功时，秘密字节会被编码进 probe array，并通过 Flush+Reload 恢复。后端项目中，`demo_user_read`、`demo_data_bounce`、`demo_kaslr_noroot` 构成最短的验证链路，`backend/` 提供面向前端的一键控制接口。

## 实验过程

1. 在 Linux 环境下编译 `make`。
2. 先运行 `taskset 0x1 ./demo_user_read` 验证 WTF 基础原语。
3. 再运行 `taskset 0x1 ./demo_data_bounce` 验证地址 backing 探测。
4. 最后使用 `taskset 0x1 ./demo_kaslr_noroot` 或 root 版本确认 KASLR 探测能力。

## 实测结果

当前环境对应的 i5-1235U 上，观测结果表明原始泄露链路已被显著削弱：

```text
Attempting 20000 random reads...
79 of 20000 reads succeeded.
Success rate: 0.40 %

500 tests were performed.
Rate of hits at a mapped address: 0.00%
Rate of hits at an unmapped address: 0.00%
```

KASLR 扫描也未能在正确 base 附近形成有意义的命中峰值，说明该平台上 Data Bounce 更接近噪声探测而非稳定利用。

## 运行时间

在 WSL 中运行最短 demo `taskset 0x1 ./demo_user_read`，从启动到结束的 wall-clock 耗时约为 1.38 秒。

```text
ELAPSED=1.38
```

## 结论

Fallout 在当前硬件与软件配置下表现为低成功率甚至零命中，说明现代缓解已经显著压制了 Store Buffer 相关瞬态泄露。该实验更适合用来验证防御有效性，而不是作为可重复的数据恢复手段。
