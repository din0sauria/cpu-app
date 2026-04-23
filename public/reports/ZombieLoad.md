# ZombieLoad 实验报告

## 实验目标

本实验用于验证 ZombieLoad（CVE-2018-12130）所代表的 MDS 类泄露是否仍能在当前平台上形成可观测的跨线程采样信号，重点关注 Windows 变体的直方图输出。

## 攻击机理概述

ZombieLoad 借助的是处理器内部填充缓冲区的陈旧数据传播。攻击者在同一物理核心上启动采样进程与受害者进程，通过异常路径或微码辅助触发数据重用，再用 Flush+Reload 将被采样到的字节映射成字符直方图。`attacker/variant3_windows/main.c` 是攻击主逻辑，`cacheutils_win.h` 提供计时与冲刷封装，`victim/windows/secret.c` 则负责持续向缓冲区注入固定字符。

## 实验过程

1. 在 Windows 环境下确认超线程拓扑与内核隔离状态。
2. 编译攻击端与受害端程序。
3. 将攻击者与受害者绑定到同一物理核心的不同逻辑线程。
4. 启动受害者持续加载秘密字符，再观察攻击者输出的字符直方图。

## 实测结果

本次记录对应的目标 CPU 为 Intel Core i5-1235U。硬件检测结果明确表明该平台属于 MDS_NO 路径，意味着原始 ZombieLoad 的泄露链路会被显著抑制。最终观测到的直方图并未在秘密字符上形成稳定峰值，而是表现为大面积噪声，说明攻击在该平台上无法形成可靠解码。

报告中的典型结果如下：

```text
Hardware is vulnerable to MDS: False
MDSHardwareVulnerable: False
Hardware is vulnerable to rogue data cache load: False
```

直方图里虽然仍会出现较高计数，但峰值不稳定且不能指向秘密字符，这与旧款易感 CPU 上的典型输出有明显差异。

## 运行时间

本次采用固定 500 ms 采样窗口统计输出，窗口内共识别到 **13 个完整直方图块**，据此折算得到平均每个完整直方图块约 **38.46 ms**。

测量过程使用 Windows PowerShell 脚本，从 attacker 进程启动后开始计时，先运行固定采样窗口，再统计标准输出中符合直方图格式 `[A-Z]: (   count)` 的连续 26 行块。该口径更适合描述 ZombieLoad Variant 3 这种持续循环输出的实验结果，而不是只取首行输出时间。

## 结论

ZombieLoad 的原始采样路径在第 12 代 Intel 平台上基本被硬件防御切断，实验更像是对防御效果的验证而不是有效的信息恢复。对该 CPU 而言，输出噪声大于泄露信号。
