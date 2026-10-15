import type {ComponentType} from 'react';
import {HbmInfrastructureCheck} from '@mymg/hbm';

/** Single catalog powers all portal cards and player routes. */
export type MgProject = {
  id: string;
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
    title: 'HBM 高带宽存储器',
    titleEn: 'HBM · MEMORY ARCHITECTURE',
    category: '芯片 / 三维结构',
    description: '以三维模型演示 DRAM 逐层堆叠与 GPU 邻近布局。',
    status: 'WEB 技术样片',
    component: HbmInfrastructureCheck,
    durationInFrames: 150,
    fps: 30,
    width: 1280,
    height: 720,
    notes: [
      '此版本是浏览器三维基础设施样片，不是此前 Mustard-03 影片的逐帧复刻。',
      '可以播放、暂停、拖动进度条与逐帧检查，不依赖 MP4。',
      'HBM 层数和封装为教学示意，不代表实际芯片精确尺寸。',
    ],
  },
];

export const getProject = (id: string): MgProject | undefined =>
  projects.find((project) => project.id === id);
