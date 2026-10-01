# 焦虑熵值仪 (Anxiety Entropy Meter)

全栈热力学心理能量与负熵调控仪表盘系统。基于信息论创始人克劳德·香农的**香农熵（Shannon Entropy）**公式与现代认知心理学**不确定性熵模型（Entropy Model of Uncertainty, EMU）**，将每日 6 维心理感受量化为内心的微观有序/混乱程度，并提供热力学仪表盘、维度雷达、手写 SVG 熵变河流图、负熵因子排行榜及临界危象预警。

---

## 📐 数学理论与核心算法

### 1. 香农心理熵值计算 (`ShannonEntropyCalculator`)
$$H = - \sum_{k=0}^{6} p_k \log_2(p_k)$$

- **6 个核心心理焦虑维度**（打分区间 $s_1 \dots s_6 \in [0, 10]$，容量总上限 60 分）：
  1. **身体紧绷度** (`physicalTension`)
  2. **思维反刍度** (`rumination`)
  3. **控制感缺失** (`lackOfControl`)
  4. **时间压迫感** (`timePressure`)
  5. **社交回避度** (`socialAvoidance`)
  6. **未来不确定感** (`futureUncertainty`)
- **基态/秩序基底**：设定平静基态 $s_0 = \max(0, 60 - \sum_{i=1}^6 s_i)$，状态概率 $p_k = s_k / 60$（$\sum p_k = 1$）。
- **归一化总熵 (0 - 100)**：$\text{GrossEntropy} = \text{round}\left( \frac{H}{\log_2(6)} \times 100 \right)$。
  - 当所有维度均为 0 时，心智处于完全基态有序，$H = 0 \implies \text{Entropy} = 0$。
  - 当所有维度打满 10 分时，心智各子系统全面混乱耗竭，$H = \log_2(6) \implies \text{Entropy} = 100$。
  - 轻度焦虑（如均打 1 分）时，处于低熵澄明区（$< 30$）。
  - 全域重度高压（如均打 8 分）时，触发高熵危象区（$> 75$）。

### 2. 熵源边际归因 (`EntropySourceAttributor`)
各维度状态概率 $p_i = s_i / 60 \le 1/6 \approx 0.167 < 1/e \approx 0.368$。在此区间内，微观状态熵分量 $c_i = -p_i \log_2 p_i$ 严格单调递增，消除了信息论中的逆序反常现象。
$$\text{ContributionPercentage}_i = \frac{c_i}{\sum_{j=1}^6 c_j} \times 100\%$$
精准锁定哪个心理维度对总无序状态贡献最大。

### 3. 负熵事件记账 (`NegentropyLedger`)
用户记录一件能让自己平静下来的自愈微习惯（如 4-7-8 叹息深呼吸、森林漫步、好友倾诉）：
$$\text{NetEntropy} = \max\left(0, \text{GrossEntropy} - \sum \Delta S_{\text{negentropy}}\right)$$
统计降熵频次、累计削弱量与均次效能，生成“负熵因子排行榜”。

### 4. 动力学滚动窗口趋势与波动率 (`EntropyTrendAnalyzer`)
- **滚动线性回归斜率 ($\beta$)**：$\beta = \frac{N \sum t y - \sum t \sum y}{N \sum t^2 - (\sum t)^2}$。判断系统正处于“急剧熵增”、“稳态平衡”还是“显著减熵”。
- **波动率 ($\sigma$)**：滚动窗口标准差 $\sigma = \sqrt{\frac{1}{N}\sum (y - \bar{y})^2}$，度量内心情绪起伏烈度。

### 5. 临界状态机 (`CrisisDetector`)
- **高熵危象 (Danger)**：净熵值连续 3 天 $> 75$，触发警报脉冲与急救减熵程序（生理性叹息呼吸、触觉着陆、信息切断）。
- **低熵澄明 (Optimal)**：净熵值连续 3 天 $< 30$，触发澄明光环与心流深度创造建议。
- **稳态平衡 (Stable)**：处于动态自愈区间。

---

## 🏛️ 六边形架构 (Hexagonal Architecture)

严格遵循依赖倒置原则：`adapters → app → core`。

