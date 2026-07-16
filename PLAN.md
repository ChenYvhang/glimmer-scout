# NextScout 引爆雷达 — 实施计划（PLAN）

> 状态：Stage1-3 已完成并验证通过，见第7节执行清单。

---

## 0. 四层架构框架（对外表述）

2026-07-16 决定采用"数据层 / 匹配层 / 裂变层 / 复盘层"的四层框架来描述整个系统，
对内实现方式不变——不为了套用这个框架而引入无法用真实数据支撑的黑箱模块。
四层与已有 Stage1-6 的映射关系、以及每层的真实程度如下：

| 架构层 | 对应实现 | 真实程度 |
|---|---|---|
| **数据层** | Stage1 `collect.py`（YouTube采集）+ Stage2 `features.py`（特征工程） | 完全真实：真实API采集、真实特征计算，已验证年龄偏差消除 |
| **匹配层** | Stage3 `vision.py`（GLM-4.6V-Flash多模态理解）+ Stage4 `score.py`（GBDT潜力分P + cosine相似度共振分R） | 真实但**接受妥协**：不引入"预训练神经网络"黑箱匹配模型——demo规模的518频道没有真实的人货匹配监督标签，无法真训练这样的模型；继续用可解释、可回测的 GBDT（样本不足时启发式）+ cosine similarity，对外仍称"匹配层"，内部方法论不变 |
| **裂变层** | Stage5 `decide.py` **真实扩展**：在原有"单一执行方案卡"基础上，新增本地化脚本变体（多个creative variant）、字幕要点、发布节奏建议，均为DeepSeek真实生成，非模板套话 | 真实：调真实LLM生成，非预生成模板 |
| **复盘层** | **新增，明确标注"待接入"** | 不实现假因果推断/归因模型。系统状态页需诚实说明：demo没有真实广告投放/转化数据，复盘层（因果推断、归因、实时看板）没有数据支撑，标注"待接入"而非伪造归因图表 |

对应地：
- `dataset.json.meta` 需新增 `architecture_layers` 字段，标注四层各自的状态（`live` / `live_with_caveat` / `pending`）及一句话说明，供系统状态页直接渲染。
- Stage5 `decide.py` 的输出 schema（见第4节"决策层"）需要扩展 `creative_variants` 字段（数组，每个含脚本方向、字幕要点、适用场景），而不只是单一 `script_direction` 字符串。
- 前端"系统状态页"需要新增复盘层的诚实说明卡片。

---

## 1. 目录结构

```
/Demo
├── PLAN.md
├── .env.example
├── .gitignore
├── pipeline/
│   ├── collect.py            # Stage1 采集
│   ├── features.py           # Stage2 特征工程
│   ├── validate_features.py  # 年龄偏差 / 季节系数验证脚本（先跑通过再进Stage3）
│   ├── vision.py             # Stage3 多模态理解
│   ├── score.py              # Stage4 潜力分P + 共振分R + GBDT + 回测
│   ├── decide.py             # Stage5 DeepSeek 决策卡
│   ├── build.py               # Stage6 合并输出 dataset.json
│   ├── adapters/
│   │   ├── platform_base.py  # PlatformAdapter 抽象基类
│   │   └── youtube_adapter.py
│   ├── common/
│   │   ├── http.py           # 统一请求：超时/重试/退避/限流
│   │   ├── quota.py          # units 计数器，超预算即报错停止
│   │   └── logging.py
│   ├── config/
│   │   ├── dimensions.yaml   # 八维语义空间定义（vision与product共享）
│   │   ├── products.yaml     # 单品卖点向量
│   │   └── seeds.yaml        # 种子关键词表
│   ├── raw/
│   │   └── youtube/          # 原始采集 JSON，按 fetched_at 落盘
│   ├── cache/
│   │   ├── vision/           # 按 channelId 缓存视觉理解结果
│   │   └── decisions/        # 按 channelId+productId 缓存决策卡
│   └── artifacts/            # 中间产物：features.parquet/json、season_coefs.json、backtest.json 等
└── web/
    ├── public/
    │   └── dataset.json      # 唯一数据入口，前端 fetch 一次
    ├── src/
    │   ├── pages/
    │   │   ├── MatrixPage.tsx        # 引爆矩阵（首屏）
    │   │   ├── BacktestPage.tsx      # 回测对照
    │   │   ├── CreatorDrawer.tsx     # 达人详情抽屉（五层）
    │   │   └── SystemStatusPage.tsx  # 系统状态页
    │   ├── components/
    │   ├── lib/
    │   │   └── schema.ts     # dataset.json 的 TS 类型（与下面 schema 对齐）
    │   └── ...
    ├── index.html
    ├── package.json
    └── ...
```

