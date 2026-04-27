# Fallout 实验报告

## 实验目标

本实验围绕 Fallout（CVE-2018-12126，MSBDS）展开，评估在 Meltdown 相关硬件修复之后，Store Buffer 相关的瞬态转发是否仍能在当前平台形成可观测泄露。

## 攻击机理概述

Fallout 主要利用 Write Transient Forwarding 与 Data Bounce 两类原语：前者尝试让 faulting load 错误接收 Store Buffer 中的陈旧值，后者则用来判断虚拟地址是否存在物理页 backing。攻击成功时，秘密字节会被编码进 probe array，并通过 Flush+Reload 恢复。后端项目中，`demo_user_read`、`demo_data_bounce`、`demo_kaslr_noroot` 构成最短的验证链路，`backend/` 提供面向前端的一键控制接口。本项目具体说明

Fallout (CVE-2018-12126, Microarchitectural Store Buffer Data Sampling) 展示了在 Meltdown 已硬件修复的现代 Intel CPU 上，微架构资源（Store Buffer）隔离不完全所带来的安全风险。本项目基于社区 PoC（https://github.com/tristan-hornetz/fallout）复现了论文《Fallout: Leaking Data on Meltdown-resistant CPUs》（CCS 2019）中的核心攻击原语。

通过 Write Transient Forwarding (WTF) 和 Store-to-Leak（Data Bounce）技术，在受害者系统中尝试实现：

- 用户态读取内核最近写入的数据（WTF）
- 检测虚拟地址是否被物理页 backing（Data Bounce）
- 打破 KASLR（Kernel Address Space Layout Randomization）

## 涉及资源

- **Store Buffer（存储缓冲区）**
  
  - **位置**：CPU 内部微架构资源（最多 56 个 entries）
  - **功能**：加速 store 操作，隐藏写内存延迟
  - **利用**：WTF shortcut 导致 load fault 时仍会瞬态转发 store 数据；Store-to-Leak 利用缺少权限检查实现地址映射探测。
- **TLB（Translation Lookaside Buffer）**
  
  - **位置**：CPU 地址转换缓存（dTLB / iTLB）
  - **功能**：加速虚拟→物理地址转换
  - **利用**：Fetch+Bounce 通过 Data Bounce 成功率区分 TLB hit/miss，泄露最近使用的内核页。
- **Cache（CPU L3 Cache）**
  
  - **位置**：共享的 Last-Level Cache
  - **功能**：作为 Covert Channel
  - **利用**：Flush+Reload 侧信道，将 transient execution 的微架构状态（转发的值）编码到 cache 中。
- **Reload Buffer**
  
  - **位置**：攻击者控制的用户态内存页
  - **功能**：作为泄露数据的接收缓冲区
  - **利用**：transient load 访问对应索引页面，攻击者通过 Flush+Reload 恢复 Secret。

## 攻击原理

Fallout攻击的核心在于利用Intel CPU微架构中**Store Buffer**的两个设计缺陷：Write Transient Forwarding (WTF) 和 Store-to-Leak（Data Bounce）。即使在Meltdown已被硬件修复的CPU上，Store Buffer仍然会错误地将最近的store数据转发给后续的faulting load，从而导致跨安全域的信息泄露。

**核心攻击流程：**

1. 受害者（内核或用户进程）执行内存写操作（store），数据被临时存放在Store Buffer中。
2. 攻击者在用户态构造一个会触发异常的load指令（例如访问non-canonical地址或使用SMAP保护的页面）。
3. CPU在处理这个faulting load时，错误地执行了store-to-load forwarding，将Store Buffer中的数据瞬态转发给load指令。
4. 虽然该load最终因异常被丢弃（transient execution），但在执行过程中会将转发的Secret值作为索引访问一个probe array，从而将Secret编码进CPU缓存。
5. 攻击者使用Flush+Reload侧信道遍历probe array，通过访问时间差异恢复Secret值。
6. 基于上述机制，进一步衍生出Data Bounce原语，用于探测虚拟地址是否被物理内存 backing，从而实现KASLR破解。

