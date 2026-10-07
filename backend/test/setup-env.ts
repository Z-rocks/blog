import {
  ADMIN_PASSWORD_HASH,
  JWT_SECRET,
  TEST_DB,
} from "./test-db.config";

/**
 * 在任何应用代码加载之前注入环境变量。
 * dotenv 不会覆盖已存在的 process.env,因此这里的值优先于 backend/.env,
 * 保证测试连的是 blog_test 而不是开发库 blog。
 */
process.env.NODE_ENV = "test";
process.env.DB_HOST = TEST_DB.host;
process.env.DB_PORT = String(TEST_DB.port);
process.env.DB_USER = TEST_DB.user;
process.env.DB_PASSWORD = TEST_DB.password;
process.env.DB_NAME = TEST_DB.database;
// 建表交给 TypeORM,测试不维护另一份 DDL。
process.env.DB_SYNC = "true";
process.env.ADMIN_USERNAME = "admin";
process.env.ADMIN_PASSWORD_HASH = ADMIN_PASSWORD_HASH;
process.env.JWT_SECRET = JWT_SECRET;
process.env.CORS_ORIGINS = "http://localhost:5173";