设计要点：
- `pipeline/common/quota.py` 是配额红线的唯一执行点——所有 API 调用必须经过它计数，超过预算表里的上限直接抛异常，不静默继续。
- `PlatformAdapter` 只有一个方法族：`discover_seeds()` / `fetch_channel_snapshot()` / `fetch_recent_videos()`，YouTube 是唯一实现，其余四个平台在前端状态页里列为"待接入"，代码里不留空实现类以免误导。
- 每个 Stage 都产出一个可独立检查的中间文件（raw → features → vision cache → scores → decisions → dataset.json），任何一步失败都能从磁盘复现，不必重跑上游。

---

## 2. 配额预算表（YouTube Data API v3，每日 10000 units）

| 调用 | 单价 | 计划调用量 | 预计消耗 | 触发点 |
|---|---|---|---|---|
| `search.list` | 100 units | ≤20 次（种子发现） | ≤2000 | Stage1 步骤1，严格上限20次，代码里硬编码断路器 |
| `channels.list` | 1 unit/次调用（每次最多50 id） | 300-800频道 ÷50 ≈ 6-16次 | ≤16 | Stage1 步骤2 |
| `playlistItems.list` | 1 unit/次调用（每频道1次，取50条） | 300-800次（每频道1次） | 300-800 | Stage1 步骤3 |
| `videos.list` | 1 unit/次调用（每次最多50 id） | (300-800频道×50条)÷50 ≈ 300-800次 | 300-800 | Stage1 步骤4 |
| **合计** | | | **约 900-3400 units** | 单日跑完，留有余量 |

- 验证阶段（先跑20个频道）预计消耗：`search.list` 已经在种子阶段跑过（一次性，覆盖全量），后续验证只是从已去重的 channelId 池里截取20个测 2-4 步，预计 <100 units。
- `quota.py` 维护累计计数器，写入 `pipeline/artifacts/quota_log.json`，`build.py` 把最终消耗汇总进 `dataset.json.meta.quota_used`。
- 若种子发现阶段 `search.list` 命中不够 300 频道，允许追加关键词但不突破 20 次上限——数量不够就如实报告"采集到 N 个频道"，不得为凑数放宽上限。

---

## 3. dataset.json Schema

