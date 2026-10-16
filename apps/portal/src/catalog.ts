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
    description: '重点定格正面、背面及两块擒纵瓦的锁止与放行细节；视角间快速绕行，摆钟机架简化到必要轴承。',
    status: 'React / Three.js 原生动画',
    component: PendulumClockScene,
    durationInFrames: 1800,
    fps: 30,
    width: 1280,
    height: 720,
    notes: [
      '30 齿擒纵轮，钟摆每两秒完整往复一次；左右擒纵瓦交替锁止，轮子每秒只走 6°。',
      '秒针与擒纵轮共用同一角度，经过 60 次节拍恰好转一整圈；暂停、拖动与逐帧状态完全一致。',
      '前后同一套 3D 机构：连续摆杆与擒纵轮、立体楔形擒纵瓦（锁止面、冲量面）、秒针；删除装饰性机架。',
      '摄影机采用定点慢移观察与短促快速绕行，分别聚焦入端瓦、出端瓦及秒针；不再匀速绕圈。',
      '为便于观察，齿形、摆幅及释放动作均是教学示意；并非可直接加工的物理仿真机芯。',
    ],
  },
  {
    id: 'steam-engine',
    compositionId: 'SteamEngineScene',
    cover: {type: 'steam'},
    title: '蒸汽机 · 离心调速',
    titleEn: 'STEAM ENGINE / 3D CUTAWAY',
    category: '机械 / 三维剖面',
    description: '20 秒动态特写：看清飞轮加速、重锤张开、套筒升降与负反馈。',
    status: 'React / Three.js 实时剖切',
    component: SteamEngineScene,
    durationInFrames: 600,
    fps: 30,
    width: 1280,
    height: 720,
    notes: ['动态剖面与飞轮、皮带、重锤和进汽节流阀的负反馈联动。'],
  },
  {
    id: 'cpu-gpu',
    compositionId: 'CpuGpuScene',
    cover: {type: 'cpu-gpu'},
    title: 'CPU 与 GPU：两种计算方式',
    titleEn: 'CPU / GPU · PARALLEL COMPUTE',
    category: '芯片 / 三维运算架构',
    description: '前 14 秒完整保留 GPU 同质并行优势；后 14 秒用 16 个球、立方体、四面体与圆柱展示 CPU 对分歧任务的优势。',
    status: 'React / Three.js 原生动画',
    component: CpuGpuScene,
    durationInFrames: 840,
    fps: 30,
    width: 1280,
    height: 720,
    notes: [
      '无 CPU/GPU 身份的独立运算单元先演示“输入 +1”：白色方块掠过清晰可见的浅色核心，表面完成计算后变成蓝色，到外部结果台停稳；绝不被半透明外壳吞没。',
      '两颗芯片使用完全相同的任务运动算法：CPU 四个大核心分四批处理，GPU 十六个小单元一次并行处理。两边的 4×4 输入和结果阵列都远离芯片封装。',
      '运镜加速：CPU 转 GPU 只有约 1 秒。镜头围绕目标真实旋转、改变俯仰高度并短暂拉远，而非只有匀速平移与缩放。',
      '前 420 帧完全保留原先 GPU 擅长的 16 个同类任务，后 420 帧无剪切衔接 16 个混合形状任务。全程原生 Three.js 实时计算，非视频。',
      '第二幕：CPU 四个独立核心可同时处理不同控制流；GPU 模拟同一线程组的 4 条分歧执行路径，其他通道暂时掩码等待，四组依次激活。',
      '形状仅代表分歧执行路径，不能推出 GPU 执行异形物件就慢，也不表示 CPU 对全部异质任务必然胜出。演示时序不是实测硬件性能。',
      '全长 28 秒，38° 透视运镜，全程仅一条简短字幕。',
    ],
  },
  {
    id: 'automatic-fire',
    compositionId: 'AutomaticFireScene',
    cover: {type: 'automatic-fire'},
    title: '連發的原理 · 槍機的循環',
    titleEn: 'AUTOMATIC FIRE / THE MECHANICAL CYCLE',
    category: '機械 / 三維剖視',
    description: '一個完整的 3D 機械剖面：鏡頭進入機匣，看連發動作如何一遍遍接續。',
    status: 'React / Three.js 原生動畫',
    component: AutomaticFireScene,
    durationInFrames: 720,
    fps: 30,
    width: 1280,
    height: 720,
    notes: [
      '第二版全新立體模型，具有倒角槍托、護木、機匣及抽離的側蓋；24 秒運鏡包含推近、環繞、追拍與復位。',
      '概念示意：連發與半自動的關鍵差別在於持續扣住扳機後，前者能在自動循環中再次擊發；後者需重新扣動扳機。',
      '模型零件、尺寸及時序經刻意抽象，不代表真實槍械的設計、製造或改裝方式。',
    ],
  },
  // @mymg-generator-projects
];

export const getProject = (id: string): MgProject | undefined =>
  projects.find((project) => project.id === id);
