import type {ComponentType} from 'react';
import {HbmMustard03Native} from '@mymg/hbm';
import {DemoScene} from '@mymg/demo';
import {PendulumClockScene} from '@mymg/pendulum-clock';
import {SteamEngineScene} from '@mymg/steam-engine';
import {CpuGpuScene} from '@mymg/cpu-gpu';
// @mymg-generator-imports

/** Single catalog powers all portal cards and player routes. */
export type MgProject = {
  id: string;
  compositionId: string;
  cover?: {type: 'hbm'} | {type: 'clock'} | {type: 'steam'} | {type: 'cpu-gpu'} | {type: 'image'; src: string; alt: string};
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
    compositionId: 'HBMMustard03Native',
    cover: {type: 'hbm'}, 
    title: 'HBM 高带宽存储器',
    titleEn: 'HBM · MEMORY ARCHITECTURE',
    category: '芯片 / 三维结构',
    description: 'Mustard-03 正式版：从 DRAM 垂直堆叠、TSV 到八组 HBM 与 GPU 封装。',
    status: 'React / Three.js 原生动画',
    component: HbmMustard03Native,
    durationInFrames: 345,
    fps: 30,
    width: 1280,
    height: 720,
    notes: [
      '原生 React/Three.js 网页动画：由 JS 按帧计算模型，Three.js WebGL 绘制所有晶片、TSV 铜柱、封装与连接线。',
      '完整 345 帧与 Python Mustard-03 同时间线；Web 播放不使用视频、逐帧图片或服务器媒体。',
      '使用原 Python 的 2:1 正交投影与世界坐标，文字、镜头和封装采用固定的真实 3D 几何过程。',
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
  {
    id: 'pendulum-clock',
    compositionId: 'PendulumClockScene',
    cover: {type: 'clock'},
    title: '机械摆钟 · 擒纵机构',
    titleEn: 'ANCHOR ESCAPEMENT / REGULATOR CLOCK',
    category: '机械 / 节奏控制',
    description: '钟摆交替解锁擒纵轮：每秒放行半齿，秒针同步跳动一格。可以逐帧研究锁止与释放。',
    status: 'React / Three.js 原生动画',
    component: PendulumClockScene,
    durationInFrames: 1800,
    fps: 30,
    width: 1280,
    height: 720,
    notes: [
      '30 齿擒纵轮，钟摆每两秒完整往复一次；左右擒纵瓦交替锁止，轮子每秒只走 6°。',
      '秒针与擒纵轮共用同一角度，经过 60 次节拍恰好转一整圈；暂停、拖动与逐帧状态完全一致。',
      '擒纵轮、擒纵叉、摆杆、摆锤、钟面和指针全部由浏览器 Three.js 几何绘制，不使用 MP4 或逐帧图像。',
      '为便于观察，齿形、摆幅及释放动作均是教学示意；并非可直接加工的物理仿真机芯。',
    ],
  },
  {
    id: 'steam-engine',
    compositionId: 'SteamEngineScene',
    cover: {type: 'steam'},
    title: '蒸汽机 · 动态剖切',
    titleEn: 'STEAM ENGINE / 3D CUTAWAY',
    category: '机械 / 三维剖面',
    description: '剖开气缸，看蒸汽如何推动活塞与飞轮。',
    status: 'React / Three.js 实时剖切',
    component: SteamEngineScene,
    durationInFrames: 540,
    fps: 30,
    width: 1280,
    height: 720,
    notes: ['原生 3D 剖切；剖切前后，内部机械始终持续运转。'],
  },
  {
    id: 'cpu-gpu',
    compositionId: 'CpuGpuScene',
    cover: {type: 'cpu-gpu'},
    title: 'CPU 与 GPU：两种计算方式',
    titleEn: 'CPU / GPU · PARALLEL COMPUTE',
    category: '芯片 / 三维运算架构',
    description: '看见四个强控制核心与八十条同步计算通道，理解重复任务和复杂分支如何改变优势。',
    status: 'React / Three.js 原生动画',
    component: CpuGpuScene,
    durationInFrames: 630,
    fps: 30,
    width: 1280,
    height: 720,
    notes: [
      '原生实时 Three.js 几何，无 MP4、视频贴图或预渲染帧；可逐帧检视核心、数据包与输出。',
      '规则任务：大量计算通道执行相同指令、处理不同数据；四个 CPU 核心通过连续多轮完成。',
      '分支任务：CPU 核心各走不同控制流；GPU 示意为分歧路径分组轮流执行。',
      '80 条 GPU 运算通道是概念化示意，不代表 80 颗完整 GPU 核心；动画速率不是实际硬件跑分。',
    ],
  },
  // @mymg-generator-projects
];

export const getProject = (id: string): MgProject | undefined =>
  projects.find((project) => project.id === id);