```jsonc
{
  "meta": {
    "fetched_at": "ISO8601",          // Stage1采集基准时间，所有"距今天数"以此计算
    "channel_count": 0,
    "video_count": 0,
    "quota_used": { "search": 0, "channels": 0, "playlistItems": 0, "videos": 0, "total": 0 },
    "model_status": {
      "potential_score_model": "gbdt" | "heuristic",  // 样本<100时为heuristic
      "gbdt_sample_count": 0
    },
    "data_sources": [
      { "platform": "youtube", "status": "connected" },
      { "platform": "tiktok", "status": "pending" },
      { "platform": "douyin", "status": "pending" },
      { "platform": "xiaohongshu", "status": "pending" },
      { "platform": "bilibili", "status": "pending" }
    ],
    "architecture_layers": [
      { "layer": "数据层", "status": "live", "note": "YouTube真实采集+特征工程，年龄偏差已验证消除" },
      { "layer": "匹配层", "status": "live_with_caveat", "note": "GBDT潜力分+cosine共振分，非黑箱预训练神经网络——demo规模无真实人货匹配监督标签，无法真训练该类模型" },
      { "layer": "裂变层", "status": "live", "note": "DeepSeek真实生成本地化脚本变体/字幕要点，非模板" },
      { "layer": "复盘层", "status": "pending", "note": "待接入：demo没有真实广告投放/转化数据，无法做真实因果归因，不伪造看板" }
    ]
  },
  "season_coefs": {
    // 垂类 -> 12个月系数；样本不足时 coef=1.0 且 insufficient_sample=true
    "滑雪": { "coefs": [1.0, 1.1, ...], "insufficient_sample": false, "sample_size": 0 }
  },
  "backtest": {
    "method": "自监督标签：切分点T=60天前，T后relative_velocity中位数是否显著高于T前",
    "baseline": { "name": "按订阅数排序", "top_k": 20, "hit_rate": 0.0 },
    "nextscout": { "name": "按潜力分P排序", "top_k": 20, "hit_rate": 0.0 },
    "lift": 0.0
  },
  "products": [
    {
      "id": "x5",
      "name": "Insta360 X5",
      "vector": [0,0,0,0,0,0,0,0],   // 与 dimensions.yaml 同一八维空间
      "feature_weights": {
        "隐形自拍杆": { "dims": ["camera_perspective_idx", ...], "weight": 0.0 },
        "子弹时间": {...},
        "防抖": {...},
        "超广角": {...}
      }
    }
  ],
  "creators": [
    {
      "channel_id": "UC...",
      "channel_url": "https://www.youtube.com/channel/UC...",
      "title": "string",
      "country": "string|null",
      "subscriber_count": 0,
      "view_count_total": 0,
      "video_count_total": 0,
      "channel_age_days": 0,
      "vertical": "滑雪",             // 由种子关键词/标签规则推断
      "thumbnails": ["https://i.ytimg.com/..."],   // 6-8张，Stage3使用的原图
      "videos": [
        {
          "video_id": "string",
          "published_at": "ISO8601",
          "view_count": 0,
          "like_count": 0,
          "comment_count": 0,
          "duration_seconds": 0,
          "age_bucket": "0-7|7-30|30-90|90-365|365+",
          "relative_velocity": 0.0,      // 同频道同龄箱中位数比值
          "season_adjusted_velocity": 0.0
        }
      ],
      "features": {
        "publish_cadence_30d": 0,
        "publish_cadence_90d": 0,
        "publish_interval_mean_days": 0.0,
        "publish_interval_std_days": 0.0,
        "recent_relative_velocity_mean": 0.0,
        "engagement_like_ratio": 0.0,
        "engagement_comment_ratio": 0.0,
        "engagement_trend": 0.0,
        "momentum_acceleration": 0.0,        // 核心信号：近期vs早期relative_velocity一阶差分
        "inflection_point": "ISO8601|null",  // 拐点日期
        "raw_momentum": 0.0,
        "adjusted_momentum": 0.0,            // raw_momentum / season_coef
        "subscriber_view_ratio": 0.0
      },
      "vision": {
        "sport_types": ["滑雪"],
        "camera_perspective": "第一人称为主",
        "stabilization_demand": 0.0,
        "motion_complexity": 0.0,
        "scene_extremity": 0.0,
        "gear_visibility": 0.0,
        "narrative_pace": "快节奏",
        "scene_diversity": 0.0,
        "content_vector": [0,0,0,0,0,0,0,0],
        "evidence": "string，引用具体缩略图内容与标题",
        "model": "glm-4.6v-flash"
      },
      "scores": {
        "potential": {
          "value": 0.0,
          "method": "gbdt" | "heuristic",
          "feature_importance": [ { "feature": "momentum_acceleration", "contribution": 0.0 } ]
        },
        "resonance": {
          "by_product": {
            "x5": {
              "value": 0.0,
              "contributions": [ { "dim": "stabilization_demand", "contribution": 0.0 } ],
              "feature_breakdown": { "隐形自拍杆": 0.0, "子弹时间": 0.0, "防抖": 0.0, "超广角": 0.0 }
            }
          }
        }
      },
      "decision": {
        // 仅Top60预生成；其余为 null，前端标注"未生成"
        "recommended_product": "x5",
        "reasoning": "string，须引用真实特征",
        "script_direction": "string",
        "price_range": { "min": 0, "max": 0, "currency": "USD" },
        "risk_review": {
          "competitor_flag": false,
          "flagged_keywords": [],
          "conclusion": "string"
        },
        "localization_notes": "string",
        // 裂变层真实扩展（2026-07-16新增）：不再只有单一script_direction，
        // 而是DeepSeek针对不同发布场景真实生成的多个创意变体
        "creative_variants": [
          {
            "variant_name": "string，如 极限场景强调版",
            "script_direction": "string，具体分镜/叙事方向",
            "subtitle_highlights": ["string，字幕关键句/卖点话术"],
            "target_platform_note": "string，该变体适配的平台/受众特点",
            "target_market": "string，适用本地市场"
          }
        ],
        "generated_at": "ISO8601"
      }
    }
  ]
}
```

