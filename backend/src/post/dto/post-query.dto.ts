import { Transform, TransformFnParams, Type } from "class-transformer";
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

// page 必须有上限:公开列表接口不设限时,page=1000000 会生成
// OFFSET 49999950 的查询,无需鉴权即可让数据库白扫一遍。
// 前端 frontend/src/views/BlogList.vue 中的 MAX_PAGE 需与此保持一致。
export const MAX_PAGE: number = 1000;

export class PostQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE)
  page: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize: number = 10;

  @IsOptional()
  @Transform(({ value }: TransformFnParams): unknown =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  tag?: string;
}
