现在的项目是一个vite+vue3初始的模板

我现在要使用AI做一个CPU漏洞检测代码下载平台（类似于资源下载站），让用户选择（输入）cpu型号和操作系统信息后提供可能存在CPU漏洞的POC和EXP代码。要求界面炫酷科技风，可以使用dataV，three等可视化库，首页需要一个展示平台功能的数据大屏，统计图要丰富，展示平台已有的poc和exp的信息体现平台优点特色，显示一些动态信息，最好有一些可以填随机数据实时更新的项目，现在没有后端，你需要填充一些编造的数据，但是注意要有可扩展性，我可以在后期方面地修改添加数据。注意采用组合式api风格，组件化实现，比如卡片可以作为一个组件，不要什么都写在同一个界面，UI样式可以参考draft.html（只参考样式，不要过多参考内容）。

平台功能列表：

0. 数据大屏
一个展示平台功能的数据大屏，统计图要丰富，展示平台已有的poc和exp的信息体现平台优点特色，显示一些动态信息，最好有一些可以填随机数据实时更新的项目，现在没有后端，你需要填充一些编造的数据。

1. 漏洞POC展示
根据处理器和操作系统，卡片展示可能出现的POC，用户选择自己处理器的漏洞点，下载相应的EXP代码（点卡片右下角按钮直接下载，点其他部分进入详情）

2. 漏洞点EXP展示
卡片展示对于每个POC有预先写好的攻击者受害者代码（EXP），用户选择自己处理器的漏洞点，下载相应的EXP代码（点卡片右下角按钮直接下载，点其他部分进入详情）

每个poc或exp要展示一个文档，后面会通过md格式文件添加，因此前端渲染指定md文件即可

以上两个页面上部需要有1.搜索框 搜索漏洞名称（攻击名称），根据字符匹配出名称中包含搜索字符的漏洞点。2. 分类下拉框 分类展示漏洞点，用户可以根据分类筛选漏洞点。

你可以根据以下表格展示漏洞点的分类信息（CVE类型	攻击类型 处理器架构）填下下拉框的分类。展示界面我想通过卡片展示，点开卡片的详细信息展示的报告md指定一个模板md，后面我添加md到assets文件夹的report文件夹下后改路径。

CVE类型	攻击类型	攻击名称	处理器架构	攻击描述
侧信道漏洞	Cache侧信道攻击	Flush+Reload	Intel、AMD、ARM	利用冲刷指令探测缓存行重用
        Prime+Probe	Intel、AMD、ARM	利用驱逐集探测缓存组竞争
    Timing侧信道攻击	SQUIP	AMD	执行单元调度程序争用
    Power侧信道攻击	PLATYPUS	Intel	RAPL功耗接口泄漏
        HertzBleed	Intel、AMD	DVFS动态电压频率缩放泄漏
        Collide+Power	AMD	汉明距离功耗泄漏
瞬态执行漏洞	Meltdown类攻击	Meltdown	Intel、ARM	特权数据缓存加载
        Meltdown V3a	Intel	特权寄存器越权读取
        Foreshadow	Intel	针对SGX的L1终端故障
        Foreshadow-OS	Intel	针对系统内核的L1终端故障
        Foreshadow-VMM	Intel	针对虚拟机的L1终端故障
        Fallout	Intel	存储缓冲区数据采样
        RIDL	Intel	加载端口数据采样
        ZombieLoad	Intel	行填充缓冲区数据采样
        TAA	Intel	事务异步中止数据采样
        CacheOut	Intel	L1数据缓存驱逐采样
        Snoop	Intel	Snoop辅助的L1数据缓存采样
        LVI	Intel	加载值注入
        CrossTalk	Intel	特殊寄存器缓冲区数据采样
        Downfall	Intel	向量寄存器文件数据采样
        RFDS	Intel	寄存器文件数据采样
    Spectre类攻击	Spectre V1	Intel、AMD、ARM	边界检查绕过
        Spectre V2	Intel、AMD、ARM	分支目标注入
        Spectre V4	Intel、AMD、ARM	推测存储绕过
        Spectre V5	Intel	返回分支注入
        BHI	Intel、ARM	分支历史注入
        RetBleed	Intel、AMD	返回堆栈缓冲区溢出
        GhostRace	Intel、AMD	推测竞态条件
        InSpectre	Intel、ARM	分支历史利用
        BSE	ARM	分支状态驱逐
        ITS	Intel	间接目标选择
        BPI	Intel	分支特权注入
        TSA	AMD	暂态调度数据泄漏
        VMSCAPE	Intel、AMD	虚拟化分支目标注入
架构错误漏洞		ÆPIC	Intel	APIC MMIO“陈旧”数据泄漏
        CacheWarp	AMD	未写回内存“陈旧”数据覆盖
        GhostWrite	RISC-V	向量指令任意内存写


3. 用户上传代码进行静态漏洞检测（留出后端URL，先编写一个py脚本在本地端口运行本地模型推理，然后把代码发送过去）
- 用户上传项目源代码（文件），在服务端进行匹配，寻找潜在的受害点->网页端回写

- 针对上传代码（文件）潜在漏洞点生成攻击者代码->网页端回写

本地模型推理脚本样例
```py
from transformers import AutoModelForCausalLM, AutoTokenizer

model_name = "Qwen/Qwen3-0.6B"

# load the tokenizer and the model
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForCausalLM.from_pretrained(
    model_name,
    torch_dtype="auto",
    device_map="auto"
)

# prepare the model input
prompt = "Give me a short introduction to large language model."
messages = [
    {"role": "user", "content": prompt}
]
text = tokenizer.apply_chat_template(
    messages,
    tokenize=False,
    add_generation_prompt=True,
    enable_thinking=True # Switches between thinking and non-thinking modes. Default is True.
)
model_inputs = tokenizer([text], return_tensors="pt").to(model.device)

# conduct text completion
generated_ids = model.generate(
    **model_inputs,
    max_new_tokens=32768
)
output_ids = generated_ids[0][len(model_inputs.input_ids[0]):].tolist() 

# parsing thinking content
try:
    # rindex finding 151668 (</think>)
    index = len(output_ids) - output_ids[::-1].index(151668)
except ValueError:
    index = 0

thinking_content = tokenizer.decode(output_ids[:index], skip_special_tokens=True).strip("\n")
content = tokenizer.decode(output_ids[index:], skip_special_tokens=True).strip("\n")

print("thinking content:", thinking_content)
print("content:", content)
```