前端 `web/src/lib/schema.ts` 的 TS 类型与此一一对应，字段名不做转换（蛇形命名直接透传，避免前后端字段漂移）。

---

## 4. 特征清单（Stage2）

**输入**：仅 `publishedAt` + `viewCount`（每频道每视频），无其他时序来源。

| 特征 | 定义 | 用途 |
|---|---|---|
| `age_bucket` | 视频年龄分箱：0-7/7-30/30-90/90-365/365+ 天 | relative_velocity 的分母基准 |
| `relative_velocity` | 该视频 viewCount ÷ 同频道同箱历史中位数 | 消除年龄累积偏差后的动能信号 |
| `publish_cadence_30d/90d` | 近30/90天发布数 | 发布节奏 |
| `publish_interval_mean/std` | 发布间隔的均值与方差 | 稳定性 |
| `recent_relative_velocity_mean` | 近期（如近90天）视频 relative_velocity 均值 | 近期热度 |
| `engagement_like_ratio` | likes/views | 互动质量 |
| `engagement_comment_ratio` | comments/views | 互动质量 |
| `engagement_trend` | 互动率随时间的线性趋势斜率 | 互动是否在改善 |
| `momentum_acceleration` | 近期 relative_velocity 均值 − 早期 relative_velocity 均值（一阶差分） | **核心信号**：加速度 |
| `inflection_point` | 沿时间轴 relative_velocity 由降转升的转折日期（简单滑动窗口极小值检测） | 前端轨迹图标注 |
| `raw_momentum` | 近期 relative_velocity 均值（未经季节调整） | 对照基线 |
| `adjusted_momentum` | `raw_momentum / season_coef(vertical, month)` | 季节修正后的真实动能 |
| `subscriber_view_ratio` | 订阅数/总播放 | 粉丝转化效率 |
| `channel_age_days` | 频道创建至 `fetched_at` 天数 | 归一化用 |

### 年龄偏差处理方案（生死线）

**问题**：`viewCount` 是累积值；同一发布时间点，老视频已经积累更久，直接用 `views/age_days` 会系统性偏向老视频，且不报错、只产出静默错误的排序。

**方案**：
1. 每条视频按年龄分箱（0-7/7-30/30-90/90-365/365+）。
2. **同一频道内**，计算该视频 viewCount 相对同箱内其他视频历史中位数的比值 → `relative_velocity`。这样比较的对象永远是"同样年龄段该有多少播放"，消除了累积效应。
3. 若某箱内样本 <3 条，向相邻箱合并（如 7-30 并入 0-7 或 30-90，取时间上更近的一侧）；合并后仍不足3条，则该视频的 `relative_velocity` 标记为 `null`，不参与动能类特征计算（但仍保留原始记录用于展示）。

### 验证方法（`pipeline/validate_features.py`，不过关不许往下走）

1. 计算全量视频的 `relative_velocity`，按 `age_bucket` 分组，打印每组的均值、中位数、标准差。
2. **通过标准**：五个分箱的 `relative_velocity` 均值应在 1.0 附近波动（因为定义就是"相对同箱中位数的比值"），且不能观察到随年龄单调上升或下降的漂移趋势（用简单线性回归看 `age_bucket_index` vs `relative_velocity` 均值的斜率，要求 |斜率| 明显小于组间标准差，非严格显著性检验，但输出图表和数字供人工判断）。
3. 若发现漂移（例如老箱系统性偏高或偏低），说明分箱粒度或合并规则有问题，回到步骤1调整分箱边界，重新验证，不进入 Stage3。
4. 输出：`pipeline/artifacts/validate_report.json` + 终端打印表格，人工确认后在 PLAN 执行记录里勾选通过。

