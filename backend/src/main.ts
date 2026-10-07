import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { configureApp, resolvePort } from "./app.setup";

async function bootstrap(): Promise<void> {
  const app: NestExpressApplication =
    await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);
  const port: number = resolvePort(app.get(ConfigService));
  // 只在真正常驻的进程里挂关闭钩子,测试进程不需要。
  app.enableShutdownHooks();
  await app.listen(port, "0.0.0.0");
  Logger.log(`API listening on port ${port}, prefix /api`, "Bootstrap");
}

void bootstrap().catch((error: unknown): void => {
  Logger.error(
    error instanceof Error ? error.message : "启动失败",
    undefined,
    "Bootstrap",
  );
  process.exitCode = 1;
});
