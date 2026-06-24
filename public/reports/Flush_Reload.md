# Flush+Reload 实验报告

## 1. 本项目具体说明

Flush+Reload 是经典缓存侧信道原语（Yarom & Falkner, USENIX Security 2014），核心思想是通过“刷新缓存行（Flush）+ 重新访问并计时（Reload）”来判断目标地址是否被其他执行上下文访问。本实验使用 `FR-threshold` demo 对“内存访问延迟”和“缓存命中延迟”进行统计，验证该侧信道在当前环境中的可分辨性。

## 2. 涉及资源

- **CPU Cache 层级（L1/L2/L3）**
  - **位置**: 处理器内部缓存系统。
  - **功能**: 缓存热点数据，降低访问延迟。
  - **利用**: 如果目标数据已被缓存，访问时间显著低于主存访问。

- **`clflush`/探测机制（由 Mastik FR 原语封装）**
  - **位置**: x86 指令与测时逻辑。
  - **功能**: 驱逐缓存行并测量访问时延。
  - **利用**: 将“是否被访问过”转换为可测时延差。

- **共享地址页/可监控地址**
  - **位置**: 进程可映射代码页（本例中 `FR-threshold.c` 对应地址）。
  - **功能**: 作为被监听对象。
  - **利用**: 子进程持续访问该地址，父进程探测命中率变化。

## 3. 攻击原理

1. 主进程准备 FR 监控器并监控目标地址。
2. 第一阶段采样“内存态”时延（目标未被持续热访问）。
3. fork 子进程后，子进程循环读取目标地址，让其高概率驻留缓存。
4. 第二阶段采样“缓存态”时延。
5. 对两组样本排序并输出最小值、分位数、中位数与最大值，比较两组分布差异。

## 4. 项目核心代码文件

- `unified_platform/program/flush_reload/demo/FR-threshold.c`
  - `fr_prepare()/fr_monitor()`：初始化 Flush+Reload 监控。
  - 两段 `for` 循环：分别采集 Memory 与 Cache 时延样本。
  - `forkslave()`：子进程循环访问目标地址，制造缓存命中条件。
  - `qsort + 统计输出`：输出最小值/分位数/中位数/最大值。

- `unified_platform/program/flush_reload/mastik/fr.h`
  - FR 接口声明（`fr_probe` 等）。

- `unified_platform/program/flush_reload/src/fr.c`
  - FR 探测逻辑实现。

## 5. 运行环境

- **操作系统**: Ubuntu 24.04 LTS
- **内核**: Linux 6.17.0-22-generic
- **CPU**: AMD Ryzen 7 7840H (x86_64)
- **说明**: 本实验是侧信道测量能力验证，不直接对应单一 CVE 结论。

## 6. 执行步骤

1. 进入 demo 目录并编译：
```bash
cd unified_platform/program/flush_reload/demo
make FR-threshold
```

2. 运行阈值测试：
```bash
./FR-threshold
```

## 7. 实测结果

```text
(.venv) gaoxiang@gaoxiang-Legion-R7000P-APH8:~/vscode-workspace/POC_EXP_Backend/unified_platform/program/flush_reload/demo$ ./FR-threshold
             :  Mem  Cache
Minimum      :   342    76
Bottom decile:   342    76
Median       :   456   114
Top decile   :   570   114
Maximum      : 65535 65535
```

## 8. 结果分析

- 关键统计量显示 `Cache` 显著低于 `Mem`：
  - 中位数 `Mem=456`，`Cache=114`，差值明显。
  - 底部 10% 分位 `Mem=342`，`Cache=76`，同样保持大幅差距。
- 这说明在当前平台上，Flush+Reload 的时间分布具有可分离性，可用于后续侧信道编码/解码实验。
- `Maximum` 两列均为 `65535`，通常代表采样中的极端噪声或计时上限截断，不影响中位数和分位数给出的主体结论。

## 9. 结论

本次 Flush+Reload 阈值实验成功。实验结果验证了“缓存命中明显快于内存访问”的可观测时间差，说明该平台具备可用的 Flush+Reload 侧信道测量条件。