### 季节因子估计

1. 用全部频道全部视频的 `relative_velocity`，按 `(vertical, month)` 聚合取均值，得到每个垂类12个月的粗系数。
2. 归一化：每垂类12个月系数除以该垂类全年均值，使系数均值=1.0（避免系数整体偏移影响绝对分值）。
3. 若某垂类某月样本 <阈值（如10条视频），该月系数回退为1.0，并在 `season_coefs[vertical].insufficient_sample` 标记，前端展示"样本不足，使用中性系数"。
4. `adjusted_momentum = raw_momentum / season_coef(vertical, month)`，month 取该视频 `published_at` 的月份（不是 fetched_at）。

---

## 5. 八维语义空间定义（`config/dimensions.yaml`，vision 与 product 共享）

| 维度 key | 中文含义 | 取值范围 | 说明 |
|---|---|---|---|
| `perspective_ratio` | 第一人称视角占比 | 0-1 | 越高越依赖 POV/自拍杆类拍摄 |
| `stabilization_demand` | 防抖需求强度 | 0-1 | 画面抖动/运动幅度隐含的防抖依赖 |
| `motion_complexity` | 运镜复杂度 | 0-1 | 多角度切换、跟拍、环绕等复杂运镜的使用程度 |
| `scene_extremity` | 场景极限度 | 0-1 | 高速/高空/水下/恶劣环境等极限程度 |
| `gear_visibility` | 装备可见度 | 0-1 | 画面中运动装备/相机设备的展示程度 |
| `narrative_pace` | 叙事节奏 | 0-1（快→慢映射为数值） | 剪辑快慢、信息密度 |
| `scene_diversity` | 场景多样性 | 0-1 | 单条视频内场景切换的丰富程度 |
| `slow_motion_demand` | 子弹时间/慢动作需求 | 0-1 | 高速摄影/慢动作展示的使用倾向 |

说明：
- 该 yaml 是 `vision.py` 输出 `content_vector` 与 `products.yaml` 输出 `product_vector` 的唯一共同坐标系，任何一方改动维度定义都必须同步。
- 每个维度在 yaml 里写明"评分锚点"（0.0/0.5/1.0 分别对应什么样的画面特征），供视觉模型 prompt 直接引用，减少主观漂移。

---

## 6. 缓存设计

| 缓存 | 路径 | key | 失效策略 |
|---|---|---|---|
| 视觉理解 | `pipeline/cache/vision/{channel_id}.json` | channel_id | 存在即跳过；无 TTL（demo 单次快照语义下无需过期） |
| 决策卡 | `pipeline/cache/decisions/{channel_id}__{product_id}.json` | channel_id+product_id | 同上 |
| 原始采集 | `pipeline/raw/youtube/{resource}_{fetched_at}.json` | 采集批次时间戳 | 不覆盖，每次采集新文件，`build.py` 读取最新一份 |
| 配额计数 | `pipeline/artifacts/quota_log.json` | 单例 | 每次运行追加，`quota.py` 启动时读取历史累计防止跨进程超支 |

并发与重试统一约定（`pipeline/common/http.py`）：
- 所有出网请求（YouTube / 智谱or通义 / DeepSeek）走同一个 client：超时（连接5s/读30s）、指数退避重试（最多3次，1s/2s/4s）、请求间限流（YouTube按配额本身限速；视觉模型并发信号量≤3）。
- 失败最终仍不成功：该条目跳过并记录到 `pipeline/artifacts/failures.json`，不写入伪造数据，不阻塞整体流程。

---

## 7. 执行顺序确认清单

- [x] 1. PLAN.md（本文档）—— 已确认
- [x] 2. collect.py：20频道验证通过（18频道保留，866视频，1837 units）
- [x] 3. 扩到300+频道 —— 实际518频道保留，25088条视频，配额共2868 units
      （产物：`pipeline/raw/youtube/channels_20260715T060255Z.json`；
      种子发现结果已缓存到 `pipeline/artifacts/seed_channels.json`，
      search.list 不会再重复消耗配额）