```
anxiety-entropy/
├── docker-compose.yml              # 容器编排与持久化
├── pnpm-workspace.yaml             # pnpm monorepo 配置
├── packages/shared/                # 前后端共享领域核心与契约
│   └── src/
│       ├── domain/                 # 领域实体模型 (entropy, entry, negentropy, crisis, trend)
│       ├── services/               # 核心数学与计算服务 (零框架依赖，前后端完全复用)
│       ├── ports/                  # 仓储与输入输出端口接口 (IEntryRepository)
│       └── schemas/                # Zod 校验 Schema (API 契约共用)
├── apps/backend/                   # 后端服务 (Node.js + Fastify + TypeScript)
│   ├── Dockerfile                  # node:20-alpine 多阶段构建 + /health 探活
│   ├── tests/                      # Vitest 单元测试与集成测试 (100% 覆盖核心服务)
│   └── src/
│       ├── core/                   # 纯业务逻辑层 (零依赖)
│       ├── adapters/               # 适配器层 (SQLite better-sqlite3 手写 SQL + Fastify 路由)
│       ├── app/                    # 用例编排服务 (DailyEntryService)
│       └── main.ts                 # 组合根 (Composition Root)
└── apps/frontend/                  # 前端 (TypeScript + Vite + 原生 CSS)
    ├── Dockerfile                  # node -> Nginx:alpine 多阶段镜像托管
    ├── nginx.conf                  # Nginx 反向代理、gzip 压缩与 SPA 回退
    └── src/
        ├── core/                   # 业务层 (复用香农熵服务，支持拖拽滑块实时推演)
        ├── adapters/               # HTTP 客户端 + 离线 LocalStorage 缓存
        ├── app/                    # 响应式状态管理 (DashboardStore) 与交互控制器
        ├── components/             # 100% 手写 SVG 仪表盘、雷达图、河流图与模态框
        ├── styles/                 # 原生 CSS (CSS Variables + Grid + 动效)
        └── main.ts                 # 前端启动挂载
```

---

## 🛠️ 技术栈与约束遵循

- **前端**：TypeScript + Vite + 原生 CSS（CSS Variables + Grid + 手写 SVG，**零 UI 框架，零第三方图表库**）。
- **后端**：Node.js 20 + Fastify + TypeScript。
- **数据库**：SQLite (`better-sqlite3`) + **手写 SQL + 仓储模式**（**无 ORM**）。
- **共享契约**：`packages/shared` 共享领域模型与 Zod Schema。
- **测试**：Vitest 自动化测试套件（覆盖 ShannonEntropyCalculator、EntropySourceAttributor、NegentropyLedger、EntropyTrendAnalyzer、CrisisDetector 及 SQLite 集成）。
- **部署**：Docker Compose 多阶段镜像编排，Nginx 托管静态资源并反向代理 `/api`，SQLite Volume 数据卷持久化。

---

## 🚀 快速启动与部署

### 方法一：Docker Compose 一键启动（生产推荐）

在项目根目录下执行：
```bash
docker compose up -d --build
```
启动后直接访问：
- **热力学仪表盘**：[http://localhost:8080](http://localhost:8080)
- **后端健康探活**：[http://localhost:8080/health](http://localhost:8080/health)
- **聚合仪表盘 API**：[http://localhost:8080/api/dashboard](http://localhost:8080/api/dashboard)

数据将自动保存在 Docker 数据卷 `anxiety-entropy-sqlite-data` 中持久化存储。

---

### 方法二：本地开发模式

#### 1. 安装依赖
```bash
pnpm install
```

#### 2. 运行自动化单测
```bash
pnpm test
```

#### 3. 启动后端开发服务器 (Port 3000)
```bash
pnpm dev:backend
```

#### 4. 启动前端 Vite 开发服务器 (Port 5173)
```bash
pnpm dev:frontend
```
浏览器打开 `http://localhost:5173`。

---

## 📡 REST API 规范

| 方法 | 路由 | 说明 | 请求体 / 查询参数 |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | 服务健康探活 | - |
| `GET` | `/api/dashboard` | 获取仪表盘聚合数据（表盘、雷达、河流图点阵、趋势、排行） | - |
| `POST` | `/api/entries` | 记录每日 6 维评估与负熵小事 | `{ date, scores, notes?, negentropyEvent? }` |
| `GET` | `/api/entries` | 分页查询历史评估列表 | `?limit=30&offset=0` |
| `GET` | `/api/entries/:date` | 查询特定日期的评估详情 | 路径参数 `:date` (YYYY-MM-DD) |
| `DELETE` | `/api/entries/:id` | 删除特定日期的评估条目 | 路径参数 `:id` |
| `POST` | `/api/negentropy` | 为指定条目追加负熵事件 | `{ entryId, title, category, reductionValue, notes? }` |
| `DELETE` | `/api/negentropy/:id` | 删除指定的负熵事件 | 路径参数 `:id` |
| `POST` | `/api/seed` | 注入 14 天完整热力学演化演示数据 | - |
