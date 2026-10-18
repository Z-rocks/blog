export type PostStatus = "draft" | "published";

export interface Post {
  id: number;
  title: string;
  summary: string;
  content: string;
  tags: string[];
  status: PostStatus;
  createdAt: string;
  updatedAt: string;
}
export type PostSummary = Omit<Post, "content">;
export type SavePostInput = Pick<
  Post,
  "title" | "summary" | "content" | "tags" | "status"
>;

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
export interface PostQuery {
  page?: number;
  pageSize?: number;
  tag?: string;
}
export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}
export interface LoginInput {
  username: string;
  password: string;
}
export interface LoginResult {
  token: string;
  expiresIn: number;
}

export interface Project {
  id: string;
  name: string;
  category: string;
  description: string;
  highlights: [string, string, string];
  tags: string[];
  /** 主仓库、镜像仓库、发布页与在线体验地址，均为可选项。 */
  links: {
    source?: string;
    mirror?: string;
    release?: string;
    demo?: string;
  };
  visual: "browser" | "flow" | "terminal" | "mobile";
  placeholder: boolean;
}
export interface Profile {
  name: string;
  role: string;
  positioning: string;
  email?: string;
  github?: string;
  resume?: string;
}

/** 详情页"核心架构"里的一个步骤，三步刚好对应三段滚动。 */
export interface WorkStep {
  key: string;
  /** 步骤名，如「通用内核」。 */
  title: string;
  /** 该步骤的解释文案。 */
  caption: string;
}

/**
 * 项目详情页数据。首页的 Project 只保留摘要，
 * 深度内容放在这里，新增案例不必再动首页模板。
 */
export interface WorkDetail {
  id: string;
  name: string;
  category: string;
  /** 一句话定位。 */
  tagline: string;
  stack: string[];
  links: Project["links"];
  /** Hero 区复用首页的视觉体系。 */
  visual: Project["visual"];
  problem: { heading: string; body: string[] };
  core: {
    heading: string;
    /** 注册表的 key：决定用哪一个核心动效组件。 */
    visual: "plugin-arch" | "step-flow";
    steps: [WorkStep, WorkStep, WorkStep];
  };
  tech: {
    heading: string;
    points: { title: string; body: string }[];
    /** 可选代码片段，纯 <pre> 渲染，不引入 highlight.js。 */
    snippet?: { lang: string; code: string };
  };
  result: { heading: string; body: string[] };
}