- [x] 4. features.py + validate_features.py —— 年龄偏差已消除（中位数漂移
      斜率0.002 < 0.05阈值，PASS），季节系数已改用中位数聚合（避免离群值
      污染，8个垂类均有充分样本）
      （产物：`pipeline/artifacts/features.json`、`pipeline/artifacts/validate_report.json`）
- [x] 5. vision.py：3频道验证通过，evidence质量良好（具体引用真实标题/缩略图，
      不同频道分数区分度清晰）。实际用的是 **GLM-4.6V-Flash**（用户指定的最新免费版，
      而非最初计划的glm-4v-flash）。
      过程中发现两个真实bug并已修复：
      (a) 官方文档说支持远程图片URL，实测必须传base64 data URI，否则400错误；
      (b) 免费层并发/排队不稳定，个别请求会挂起数分钟到数小时，加了硬性
      wall-clock超时（`common/http.call_with_wall_clock_timeout`）+ 单次调用retry，
      避免整条流水线被单个请求拖死。
      （产物：`pipeline/cache/vision/{channel_id}.json`，目前3个已缓存）
- [x] 5.5 vision.py 全量跑 —— 实测免费层速率太慢（~3-4分钟/频道，全518个要
      24-30小时），已改为**范围收窄**：新增 `--top-n-by-potential` 参数，
      利用score.py已经算出的P分（P不需要vision数据）优先跑潜力分最高的频道，
      而非按采集顺序。当前正在后台跑 top-180-by-potential，其余频道在
      dataset.json里resonance将诚实标为null/"待分析"。
- [x] 6. score.py：GBDT真训（278样本，超过100门槛），持出集accuracy=0.75但
      **AUC仅0.516（接近随机，如实报告，不回避）**；回测Top-20命中率：
      基线（订阅数排序）0.15 vs NextScout（P分排序）0.60，**lift=4.0倍**。
      过程中发现并修复了真实的look-ahead泄露：最初把订阅数/总播放量当特征喂进
      GBDT，但这两个是"现在"的累计值会泄露T之后的增长（label本身要预测的东西），
      删掉后lift从虚高的5.0降到真实的4.0。
      （产物：`pipeline/artifacts/scores.json`，R分随vision.py进度增量更新）
- [x] 7. decide.py：3个达人验证通过，质量好（真实引用P/R分数、feature_breakdown、
      vision evidence；竞品关键词规则命中'gopro'/'dji'后LLM给出具体排他条款建议；
      本地化建议真实结合频道country字段——瑞典/加拿大/德国分别给出对应建议）。
      按0节"四层架构"要求已扩展为多个 `creative_variants`（2-3个真实差异化的
      脚本变体+字幕要点+目标市场），不是单一script_direction。
      模型用的是 **deepseek-v4-flash**（确认deepseek-chat将于2026-07-24弃用，
      改用新模型名）。
      （产物：`pipeline/cache/decisions/{channel_id}.json`）
- [x] 8. build.py → dataset.json —— 跑通，518频道全量、16MB，含
      `meta.architecture_layers`四层状态标注、`meta.vision_coverage`/
      `decision_coverage`诚实覆盖率、`meta.age_bias_validation`（引用
      validate_report.json的漂移检测结果）。未覆盖vision/decision的频道
      对应字段为null，前端需渲染"待分析"/"未生成"。
      （产物：`web/public/dataset.json`，可随时重新build叠加最新缓存）
- [ ] 9. 前端（系统状态页需新增复盘层"待接入"诚实说明卡片）

### 下次继续时怎么说
直接说"接着做下一步"即可。当前后台仍有两个任务在跑：
vision.py（top-180-by-potential，免费层慢，预计还要几小时到十几小时）、
decide.py（对当前已有vision数据的候选跑决策卡）。两者随时可中断/继续，
dataset.json可以用`python -m pipeline.build`随时重新生成叠加最新进度。
下一步是前端（Vite+React+TS+Tailwind+Recharts），可以先用当前的
dataset.json搭起来，不需要等后台任务完全跑完。
