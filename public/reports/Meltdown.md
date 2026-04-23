# Meltdown 实验报告

## 实验目标

本实验用于复现 Meltdown（CVE-2017-5754）的核心利用链路，观察用户态通过瞬态执行触达内核态数据后，如何借助 Flush+Reload 将架构状态之外的缓存变化转换为可观测结果。

## 攻击机理概述

Meltdown 的关键不在于“直接读取内核内存”，而在于权限检查与数据装载之间存在微架构时间窗。攻击代码在异常提交前已经把内核字节编码进缓存侧信道，因此即便寄存器中的结果最终被回滚，缓存状态仍会保留泄露痕迹。

在本项目中，`libkdump` 负责计时、刷新缓存与参数自适应；`test.c` 用于最小化验证；`kaslr.c` 和 `reliability.c` 用于进一步量化地址定位与读取稳定性；`secret.c`、`physical_reader.c`、`memory_filler.c`、`memdump.c` 则展示了从跨进程读取到大范围内存嗅探的完整链路。

## 实验过程

1. 先在具备较旧内核配置的 Linux 环境中编译 `make`。
2. 使用 `taskset 0x1 ./test` 验证基础侧信道是否可用。
3. 通过 `sudo taskset 0x1 ./kaslr` 获取 direct physical map 偏移。
4. 使用 `sudo taskset 0x1 ./reliability <offset>` 评估读取稳定性。
5. 运行 `secret`、`physical_reader` 与 `memdump` 验证跨进程与物理内存读取效果。

## 实测结果

本次实验环境为第 12 代 Intel Core i5-1235U，硬件层面已具备 RDCL_NO 缓解特征，因此结果与旧款易感 CPU 存在明显差异：

- 基础测试 `test` 在报告记录中表现为字符输出被显著扰动，说明瞬态泄露路径已被硬件防御削弱。
- `kaslr` 仍可定位到 direct physical map 偏移，说明地址探测链路并未完全失效。
- `reliability` 的记录结果为约 `0.40%` 成功率，读取带宽远低于论文环境。
- 跨进程读取与内存嗅探阶段均未恢复出清晰的明文秘密，而是呈现大量噪声或碎片化内容。

示例输出如下：

```text
[+] Direct physical map offset: 0xffffb58f40000000
Success rate: 0.40 % (read 1121661 values)
```

## 运行时间

在 WSL 中实际运行最短 demo `./test`，从启动到结束的 wall-clock 耗时约为 0.59 秒。

```text
ELAPSED=0.59
```

## 结论

Meltdown 的地址定位链路在该平台上仍能启动，但真正的数据泄露带宽已被现代处理器防御显著压低。对当前硬件而言，攻击更接近“可检测、难利用”的状态，而非论文中的高带宽泄露。
