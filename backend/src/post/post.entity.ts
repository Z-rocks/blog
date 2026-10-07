import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export enum PostStatus {
  Draft = "draft",
  Published = "published",
}

@Entity("post")
// 前台列表:status 等值过滤 + createdAt/id 降序,索引前导列与查询完全对齐。
@Index("IDX_post_status_created_id", ["status", "createdAt", "id"])
// 后台列表不按 status 过滤却同样排序,status 前导的索引用不上,需要单独一条。
@Index("IDX_post_created_id", ["createdAt", "id"])
export class Post {
  @PrimaryGeneratedColumn({ unsigned: true })
  id!: number;

  @Column({ type: "varchar", length: 160 })
  title!: string;

  @Column({ type: "varchar", length: 500 })
  summary!: string;

  @Column({ type: "mediumtext", select: false })
  content!: string;

  @Column({ type: "json" })
  tags!: string[];

  @Column({ type: "enum", enum: PostStatus, default: PostStatus.Draft })
  status!: PostStatus;

  @CreateDateColumn({ type: "datetime", precision: 6 })
  createdAt!: Date;

  @UpdateDateColumn({ type: "datetime", precision: 6 })
  updatedAt!: Date;
}

export type PostListItem = Omit<Post, "content">;
