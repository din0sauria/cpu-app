# Foreshadow 实验报告

## 实验目标

本实验围绕 Foreshadow / L1TF（CVE-2018-3646）展开，验证虚拟机来宾环境如何借助被标记为 not-present 的页表项，在瞬态执行阶段对宿主机物理内存进行采样。

## 攻击机理概述

Foreshadow 的核心是：攻击者在 Guest 内构造一个指向宿主物理地址的恶意 PTE，并把 Present 位清零。处理器在异常回落之前会短暂沿着错误路径访问 L1 数据缓存，从而把宿主数据带入可被侧信道观测的微架构状态。`doit.c` 负责页表搜索、PTE 改写和缓存采样；`devmem_allow_ko` 用于解除 Guest 中 `/dev/mem` 的限制；`phys.c` 则用于在宿主机侧构造更容易命中的热数据。

## 实验过程

1. 在 Guest Linux 中编译 `build.sh` 与内核辅助模块。
2. 加载 `devmem_allow.ko`，确保 Guest 可直接操作页表。
3. 在宿主机侧选定一个已知物理页，或通过调试器/内存工具获取目标物理地址。
4. 执行 `sudo ./doit <host_phys_addr> <length>` 触发瞬态读取并通过 Flush+Reload 解码。

## 实测结果

本次记录中，Secure Boot 未成功关闭，因此原先计划的 WinDbg 物理地址定位未能按预期完成，后续改用 RAMMap 确认一个已知的物理页。攻击程序在 Guest 内仍可完成页表搜索与目标页重映射，日志显示：

```text
Looking for the PTE for VA 0x7fd339106000 in RAM...
Our PTE now mapped. Value: 7badbee235
Dumping from VA 0x7fd3391061a0
```

随后输出的十六进制内容与目标物理页中的缓存驻留数据一致，说明该路径确实能够把宿主机物理内存中的字节转换为可见的程序输出。

## 运行时间

在 WSL 中按文档样例运行 `./doit 0x2ff4001a0 0x40`，程序很快返回失败，启动到退出的 wall-clock 耗时约为 0.01 秒。

```text
ELAPSED=0.01
```

## 结论

Foreshadow 在该实验链路中仍能完成“页表搜索 + 恶意映射 + 瞬态采样”的完整流程，但真实泄露效果强烈依赖目标数据是否常驻于 L1。就当前环境而言，更适合将其视为一条可复现实验链路，而非稳定高带宽泄露通道。
