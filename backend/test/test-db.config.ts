/**
 * 测试库连接参数。默认指向本地 MySQL;CI 用 TEST_DB_* 覆盖。
 * 测试永远只碰 blog_test,不会碰到开发库 blog。
 */
export interface TestDbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export const TEST_DB: TestDbConfig = {
  host: process.env.TEST_DB_HOST ?? "127.0.0.1",
  port: Number(process.env.TEST_DB_PORT ?? "3306"),
  user: process.env.TEST_DB_USER ?? "root",
  password: process.env.TEST_DB_PASSWORD ?? "",
  database: process.env.TEST_DB_NAME ?? "blog_test",
};

/** 测试管理员凭据。哈希对应这个明文密码,只用于测试库。 */
export const ADMIN_PASSWORD = "devlog-test-password-2026";
export const ADMIN_PASSWORD_HASH =
  "$2b$12$r1uHh8vGVmI7p3ze5exF0urlA6M6A4s1BSACWe9K4IA9wpGHGvmi6";
export const JWT_SECRET = "test-only-jwt-secret-at-least-32-characters-long";
