import { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { MAX_PAGE } from "../src/post/dto/post-query.dto";
import { ADMIN_PASSWORD } from "./test-db.config";

interface Envelope<T> {
  code: number;
  message: string;
  data: T;
}
interface PageData<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
interface PostBody {
  id: number;
  title: string;
  summary: string;
  content?: string;
  tags: string[];
  status: string;
  createdAt: string;
  updatedAt: string;
}

let app: INestApplication;
let token: string;

// supertest 的类型走 `export =` 命名空间,默认导入拿不到类型位置,
// 这里交给推断,避免和它的 d.ts 较劲。
function api() {
  return request(app.getHttpServer());
}
function auth(): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

/** 默认建一篇合法草稿,用 overrides 只改动关心的字段。 */
function createPost(overrides: Record<string, unknown> = {}) {
  return api()
    .post("/api/admin/posts")
    .set(auth())
    .send({
      title: "默认标题",
      summary: "默认摘要",
      content: "# 正文\n\n内容",
      tags: ["NestJS"],
      status: "draft",
      ...overrides,
    });
}

beforeAll(async () => {
  const nest: NestExpressApplication =
    await NestFactory.create<NestExpressApplication>(AppModule, {
      logger: false,
    });
  configureApp(nest);
  await nest.init();
  app = nest;

  const login = await api()
    .post("/api/auth/login")
    .send({ username: "admin", password: ADMIN_PASSWORD })
    .expect(200);
  token = (login.body as Envelope<{ token: string }>).data.token;
});

// 每个用例都从空表开始,避免顺序耦合。
beforeEach(async () => {
  await app.get(DataSource).query("DELETE FROM post");
});

afterAll(async () => {
  await app?.close();
});

describe("公开读取契约", () => {
  it("列表返回统一信封,且不返回正文", async () => {
    await createPost({ status: "published", title: "已发布" }).expect(201);

    const res = await api().get("/api/posts").expect(200);
    const body = res.body as Envelope<PageData<PostBody>>;

    expect(body.code).toBe(0);
    expect(body.message).toBe("ok");
    expect(body.data.total).toBe(1);
    expect(body.data.items[0].title).toBe("已发布");
    // 列表带上正文会白白放大响应体,这是曾经差点回归的点。
    expect(Object.keys(body.data.items[0])).not.toContain("content");
  });

  it("草稿不出现在公开列表里", async () => {
    await createPost({ status: "draft", title: "草稿" }).expect(201);
    await createPost({ status: "published", title: "已发布" }).expect(201);

    const res = await api().get("/api/posts").expect(200);
    const body = res.body as Envelope<PageData<PostBody>>;
    expect(body.data.items.map((post: PostBody): string => post.title)).toEqual([
      "已发布",
    ]);
  });

  it("草稿详情对外是 404,而不是 200 或 403", async () => {
    const created = await createPost({ status: "draft" }).expect(201);
    const id: number = (created.body as Envelope<PostBody>).data.id;

    const res = await api().get(`/api/posts/${id}`).expect(404);
    const body = res.body as Envelope<null>;
    expect(body.code).toBe(404);
    expect(body.data).toBeNull();
  });

  it("已发布详情返回正文", async () => {
    const created = await createPost({
      status: "published",
      content: "# 你好",
    }).expect(201);
    const id: number = (created.body as Envelope<PostBody>).data.id;

    const res = await api().get(`/api/posts/${id}`).expect(200);
    expect((res.body as Envelope<PostBody>).data.content).toBe("# 你好");
  });

  it("标签筛选是完整匹配,不是前缀匹配", async () => {
    await createPost({
      status: "published",
      title: "A",
      tags: ["NestJS", "MySQL"],
    }).expect(201);
    await createPost({ status: "published", title: "B", tags: ["Nest"] }).expect(201);

    const exact = await api().get("/api/posts").query({ tag: "NestJS" }).expect(200);
    expect(
      (exact.body as Envelope<PageData<PostBody>>).data.items.map(
        (post: PostBody): string => post.title,
      ),
    ).toEqual(["A"]);

    const prefix = await api().get("/api/posts").query({ tag: "Nest" }).expect(200);
    expect(
      (prefix.body as Envelope<PageData<PostBody>>).data.items.map(
        (post: PostBody): string => post.title,
      ),
    ).toEqual(["B"]);
  });

  it("标签聚合覆盖全站已发布文章,且不随列表分页变化", async () => {
    const count = 12;
    for (let i = 0; i < count; i += 1) {
      const suffix = String(i).padStart(2, "0");
      await createPost({
        status: "published",
        title: `P${suffix}`,
        tags: [`tag-${suffix}`],
      }).expect(201);
    }
    await createPost({ status: "draft", tags: ["draft-only"] }).expect(201);

    // 默认分页只回 10 篇,标签栏却必须是全部 12 个——这正是修复前的缺陷。
    const list = await api().get("/api/posts").expect(200);
    expect(
      (list.body as Envelope<PageData<PostBody>>).data.items,
    ).toHaveLength(10);

    const res = await api().get("/api/posts/tags").expect(200);
    const tags = (res.body as Envelope<string[]>).data;
    expect(tags).toHaveLength(count);
    expect(tags[0]).toBe("tag-00");
    expect(tags).not.toContain("draft-only");
  });
});

describe("鉴权契约", () => {
  it("无 token 读后台列表是 401", async () => {
    const res = await api().get("/api/admin/posts").expect(401);
    expect((res.body as Envelope<null>).code).toBe(401);
  });

  it("伪造 token 是 401", async () => {
    await api()
      .get("/api/admin/posts")
      .set({ Authorization: "Bearer not-a-jwt" })
      .expect(401);
  });

  it("登录成功返回 7 天 token,密码错误返回 401", async () => {
    const ok = await api()
      .post("/api/auth/login")
      .send({ username: "admin", password: ADMIN_PASSWORD })
      .expect(200);
    const data = (ok.body as Envelope<{ token: string; expiresIn: number }>).data;
    expect(data.expiresIn).toBe(604800);
    expect(data.token.split(".")).toHaveLength(3);

    await api()
      .post("/api/auth/login")
      .send({ username: "admin", password: "definitely-wrong" })
      .expect(401);
  });

  it("用户名错误与密码错误返回同样的消息,不泄露账号是否存在", async () => {
    const res = await api()
      .post("/api/auth/login")
      .send({ username: "nobody", password: ADMIN_PASSWORD })
      .expect(401);
    expect((res.body as Envelope<null>).message).toBe("用户名或密码错误");
  });
});

describe("校验契约", () => {
  it("无 token 创建是 401", async () => {
    await api()
      .post("/api/admin/posts")
      .send({
        title: "T",
        summary: "",
        content: "c",
        tags: [],
        status: "draft",
      })
      .expect(401);
  });

  it("缺标题是 400", async () => {
    await createPost({ title: undefined }).expect(400);
  });

  it("只有空白的正文是 400", async () => {
    await createPost({ content: "   \n  " }).expect(400);
  });

  it("未声明字段被拒绝", async () => {
    await createPost({ isAdmin: true }).expect(400);
  });

  it("非法 status 是 400", async () => {
    await createPost({ status: "archived" }).expect(400);
  });

  it("超过上限的 page 是 400,刚好等于上限仍然可用", async () => {
    await api().get("/api/posts").query({ page: MAX_PAGE + 1 }).expect(400);
    await api().get("/api/posts").query({ page: MAX_PAGE }).expect(200);
  });

  it("非数字 id 是 400,不存在的文章是 404", async () => {
    await api().get("/api/posts/abc").expect(400);
    await api().get("/api/posts/999999").expect(404);
  });
});

describe("草稿 / 发布流转", () => {
  it("草稿对外不可见,发布后可见,删除后 404", async () => {
    const created = await createPost({ status: "draft", title: "流转" }).expect(201);
    const id: number = (created.body as Envelope<PostBody>).data.id;

    const empty = await api().get("/api/posts").expect(200);
    expect((empty.body as Envelope<PageData<PostBody>>).data.total).toBe(0);
    await api().get(`/api/posts/${id}`).expect(404);

    const adminList = await api().get("/api/admin/posts").set(auth()).expect(200);
    expect((adminList.body as Envelope<PageData<PostBody>>).data.total).toBe(1);

    await api()
      .put(`/api/admin/posts/${id}`)
      .set(auth())
      .send({
        title: "流转",
        summary: "摘要",
        content: "正文",
        tags: ["NestJS"],
        status: "published",
      })
      .expect(200);

    const visible = await api().get("/api/posts").expect(200);
    expect((visible.body as Envelope<PageData<PostBody>>).data.total).toBe(1);

    await api().delete(`/api/admin/posts/${id}`).set(auth()).expect(200);
    await api().get(`/api/posts/${id}`).expect(404);
    // 重复删除必须是 404,而不是静默成功。
    await api().delete(`/api/admin/posts/${id}`).set(auth()).expect(404);
  });
});
