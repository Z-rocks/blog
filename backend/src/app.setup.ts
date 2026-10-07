import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestExpressApplication } from "@nestjs/platform-express";
import { TransformInterceptor } from "./common/interceptors/transform.interceptor";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";

/**
 * 应用装配集中在这里,main.ts 与 e2e 测试共用同一份配置。
 * 测试若自己重复一遍 pipe / filter / interceptor,覆盖的就不是线上真实行为。
 */
export function configureApp(app: NestExpressApplication): void {
  const config: ConfigService = app.get(ConfigService);

  app.disable("x-powered-by");
  // 允许 DTO 中 100,000 字正文（包括中文与 JSON 转义），同时限制请求体大小。
  app.useBodyParser("json", { limit: "1mb" });
  app.setGlobalPrefix("api");
  // 前端生产环境通过同源 /api 访问；跨域仅允许显式列出的地址。
  const origins: string[] = config
    .get<string>("CORS_ORIGINS", "http://localhost:5173")
    .split(",")
    .map((value: string): string => value.trim())
    .filter(Boolean);
  app.enableCors({
    origin: origins,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: false },
      validationError: { target: false, value: false },
    }),
  );
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
}

/** PORT 校验独立出来,便于测试非法端口时不必真的监听。 */
export function resolvePort(config: ConfigService): number {
  const port: number = Number(config.get<string>("PORT", "3000"));
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("PORT 必须是有效端口");
  return port;
}
