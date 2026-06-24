# Meltdown-3a 实验报告

## 1. 本项目具体说明

Meltdown-3a（也称 Meltdown-CPL-REG）是 ESORICS 2023 论文《Reviving Meltdown 3a》中的核心复现对象。本项目重点验证了系统寄存器泄露与 CounterLeak 攻击原语，并复现了 pocs/ 目录下的基础寄存器泄露 PoC，以及 Spectre with CounterLeak、Zigzagger Bypass 等案例研究。

本次实验在 12th Gen Intel Core i5-1235U（Alder Lake）+ VMware Workstation 环境下完成。实际运行中未观察到有效泄露，结果与论文中“从 Alder Lake 开始未见泄露”的结论一致，同时也体现了虚拟化环境对 PMU / 侧信道实验的显著限制。

## 2. 涉及资源

- **Meltdown-CPL-REG / Meltdown 3a**
  - 位置：特权级检查前的瞬态执行路径。
  - 功能：在权限检查尚未完成时，短暂读取系统寄存器或计数器值。
  - 利用：将瞬态值编码到缓存状态，再通过侧信道恢复。

- **CounterLeak 攻击原语**
  - 位置：性能监控单元（PMU）。
  - 功能：读取性能计数器并作为隐蔽信道的信息源。
  - 利用：把计数器值映射到大数组页面索引，通过 Flush+Reload 读取。

- **Flush+Reload 侧信道**
  - 位置：CPU L1/L2 缓存。
  - 功能：通过访问时延差异判断某个页面是否被瞬态访问过。
  - 利用：恢复编码后的寄存器值或计数器值。

## 3. 攻击原理

Meltdown-3a 的核心链路可以概括为：

1. 触发瞬态执行，尝试读取受权限限制的系统寄存器。
2. 将瞬态结果编码到攻击者控制的缓存访问模式中。
3. 通过 Flush+Reload 遍历页面并恢复泄露值。
4. 进一步把 CounterLeak 用作隐蔽信道，驱动 Spectre、KASLR Bypass 和 Zigzagger 绕过等实验。

## 4. 项目核心代码文件

- `regcheck/`：扫描系统寄存器泄露面的分析工具。
- `pocs/rdpmc.c`：CounterLeak 基础 PoC，用于验证性能计数器泄露。
- `pocs/rdfsbase.c`、`rdgsbase.c`、`rdtsc.c`：基础寄存器泄露 PoC。
- `zigzagger-bypass/main.c`：Zigzagger Bypass 案例。
- `spectre-counterleak/spectre.c`：Spectre with CounterLeak 案例。

## 5. 实验过程

1. 配置 GRUB、rdpmc 与必要工具。
2. 运行 `regcheck` 扫描系统寄存器泄露情况。
3. 执行 `pocs` 目录下的基础 PoC。
4. 运行 `zigzagger-bypass` 与 `spectre-counterleak` 的案例程序。

## 6. 实测结果

- `regcheck` 未发现可复现的系统寄存器泄露标记。
- `rdpmc`、`rdfsbase`、`rdgsbase`、`rdtsc` 等基础 PoC 未恢复出稳定泄露值。
- `sldt-zf` 与 `str-zf` 明确提示 PoC does not work on this system。
- `zigzagger-bypass` 与 `spectre-counterleak` 在虚拟化环境下均未形成稳定的可利用信号。

## 7. 结论

本次实验验证了 Meltdown-3a / CounterLeak 在 Alder Lake + VMware 环境下缺乏稳定可利用的泄露面。项目链路可以运行，但实际泄露带宽不足，无法达到论文中的攻击效果。