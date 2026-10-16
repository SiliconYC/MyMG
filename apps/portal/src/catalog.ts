import type {ComponentType} from 'react';
import {HbmInfrastructureCheck} from '@mymg/hbm';
import {DemoScene} from '@mymg/demo';
// @mymg-generator-imports

/** Single catalog powers all portal cards and player routes. */
export type MgProject = {
  id: string;
  compositionId: string;
  cover?: {type: 'hbm'} | {type: 'image'; src: string; alt: string};
  title: string;
  titleEn: string;
  category: string;
  description: string;
  status: string;
  component: ComponentType;
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
  notes: string[];
};

export const projects: readonly MgProject[] = [
  {
    id: 'hbm',
    compositionId: 'HBMInfrastructureCheck',
    cover: {type: 'image', src: '/MyMG/media/hbm-poster.jpg', alt: 'Mustard-03 HBM 与 GPU 封装全景'}, 
    title: 'HBM 高带宽存储器',
    titleEn: 'HBM · MEMORY ARCHITECTURE',
    category: '芯片 / 三维结构',
    description: 'Mustard-03 正式版：从 DRAM 垂直堆叠、TSV 到八组 HBM 与 GPU 封装。',
    status: 'Python 正版画面 · Web 完整播放',
    component: HbmInfrastructureCheck,
    durationInFrames: 345,
    fps: 30,
    width: 1280,
    height: 720,
    notes: [
      '网页直接播放与 Python 正式入口 make_mustard03.py 同源的完整 345 帧影片；不再用五秒 WebGL 样片替代。',
      'React 控制播放、暂停、时间轴与逐帧定位，影片随 Pages 发布，不将生成视频提交 Git。',
      '当前实现保证源影片视觉一致；并非把 Python 的三维几何逐行移植成 React Three Fiber。',
      'HBM 层数和封装为教学示意，不代表实际芯片精确尺寸。',
    ],
  },
  {
    id: 'demo',
    compositionId: 'MGDemo',
    title: 'MG 入门动画',
    titleEn: 'MOTION / STARTER SCENE',
    category: '二维 / 项目模板',
    description: '非 HBM 的独立最小项目，展示时间轴驱动的位移与进度变化。',
    status: '可播放示例',
    component: DemoScene,
    durationInFrames: 90,
    fps: 30,
    width: 1280,
    height: 720,
    notes: ['用于验证新作品能以单一登记进入门户与 Studio。', '画面由帧号决定，无需 WebGL 或服务器。'],
  },
  // @mymg-generator-projects
];

export const getProject = (id: string): MgProject | undefined =>
  projects.find((project) => project.id === id);
