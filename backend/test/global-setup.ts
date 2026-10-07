import { createConnection } from "mysql2/promise";
import { TEST_DB } from "./test-db.config";

/**
 * DB_SYNC 只建表不建库,所以测试库本身要先存在,否则整个套件连不上。
 * 这里用一次性的管理连接创建它,幂等。
 */
export default async function globalSetup(): Promise<void> {
  const connection = await createConnection({
    host: TEST_DB.host,
    port: TEST_DB.port,
    user: TEST_DB.user,
    password: TEST_DB.password,
    multipleStatements: false,
  });
  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${TEST_DB.database}\` ` +
        "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
    );
  } finally {
    await connection.end();
  }
}
