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
