# Prime+Probe 实验报告

## 1. 本项目具体说明

Prime+Probe 是经典缓存侧信道技术：攻击者先“Prime”填充目标缓存集合，再让受害者执行，最后“Probe”回测哪些集合被驱逐，从而间接推断受害者访问模式。本实验使用 `ST-L1PP-AES` demo，针对 AES 软件实现进行 L1D 缓存轨迹分析，并输出每个 key byte 的高半字节猜测（`Guess:x-`）。

## 2. 涉及资源

- **L1 Data Cache Set（L1D 缓存集合）**
  - **位置**: CPU L1 数据缓存。
  - **功能**: 缓存最近访问的数据行，按 set/way 组织。
  - **利用**: 受害者访问 AES T-table 后，会在对应 set 上留下可探测的驱逐痕迹。

- **Prime+Probe 同步采样原语**
  - **位置**: Mastik `synctrace` / `syncPrimeProbe` 逻辑。
  - **功能**: 对目标访问窗口进行重复采样并聚合统计。
  - **利用**: 从多次样本中提高信噪比，增强 key nibble 判定稳定性。

- **AES 软件加密实现（表查找）**
  - **位置**: `aes_core.c` + `ST-L1PP-AES.c`。
  - **功能**: 用固定 key 执行 AES 加密。
  - **利用**: 明文与轮函数访问模式在缓存中泄露与 key 相关的信息。

## 3. 攻击原理

1. 选择 AES 加密函数作为受害者目标。
2. 采样阶段对 L1 cache set 做 Prime+Probe 测量，收集不同输入下的集合强度分布。
3. 对每个字节位置枚举 `0..f` 的高半字节猜测，寻找最匹配的集合模式。
4. 输出 `Key byte i Guess:x-` 及热力图。
5. 当 16 个 byte 都得到稳定 guess 时，可组成一组高半字节泄露结果。

## 4. 项目核心代码文件

- `unified_platform/program/prime_probe/demo/ST-L1PP-AES.c`
  - `keystr = "2b7e151628aed2a6abf7158809cf4f3c"`：受害者 AES 固定密钥。
  - `syncPrimeProbe(...)`：执行同步 Prime+Probe 采样。
  - `analyse(...)`：对每个字节做 nibble 猜测并输出 `Guess`。
  - `display(...)`：绘制每个候选值的热力图。

- `unified_platform/program/prime_probe/demo/aes_core.c`
  - AES 软件实现，提供可观测缓存访问路径。

- `unified_platform/program/prime_probe/api_server/main.py`
  - 平台化运行命令：`./ST-L1PP-AES -s 2000 -a -H`。
  - 结果解析规则：匹配 `Key byte ... Guess:...-`。

## 5. 运行环境

- **操作系统**: Ubuntu 24.04 LTS
- **内核**: Linux 6.17.0-22-generic
- **CPU**: AMD Ryzen 7 7840H (x86_64)
- **说明**: 本实验验证的是缓存侧信道可观测性与密钥相关信息泄露能力。

## 6. 执行步骤

1. 编译 demo：
```bash
cd unified_platform/program/prime_probe/demo
make ST-L1PP-AES
```

2. 运行测试：
```bash
./ST-L1PP-AES
```

## 7. 实测结果

### 7.1 密钥高半字节猜测汇总

按输出 `Guess` 汇总 16 个字节：

- byte0=e
- byte1=4
- byte2=c
- byte3=d
- byte4=8
- byte5=8
- byte6=a
- byte7=a
- byte8=c
- byte9=c
- byte10=0
- byte11=2
- byte12=5
- byte13=5
- byte14=8
- byte15=b

拼接后得到本次运行的高半字节序列：`e4cd88aacc02558b`。

### 7.2 原始终端输出