**时间差异产生原理**：

1. **注入**：内核或用户进程执行 victim_page[offset] = secret; 操作，将秘密数据放入Store Buffer。
2. **瞬态转发**：攻击者构造一个会导致异常的load指令（如 value = attacker_address[offset];），CPU因WTF shortcut错误地将Store Buffer中的secret值转发给该load。
3. **编码**：在transient execution阶段，代码执行 memory_access(lut + value * 4096);，将secret对应的页面加载到L3缓存中。
4. **解码**：攻击者随后遍历整个lut数组并测量每个页面的访问时间。
  - **快 (Cache Hit)**：只有secret对应的页面访问时间极短（通常 < 100 cycles）。
  - **慢 (Cache Miss)**：其他页面需要从内存加载，访问时间较长。
  - **结论**：访问时间最快的那一页的索引值，就是从Store Buffer中泄露的Secret字节。

**Data Bounce 原语**：
攻击者进行transient store后立即进行load同一虚拟地址。如果store-to-load forwarding成功且值正确返回，则说明该虚拟地址存在对应的物理页 backing。该原语可用于高效探测内核地址空间布局，从而打破KASLR。

## 项目核心代码文件

[tristan-hornetz/fallout: Fallout (MSBDS) Proof-of-Concept](https://github.com/tristan-hornetz/fallout/tree/main)

- **`demos/demo_user_read`**：WTF Toy Example
- **`demos/demo_data_bounce`**：Data Bounce 原语测试
- **`demos/kaslr_noroot.c`**：KASLR 破解主逻辑（使用 Data Bounce 扫描 kernel base）
- **`primitives/`**：核心汇编原语（WTF forwarding 和 Data Bounce 实现）

## 实验过程

1. 在 Linux 环境下编译 `make`。
2. 先运行 `taskset 0x1 ./demo_user_read` 验证 WTF 基础原语。
3. 再运行 `taskset 0x1 ./demo_data_bounce` 验证地址 backing 探测。
4. 最后使用 `taskset 0x1 ./demo_kaslr_noroot` 或 root 版本确认 KASLR 探测能力。

## 实测结果

当前环境对应的 i5-1235U 上，观测结果表明原始泄露链路已被显著削弱：
# Demo 1: Write Transient Forwarding
Attempting 20000 random reads...
79 of 20000 reads succeeded.
Success rate: 0.40 %          ← 远低于论文 90%，系统已缓解

# Demo 3: Data bounce
500 tests were performed.
    * Rate of hits at a mapped address (true positives): 0.00%
    * Rate of hits at an unmapped address (false positives): 0.00%   ← 完全失效
500 次测试中，映射地址的真阳性率（true positives）和非映射地址的假阳性率（false positives）均为 0.00%，完全无法区分有效与无效地址。

# Demo 4: Breaking KASLR
From reading /proc/kallsyms, we determined that the base address of your kernel's .text section is 0xffffffff85000000.
...
There was no significant increase in data bounce hits near the correct base address, so KASLR was not broken.
Note that this method can be unreliable at times, so restarting the demo might yield different results.
扫描整个 kernel 地址空间后，未在正确 base 地址附近观察到任何显著的 Data Bounce 命中，最终得出“KASLR was not broken”的结论。

## 运行时间

在 WSL 中运行 demo `taskset 0x1 ./demo_user_read`，从启动到结束的 wall-clock 耗时约为 1.38 秒。

```text
ELAPSED=1.38
```

## 结论

Fallout 在当前硬件与软件配置下表现为低成功率甚至零命中，说明现代缓解已经显著压制了 Store Buffer 相关瞬态泄露。该实验更适合用来验证防御有效性，而不是作为可重复的数据恢复手段。
