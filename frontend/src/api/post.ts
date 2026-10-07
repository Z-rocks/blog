import request from "./request";
import type {
  LoginInput,
  LoginResult,
  PageResult,
  Post,
  PostQuery,
  PostSummary,
  SavePostInput,
} from "../types";

export async function getPosts(
  params: PostQuery = {},
): Promise<PageResult<PostSummary>> {
  return (await request.get<PageResult<PostSummary>>("/posts", { params }))
    .data;
}
// 全站已发布标签。标签栏用它,而不是从当前页文章上现取。
export async function getPostTags(): Promise<string[]> {
  return (await request.get<string[]>("/posts/tags")).data;
}
export async function getPost(id: number): Promise<Post> {
  return (await request.get<Post>(`/posts/${id}`)).data;
}
export async function getAdminPosts(
  params: PostQuery = {},
): Promise<PageResult<PostSummary>> {
  return (
    await request.get<PageResult<PostSummary>>("/admin/posts", { params })
  ).data;
}
export async function getAdminPost(id: number): Promise<Post> {
  return (await request.get<Post>(`/admin/posts/${id}`)).data;
}
export async function savePost(
  input: SavePostInput,
  id?: number,
): Promise<Post> {
  return id === undefined
    ? (await request.post<Post>("/admin/posts", input)).data
    : (await request.put<Post>(`/admin/posts/${id}`, input)).data;
}
export async function deletePost(id: number): Promise<{ id: number }> {
  return (await request.delete<{ id: number }>(`/admin/posts/${id}`)).data;
}
export async function login(input: LoginInput): Promise<LoginResult> {
  return (await request.post<LoginResult>("/auth/login", input)).data;
}
