import type {ComponentType} from 'react';
import {HbmMustard03Native} from '@mymg/hbm';
import {DemoScene} from '@mymg/demo';
import {PendulumClockScene} from '@mymg/pendulum-clock';
import {SteamEngineScene} from '@mymg/steam-engine';
import {CpuGpuScene} from '@mymg/cpu-gpu';
import {AutomaticFireScene} from '@mymg/automatic-fire';
// @mymg-generator-imports

/** Single catalog powers all portal cards and player routes. */
export type MgProject = {
  id: string;
  compositionId: string;
  cover?: {type: 'hbm'} | {type: 'clock'} | {type: 'steam'} | {type: 'cpu-gpu'} | {type: 'automatic-fire'} | {type: 'image'; src: string; alt: string};
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
    description: '一套完整 3D 机芯：镜头从表盘正面绕到擒纵结构背面，推近齿面，观察锁止、放行与秒针步进。',
    status: 'React / Three.js 原生动画',
    component: PendulumClockScene,
    durationInFrames: 1800,
    fps: 30,
    width: 1280,
    height: 720,
    notes: [
      '30 齿擒纵轮，钟摆每两秒完整往复一次；左右擒纵瓦交替锁止，轮子每秒只走 6°。',
      '秒针与擒纵轮共用同一角度，经过 60 次节拍恰好转一整圈；暂停、拖动与逐帧状态完全一致。',
      '前侧表盘、背侧擒纵轮、锚形叉、钟摆与机架为同一套有厚度的 3D 几何。摄影机以真实空间轨迹旋转、推近、拉远，拒绝左右分屏和平面假 3D。',
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
    description: '两颗真实芯片形态的 3D 剖视：CPU 四个大核心，GPU 密集小单元；同样 16 项任务进入晶粒、处理后输出。',
    status: 'React / Three.js 原生动画',
    component: CpuGpuScene,
    durationInFrames: 600,
    fps: 30,
    width: 1280,
    height: 720,
    notes: [
      '原生 Three.js 半导体封装剖视：方形封装基板、有限接点、硅晶粒，以及 CPU 2×2 大核心或 GPU 4×4 运算阵列；上盖揭开后持续可见内部结构。',
      '保留同一批 16 项真实任务轨迹：灰色方块由封装外进入硅晶粒内部，核心处理时变蓝，再从另一边离开成为结果。',
      'CPU 由四个大核心分四批处理；GPU 由 16 个轻量运算单元同步处理。最后镜头拉远，让两个芯片从相同输入重播。',
      '仅用于解释处理方式，不等于真实 CPU/GPU 微架构、时序、核心数量或性能跑分。',
    ],
  },
  {
    id: 'automatic-fire',
    compositionId: 'AutomaticFireScene',
    cover: {type: 'automatic-fire'},
    title: '連發的原理 · 槍機的循環',
    titleEn: 'AUTOMATIC FIRE / THE MECHANICAL CYCLE',
    category: '機械 / 三維剖視',
    description: '扳機持續按住，槍機退回與復進，下一次擊發如何自動接續？',
    status: 'React / Three.js 原生動畫',
    component: AutomaticFireScene,
    durationInFrames: 720,
    fps: 30,
    width: 1280,
    height: 720,
    notes: [
      '單一原生 3D 剖視模型；24 秒全程由 Three.js 依時間軸運算運鏡與機構，沒有 MP4 或圖片替代。',
      '概念示意：連發與半自動的關鍵差別在於持續扣住扳機後，前者能在自動循環中再次擊發；後者需重新扣動扳機。',
      '模型零件、尺寸及時序經刻意抽象，不代表真實槍械的設計、製造或改裝方式。',
    ],
  },
  // @mymg-generator-projects
];

export const getProject = (id: string): MgProject | undefined =>
  projects.find((project) => project.id === id);
