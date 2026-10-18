import type { WorkDetail } from "../../types";

export const mechCrowdsourcing: WorkDetail = {
  id: "mech-crowdsourcing",
  name: "机械设计众包平台",
  category: "FULL STACK",
  tagline:
    "连接机械设计需求方与设计师的全栈众包平台，跑通「发布需求 → AI 报价 → 设计师报价 → 支付 → 交付验收 → 提现」完整业务闭环。",
  stack: ["NestJS", "Prisma", "uni-app", "Vue 3", "MySQL", "微信支付"],
  links: { source: "https://github.com/zys1101/mech-design-platform" },
  visual: "browser",
  problem: {
    heading: "一次设计交易要跨过六道坎",
    body: [
      "机械设计需求很难标准化：图纸要求、工况、材料、交付物各不相同，人工对接时报价往往靠经验，需求方等报价、设计师等澄清，一来一回就是几天。",
      "更难的是链路长。发布需求、报价、支付、交付、验收、提现分属不同角色，任何一环只做一半，平台就只是个留言板。",
    ],
  },
  core: {
    heading: "闭环的三个阶段",
    visual: "step-flow",
    steps: [
      {
        key: "publish",
        title: "需求结构化",
        caption: "需求方填写工况与交付要求，平台整理成可被规则与模型同时读取的结构。",
      },
      {
        key: "quote",
        title: "AI 报价",
        caption: "大模型只做理解与分类，价格由确定性规则计算，避免模型随口给数。",
      },
      {
        key: "settle",
        title: "支付与交付",
        caption: "设计师报价、支付、交付验收、提现串在同一条状态机上，每个状态都可回查。",
      },
    ],
  },
  tech: {
    heading: "三个技术要点",
    points: [
      {
        title: "单一后端，多端复用",
        body: "NestJS + Prisma + MySQL 一套后端，微信小程序、网站与管理后台共用 /api/mp/v1，避免三处逻辑各写一遍。",
      },
      {
        title: "模型理解，规则定价",
        body: "LLM 负责把自然语言需求读成结构化字段，价格由确定性规则引擎计算；模型不直接产出金额。",
      },
      {
        title: "交易链路的测试",
        body: "167 个单元测试 + 45 个端到端用例覆盖下单、支付、验收与提现，微信登录与支付支持 MOCK 模式本地跑通。",
      },
    ],
  },
  result: {
    heading: "结果",
    body: [
      "业务闭环打通：需求发布到提现走同一条链路，三个端看到的是同一份状态。",
      "报价从「等人工」变成「先给区间再人工确认」，模型与规则各司其职。",
    ],
  },
};
