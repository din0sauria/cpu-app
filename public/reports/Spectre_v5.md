# Spectre V5 实验报告

## 1. 本项目具体说明

Spectre V5（RSB，Return Stack Buffer 相关瞬态执行问题）利用返回地址预测结构在特定交错执行条件下的错误预测，使受害路径短暂跳转到攻击路径并泄露秘密。本实验使用 transientfail 的 RSB `sa_ip` 变体，观察字符 `S` 的持续泄露现象。

## 2. 涉及资源

- **RSB（Return Stack Buffer）**
  - **位置**: CPU 分支预测单元中的返回预测结构。
  - **功能**: 为 `ret` 指令提供返回目标预测。
  - **利用**: 线程交错与返回序列导致返回预测失配，触发错误推测路径。

- **双线程交错执行（attacker/victim）**
  - **位置**: `main.c` 中 `pthread_create` 启动的两个线程。
  - **功能**: 通过不同 `usleep` 参数形成时序竞争。
  - **利用**: 攻击线程路径可在推测窗口中编码秘密值。

- **Flush+Reload 侧信道**
  - **位置**: cache timing 通道。
  - **功能**: 从缓存命中恢复字节候选。
  - **利用**: 运行中频繁打印的大写字母序列中，`S` 为关键证据。

## 3. 攻击原理

1. 攻击者线程与受害者线程都调用 `in_place()`，并通过寄存器传递不同休眠时间。
2. 返回路径发生竞争时，受害者可能在推测执行阶段误回到攻击路径。
3. 攻击路径把寄存器中的秘密相关值编码到缓存。
4. 主线程循环 Flush+Reload 解码并打印命中字符。
5. 若持续出现目标字符 `S`，说明泄露链路被触发。

## 4. 项目核心代码文件

- `unified_platform/program/spectre_v5/pocs/spectre/RSB/sa_ip/main.c`
  - `attacker()` / `victim()` / `in_place()`：构造返回预测竞争。
  - `main()`：线程创建、缓存刷新、侧信道解码打印。
- `unified_platform/program/spectre_v5/pocs/spectre/RSB/sa_ip/Makefile`
  - 编译生成 `poc_x86`（含 `-lpthread`）。
- `unified_platform/program/spectre_v5/pocs/libcache/cacheutils.h`
  - 缓存测时与阈值探测。

## 5. 运行环境

- **操作系统**: Ubuntu 24.04 LTS
- **内核**: Linux 6.17.0-22-generic
- **CPU**: AMD Ryzen 7 7840H (x86_64)
- **相关状态（系统接口）**:
  - `spectre_v2`: `Vulnerable; IBPB: disabled; STIBP: disabled; ...`
  - `lscpu` 显示 `Vulnerability Spec rstack overflow: Vulnerable`

## 6. 执行步骤

1. 编译 PoC：
```bash
cd unified_platform/program/spectre_v5/pocs/spectre/RSB/sa_ip
make x86
```

2. 运行验证：
```bash
./poc_x86
```

## 7. 实测结果

```text
(.venv) gaoxiang@gaoxiang-Legion-R7000P-APH8:~/vscode-workspace/POC_EXP_Backend/unified_platform/program/spectre_v5/pocs/spectre/RSB/sa_ip$ ./poc_x86
[*] Flush+Reload Threshold: 253
S   L   S   S   S   S   S   S   S   S   ^C
```

## 8. 结果分析

- 输出中 `S` 高频出现，满足 RSB PoC 的主要成功信号。
- `L` 等非目标字符为噪声或短时误判，不影响“可观测泄露”结论。
- `^C` 表示人工终止；该 PoC 默认持续运行并不断输出命中字符。

## 9. 结论

本次 Spectre V5（RSB/sa_ip）实验复现成功，已观测到稳定的 `S` 泄露痕迹，说明返回预测相关的瞬态执行通道在当前配置下可被触发。
