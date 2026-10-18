import type { WorkDetail } from "../../types";

export const rmSentryVision: WorkDetail = {
  id: "rm-sentry-vision",
  name: "RoboMaster 哨兵视觉",
  category: "C++ · VISION",
  tagline:
    "Horizon 战队 RM26 赛季全车型通用自瞄仓库，本人负责其中哨兵（sentry）分支的视觉代码开发与维护。",
  stack: ["C++", "OpenCV", "OpenVINO", "TensorRT", "RoboMaster"],
  links: {
    source:
      "https://github.com/Horizon-Rm-Vision/Horizon_Rm_Vision_26/tree/sentry",
  },
  visual: "flow",
  problem: {
    heading: "同一份自瞄，两种算力",
    body: [
      "哨兵是全自动作战单元：没有操作手，识别、预测、发射全部由程序完成，视觉链路的任何一次漏检都直接体现在对抗结果上。",
      "同一套代码要同时跑在 x86 迷你主机与 Jetson Orin Nano 上，算力与推理框架都不同；同时它还要与其它车型分支共享仓库，改动不能互相拖累。",
    ],
  },
  core: {
    heading: "视觉链路的三段",
    visual: "step-flow",
    steps: [
      {
        key: "capture",
        title: "图像与预处理",
        caption: "相机取流后用 OpenCV 做色彩分割与轮廓筛选，先压低误检再谈精度。",
      },
      {
        key: "infer",
        title: "推理与解算",
        caption: "同一套模型走 OpenVINO 或 TensorRT，输出装甲板与目标角度。",
      },
      {
        key: "control",
        title: "电控下发",
        caption: "解算结果经串口 / USB2CAN 交给电控，完成从看到打。",
      },
    ],
  },
  tech: {
    heading: "三个技术要点",
    points: [
      {
        title: "双推理框架",
        body: "同一份模型权重分别走 OpenVINO 与 TensorRT 两条后端，按运行平台选择，不改上层业务代码。",
      },
      {
        title: "跨平台部署",
        body: "CMake 统一构建，适配 x86 MiniPC 与 Jetson Orin Nano，相机与串口参数外置为配置。",
      },
      {
        title: "分支解耦",
        body: "哨兵分支独立迭代，与英雄、步兵等车型分支共享通用视觉模块而不互相覆盖。",
      },
    ],
  },
  result: {
    heading: "结果",
    body: [
      "哨兵分支可以独立演进：调参与策略实验不阻塞其它车型的合并。",
      "两种算力平台共用一套上层逻辑，换机器不需要重写视觉链路。",
    ],
  },
};
