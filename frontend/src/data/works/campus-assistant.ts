import type { WorkDetail } from "../../types";

export const campusAssistant: WorkDetail = {
  id: "campus-assistant",
  name: "校园助手",
  category: "MOBILE · FLUTTER",
  tagline:
    "插件驱动的 Android 课表应用：把「怎么从教务系统取数据」抽成 .js 插件，内核不认识任何一所学校。",
  stack: ["Flutter", "Dart", "Kotlin", "Hive", "AppWidget"],
  links: {
    source: "https://gitee.com/zrocks/my_schedule_app",
    mirror: "https://github.com/Z-rocks/my_schedule_app",
    release: "https://gitee.com/zrocks/my_schedule_app/releases",
  },
  visual: "mobile",
  problem: {
    heading: "每所学校都是一套新的教务系统",
    body: [
      "课表类应用的成本几乎全在取数：教务系统的登录方式、字段名、HTML 结构、作息时间，每所学校都不一样。如果把这些差异写进客户端，换一所学校就要发一个版本。",
      "另一条常见路线是把账号密码交给服务器代抓。这样换学校只需要改后端，但密码和课表都要离开本机，代价是隐私。",
    ],
  },
  core: {
    heading: "内核 + 插件",
    visual: "plugin-arch",
    steps: [
      {
        key: "kernel",
        title: "通用内核",
        caption: "周视图、单双周、节次时间、提醒，这一套只写一次。",
      },
      {
        key: "plugin",
        title: "插件取数",
        caption: "教务 URL、字段映射与真实作息写进 .js 插件，由内核加载。",
      },
      {
        key: "swap",
        title: "换校即换插件",
        caption: "换一所学校只是换一个文件，客户端与内核一行不改。",
      },
    ],
  },
  tech: {
    heading: "三个技术要点",
    points: [
      {
        title: "插件化取数",
        body: "插件是一个导出固定形状的 ES 模块：登录、抓取、字段映射各一个函数，内核只认这个契约。",
      },
      {
        title: "小组件哑渲染",
        body: "Dart 侧算好要显示的文案与颜色，Kotlin 只负责 RemoteViews 摆放；平板按 dimens 三档缩放。",
      },
      {
        title: "本机存储与双源更新",
        body: "课表与登录态留在本机 Hive；手动修改走独立覆盖层，重新同步不会冲掉；Release 双源完成更新检查与分发。",
      },
    ],
    snippet: {
      lang: "js",
      code: `// plugin.js（示意）：一所学校就是一个插件文件
export default {
  id: "example-university",
  loginUrl: "https://jw.example.edu.cn/login",
  fields: { courseName: "kcmc", teacher: "xm", room: "cdmc" },
  periods: [{ index: 1, start: "08:00", end: "08:45" }],
  async fetch(session) {
    // 返回原始课表，内核负责转成统一模型
  },
};`,
    },
  },
  result: {
    heading: "结果",
    body: [
      "换校成本从「改客户端、发版本」降到「换一个插件文件」；账号与课表不出本机，没有后端与账号体系。",
      "桌面小组件覆盖锁屏外的高频场景，手动改课与自动同步互不覆盖。",
    ],
  },
};
