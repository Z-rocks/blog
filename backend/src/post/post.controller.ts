import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post as HttpPost,
  Put,
  Query,
} from "@nestjs/common";
import { Public } from "../common/decorators/public.decorator";
import { PageResult } from "../types/page-result";
import { Post, PostListItem } from "./post.entity";
import { PostQueryDto } from "./dto/post-query.dto";
import { SavePostDto } from "./dto/save-post.dto";
import { PostService } from "./post.service";

@Controller("posts")
export class PostController {
  constructor(private readonly service: PostService) {}

  @Public()
  @Get()
  list(@Query() query: PostQueryDto): Promise<PageResult<PostListItem>> {
    return this.service.list(query, true);
  }

  // 必须声明在 @Get(":id") 之前:否则 "tags" 会被 :id 捕获并撞上 ParseIntPipe 变成 400。
  @Public()
  @Get("tags")
  listTags(): Promise<string[]> {
    return this.service.listPublishedTags();
  }

  @Public()
  @Get(":id")
  detail(@Param("id", ParseIntPipe) id: number): Promise<Post> {
    return this.service.detail(id, true);
  }
}

// 默认全局鉴权，只有显式 @Public() 的前台接口和登录接口免鉴权。
@Controller("admin/posts")
export class AdminPostController {
  constructor(private readonly service: PostService) {}

  @Get()
  list(@Query() query: PostQueryDto): Promise<PageResult<PostListItem>> {
    return this.service.list(query, false);
  }

  @Get(":id")
  detail(@Param("id", ParseIntPipe) id: number): Promise<Post> {
    return this.service.detail(id, false);
  }

  @HttpPost()
  create(@Body() dto: SavePostDto): Promise<Post> {
    return this.service.create(dto);
  }

  @Put(":id")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: SavePostDto,
  ): Promise<Post> {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id", ParseIntPipe) id: number): Promise<{ id: number }> {
    return this.service.remove(id);
  }
}
