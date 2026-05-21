# Spectre V2 实验报告

## 1. 本项目具体说明

Spectre V2（Branch Target Injection，CVE-2017-5715）通过污染间接分支预测目标，让受害路径在推测执行阶段跳转到攻击者期望的代码片段。本实验使用 transientfail 的 BTB `sa_ip` 变体，验证在同地址空间下通过虚函数调用误预测泄露秘密字符 `S`。

## 2. 涉及资源

- **BTB（Branch Target Buffer）**
  - **位置**: CPU 分支预测单元。
  - **功能**: 记录/预测间接分支目标地址。
  - **利用**: 通过重复调用训练路径，建立错误目标映射，诱导受害调用跳转到攻击路径。

- **虚函数调用点（间接分支）**
  - **位置**: `move_animal(Animal* animal)`。
  - **功能**: 运行时根据对象类型分派 `animal->move()`。
  - **利用**: 训练时喂给 `Fish`，攻击时切换为 `Bird`，制造类型-目标不一致的推测执行。

- **Flush+Reload 侧信道**
  - **位置**: cache timing 通道。
  - **功能**: 解码推测路径写入的缓存痕迹。
  - **利用**: 输出中的重复 `S` 是秘密字符泄露证据。

## 3. 攻击原理

1. `Fish::move()` 会执行 `cache_encode(data)`；`Bird` 对象中存放秘密字符 `S`。
2. 先大量调用 `move_animal(fish)` 训练 BTB。
3. 再调用 `move_animal(bird)`，在预测错误时推测执行到训练目标。
4. 推测路径把与对象布局相关的秘密值编码到缓存。
5. 程序持续解码并打印候选字符，观察是否稳定出现 `S`。

## 4. 项目核心代码文件

- `unified_platform/program/spectre_v2/pocs/spectre/BTB/sa_ip/main.cpp`
  - `Animal/Bird/Fish` 类与 `move_animal()` 间接分支触发点。
  - BTB 训练循环与侧信道恢复逻辑。
- `unified_platform/program/spectre_v2/pocs/spectre/BTB/sa_ip/Makefile`
  - 生成 `poc_x86`。
- `unified_platform/program/spectre_v2/pocs/libcache/cacheutils.h`
  - 缓存测时与阈值探测函数。

## 5. 运行环境

- **操作系统**: Ubuntu 24.04 LTS
- **内核**: Linux 6.17.0-22-generic
- **CPU**: AMD Ryzen 7 7840H (x86_64)
- **漏洞状态（系统接口）**:
  - `spectre_v2`: `Vulnerable; IBPB: disabled; STIBP: disabled; PBRSB-eIBRS: Not affected; BHI: Not affected`

## 6. 执行步骤

1. 编译 PoC：
```bash
cd unified_platform/program/spectre_v2/pocs/spectre/BTB/sa_ip
make x86
```

2. 运行验证：
```bash
./poc_x86
```

## 7. 实测结果

```text
(.venv) gaoxiang@gaoxiang-Legion-R7000P-APH8:~/vscode-workspace/POC_EXP_Backend/unified_platform/program/spectre_v2/pocs/spectre/BTB/sa_ip$ ./poc_x86
[*] Flush+Reload Threshold: 249
Works if S appears
S S S S S S S S S S F ^C
```

## 8. 结果分析

- 输出中连续出现多个 `S`，符合 PoC 的成功判据（“Works if S appears”）。
- 末尾出现 `F` 以及 `^C`：`F` 为训练路径噪声字符，`^C` 表示人工中断（PoC 默认持续运行）。
- 阈值 `249` 下仍能稳定看到 `S`，说明泄露信号清晰度较好。

## 9. 结论

本次 Spectre V2（BTB/sa_ip）实验复现成功，已观察到分支目标注入后对秘密字符 `S` 的可见泄露。

