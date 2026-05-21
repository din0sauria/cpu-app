# Spectre V4 实验报告

## 1. 本项目具体说明

Spectre V4（Speculative Store Bypass，CVE-2018-3639）利用了“先读后写相关性预测”带来的瞬态窗口：当 CPU 预测 Store 与后续 Load 无依赖时，可能提前执行 Load，读取到尚未被覆盖的旧值（stale data）。本实验使用 transientfail 的 STL 变体，验证秘密字符串 `INACCESSIBLE SECRET` 的泄露行为及其噪声特征。

## 2. 涉及资源

- **Memory Dependency Predictor（内存依赖预测）**
  - **位置**: CPU 乱序执行/访存调度逻辑。
  - **功能**: 预测 Store 与后续 Load 是否地址相关。
  - **利用**: 预测错误时触发 Store Bypass，Load 读到旧秘密值。

- **Store/Load 指令窗口**
  - **位置**: `access_array()` 中覆盖与读取 `data[x]` 的相邻路径。
  - **功能**: Store 将 `data[x]` 覆盖为 `#`；Load 读取 `data[x]`。
  - **利用**: 通过 flush 与指针追逐延缓 Store，扩大可利用窗口。

- **Flush+Reload 侧信道**
  - **位置**: cache timing 通道。
  - **功能**: 从缓存命中恢复字符。
  - **利用**: 判断最终是否还原出 `INACCESSIBLE SECRET`。

## 3. 攻击原理

1. 先把 `SECRET` 写入 `data`。
2. 使用多级指针与 flush 操作让覆盖写（Store）尽量变慢。
3. 在 Store 完成前，CPU 可能推测执行读取（Load）并取到旧秘密值。
4. 将读取结果编码到缓存。
5. 用 Flush+Reload 解码得到字符串；若泄露成功，出现 `INACCESSIBLE SECRET`。

## 4. 项目核心代码文件

- `unified_platform/program/spectre_v4/pocs/spectre/STL/main.c`
  - `access_array(int x)`：慢速覆盖 + 推测读取 + 缓存编码。
  - `main()`：循环泄露与字符串恢复逻辑。
- `unified_platform/program/spectre_v4/pocs/spectre/STL/Makefile`
  - 生成 `poc_x86`。
- `unified_platform/program/spectre_v4/pocs/libcache/cacheutils.h`
  - 提供缓存计时和阈值探测。

## 5. 运行环境

- **操作系统**: Ubuntu 24.04 LTS
- **内核**: Linux 6.17.0-22-generic
- **CPU**: AMD Ryzen 7 7840H (x86_64)
- **漏洞状态（系统接口）**:
  - `spec_store_bypass`: `Vulnerable`

## 6. 执行步骤

1. 编译 PoC：
```bash
cd unified_platform/program/spectre_v4/pocs/spectre/STL
make x86
```

2. 运行验证：
```bash
./poc_x86
```

## 7. 实测结果

本次共给出两次运行结果，用于体现 V4 对噪声敏感的特点。

```text
(.venv) gaoxiang@gaoxiang-Legion-R7000P-APH8:~/vscode-workspace/POC_EXP_Backend/unified_platform/program/spectre_v4/pocs/spectre/STL$ ./poc_x86
[*] Flush+Reload Threshold: 245
INACCEEEIBEEESECRETG
```

```text
(.venv) gaoxiang@gaoxiang-Legion-R7000P-APH8:~/vscode-workspace/POC_EXP_Backend/unified_platform/program/spectre_v4/pocs/spectre/STL$ ./poc_x86
[*] Flush+Reload Threshold: 245
INACCESSIBLE SECRET

[>] Done
```

## 8. 结果分析

- 第一次输出 `INACCEEEIBEEESECRETG`，存在明显字符抖动，属于侧信道噪声干扰下的部分解码。
- 第二次输出完整 `INACCESSIBLE SECRET` 且出现 `[>] Done`，说明泄露链路可稳定触发。
- 两次阈值均为 `245`，但结果不同，体现了 Spectre V4 对调度、缓存竞争、系统负载较敏感。

## 9. 结论

本次 Spectre V4（STL）实验复现成功。实验同时验证了该变体“可利用但受噪声影响较大”的典型特征。

## 10. 参考资料

1. Spectre V4 / SSB 公开技术资料（CVE-2018-3639）