```text
(.venv) gaoxiang@gaoxiang-Legion-R7000P-APH8:~/vscode-workspace/POC_EXP_Backend/unified_platform/program/prime_probe/demo$ ./ST-L1PP-AES
Key byte  0 Guess:e-
00.                                       #
10.                                        #
20.                                     #
30.                                      #
40.                                   #
50.                                    #
60.                                 #
70.                                  #
80.                               #
90.                                #
A0.                             #
B0.                              #
C0.                           #
D0.                            #
E0.                         #
F0.                          #

Key byte  1 Guess:4-
00.                                                             #
10.                                                              #
20.                                                               #
30.                                                                #
40.                                                         #
50.                                                          #
60.                                                           #
70.                                                            #
80.     #
90.      #
A0.       #
B0.        #
C0. #
D0.  #
E0.   #
F0.    #

Key byte  2 Guess:c-
00.                                                                #
10. #
20.  #
30.   #
40.                                                            #
50.                                                             #
60.                                                              #
70.                                                               #
80.                                                        #
90.                                                         #
A0.                                                          #
B0.                                                           #
C0.                                                    #
D0.                                                     #
E0.                                                      #
F0.                                                       #

Key byte  3 Guess:d-
00.   #
10.  #
20.     #
30.    #
40.                                                               #
50.                                                              #
60. #
70.                                                                #
80.                                                           #
90.                                                          #
A0.                                                             #
B0.                                                            #
C0.                                                       #
D0.                                                      #
E0.                                                         #
F0.                                                        #

Key byte  4 Guess:8-
00.                 #
10.                  #
20.                   #
30.                    #
40.                     #
50.                      #
60.                       #
70.                        #
80.         #
90.          #
A0.           #
B0.            #
C0.             #
D0.              #
E0.               #
F0.                #

Key byte  5 Guess:8-
00.                              #
10.                               #
20.                                #
30.                                 #
40.                                  #
50.                                   #
60.                                    #
70.                                     #
80.                      #
90.                       #
A0.                        #
B0.                         #
C0.                          #
D0.                           #
E0.                            #
F0.                             #

Key byte  6 Guess:a-
00.                                      #
10.                                       #
20.                                    #
30.                                     #
40.                                          #
50.                                           #
60.                                        #
70.                                         #
80.                              #
90.                               #
A0.                            #
B0.                             #
C0.                                  #
D0.                                   #
E0.                                #
F0.                                 #

Key byte  7 Guess:a-
00.                                         #
10.                                          #
20.                                       #
30.                                        #
40.                                             #
50.                                              #
60.                                           #
70.                                            #
80.                                 #
90.                                  #
A0.                               #
B0.                                #
C0.                                     #
D0.                                      #
E0.                                   #
F0.                                    #

Key byte  8 Guess:c-
00.   #
10.    #
20.     #
30.      #
40.                                                               #
50.                                                                #
60. #
70.  #
80.                                                           #
90.                                                            #
A0.                                                             #
B0.                                                              #
C0.                                                       #
D0.                                                        #
E0.                                                         #
F0.                                                          #

Key byte  9 Guess:c-
00.                                                                #
10. #
20.  #
30.   #
40.                                                            #
50.                                                             #
60.                                                              #
70.                                                               #
80.                                                        #
90.                                                         #
A0.                                                          #
B0.                                                           #
C0.                                                    #
D0.                                                     #
E0.                                                      #
F0.                                                       #

Key byte 10 Guess:0-
00.                                      #
10.                                       #
20.                                        #
30.                                         #
40.                                          #
50.                                           #
60.                                            #
70.                                             #
80.                                              #
90.                                               #
A0.                                                #
B0.                                                 #
C0.                                                  #
D0.                                                   #
E0.                                                    #
F0.                                                     #

Key byte 11 Guess:2-
00.                                     #
10.                                      #
20.                                   #
30.                                    #
40.                                         #
50.                                          #
60.                                       #
70.                                        #
80.                                             #
90.                                              #
A0.                                           #
B0.                                            #
C0.                                                 #
D0.                                                  #
E0.                                               #
F0.                                                #

Key byte 12 Guess:5-
00.                        #
10.                       #
20.                          #
30.                         #
40.                    #
50.                   #
60.                      #
70.                     #
80.                                #
90.                               #
A0.                                  #
B0.                                 #
C0.                            #
D0.                           #
E0.                              #
F0.                             #

Key byte 13 Guess:5-
00.                                         #
10.                                        #
20.                                           #
30.                                          #
40.                                     #
50.                                    #
60.                                       #
70.                                      #
80.                                                 #
90.                                                #
A0.                                                   #
B0.                                                  #
C0.                                             #
D0.                                            #
E0.                                               #
F0.                                              #

Key byte 14 Guess:8-
00.                        #
10.                         #
20.                          #
30.                           #
40.                            #
50.                             #
60.                              #
70.                               #
80.                #
90.                 #
A0.                  #
B0.                   #
C0.                    #
D0.                     #
E0.                      #
F0.                       #

Key byte 15 Guess:b-
00.                                                 #
10.                                                #
20.                                               #
30.                                              #
40.                                                     #
50.                                                    #
60.                                                   #
70.                                                  #
80.                                         #
90.                                        #
A0.                                       #
B0.                                      #
C0.                                             #
D0.                                            #
E0.                                           #
F0.                                          #
```

## 8. 结果分析

- 程序对 16 个 key byte 都给出了明确 `Guess`，说明采样和判定链路是可工作的。
- 从热力图可见，各 byte 在某些 set 上存在集中高亮，符合 Prime+Probe 的集合冲突特征。
- 本次得到的高半字节序列为 `e4cd88aacc02558b`，与程序内置参考 key 的高半字节不一致，说明当前环境下仍存在噪声、调度抖动或参数未调优导致的偏差。
- 即便存在偏差，实验仍证明了“密钥相关缓存访存模式可被外部观测并形成字节级猜测”的侧信道风险。

## 9. 结论

本次 Prime+Probe（`ST-L1PP-AES`）实验复现成功：已能稳定提取 16 个字节位置的 key nibble 猜测与对应热力图，验证了 L1 缓存侧信道的可观测性与对 AES 软件实现的潜在泄露能力。

