import type { WorkDetail } from "../../types";

export const quoteAgentRag: WorkDetail = {
  id: "quote-agent-rag",
  name: "AI 报价 Agent（RAG 引擎）",
  category: "AI · BACKEND",
  tagline:
    "机械设计 AI 报价系统的本地 Agent：LLM 只负责阅读需求资料与分类，价格与人工审核判定完全由确定性规则引擎计算。",
  stack: ["Python", "Qdrant", "RAG", "Ollama", "Docker"],
  links: { source: "https://github.com/zys1101/agent" },
  visual: "terminal",
  problem: {
    heading: "让报价有依据，而不是让模型猜",
    body: [
      "同一个设计需求，报高了丢单、报低了亏工。人工报价依赖老工程师的经验：这类零件以前做过多少单、改了哪些地方、工期多长。",
      "直接把需求丢给大模型要一个价格，看起来省事，但输出不可复现、也无法解释，审核环节仍然要人从头再看一遍。",
    ],
  },
  core: {
    heading: "三个阶段的取数与判定",
    visual: "step-flow",
    steps: [
      {
        key: "parse",
        title: "资料解析",
        caption: "阅读需求资料并输出结构化字段，模型的职责到「理解」为止。",
      },
      {
        key: "retrieve",
        title: "案例检索",
        caption: "用向量检索从脱敏的历史成交案例里捞出相近的几单，拼进评估提示词。",
      },
      {
        key: "price",
        title: "规则定价",
        caption: "完整度分数由规则确定性重算，价格与是否转人工审核都由规则决定。",
      },
    ],
  },
  tech: {
    heading: "三个技术要点",
    points: [
      {
        title: "可复现的分数",
        body: "不信任模型自报的完整度：模型只给结构化需求，分数由规则重新计算，同一份输入永远得到同一个结果。",
      },
      {
        title: "幂等与审计",
        body: "SQLite 幂等缓存避免重复调用模型，审计日志记录每次判定用了哪些案例、命中了哪条规则。",
      },
      {
        title: "按需审核与并行",
        body: "只对规则判定为「需要看」的需求触发 LLM 审核，多阶段任务并行化，缩短单次估价等待。",
      },
    ],
  },
  result: {
    heading: "结果",
    body: [
      "报价从「模型给个数」变成「案例 + 规则 + 可回查的审计记录」，审核只需要看规则标注的疑点。",
      "同一份需求重复评估结果一致，出错时可以定位到具体案例与规则。",
    ],
  },
};
