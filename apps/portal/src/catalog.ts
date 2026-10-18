import type {ComponentType} from 'react';
import {HbmMustard03Native} from '@mymg/hbm';
import {DemoScene} from '@mymg/demo';
import {PendulumClockScene} from '@mymg/pendulum-clock';
import {SteamEngineScene} from '@mymg/steam-engine';
import {CpuGpuScene} from '@mymg/cpu-gpu';
import {AutomaticFireScene} from '@mymg/automatic-fire';
import {EscapementLabScene} from '@mymg/escapement-physics-lab';
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
    description: '从整钟转到擒纵特写：看轮齿交替承接、推动钟摆，以及反冲式锚擒纵特有的短暂倒转。',
    status: 'React / Three.js 原生动画',
    component: PendulumClockScene,
    durationInFrames: 900,
    fps: 30,
    width: 1280,
    height: 720,
    notes: [
      '30 齿反冲式锚擒纵；两面有限斜瓦交替承接轮齿，摆向外运动时会把轮子短暂推回。',
      '运动由重力、恒定轮轴力矩、阻尼与单侧接触冲量求解；约两秒往复，节拍来自真实承接事件。',
      '细钢锚叉与黄铜轮共用可见和碰撞轮廓；秒针与轮轴保持固定角度关系，也呈现细微反冲。',
      '影片压缩为 30 秒：整钟、背面、擒纵瓦接触和秒针反冲四个视角，过场短促。',
      '两条连杆是以顶部转轴为最高点的同一抛物线两翼，末端接入固定擒纵瓦；秒针按真实时间运行。',
      '固定子步与缓存保证暂停、拖动和重播一致；属于理想固定轴刚体教学模型，不包含完整钟表轮系。',
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
    description: '两轮 16 项任务：同质并行由 GPU 胜出；明确转场后，复杂分歧任务由 CPU 胜出。原生透视运镜。',
    status: 'React / Three.js 原生动画',
    component: CpuGpuScene,
    durationInFrames: 744,
    fps: 30,
    width: 1280,
    height: 720,
    notes: [
      '两颗芯片使用完全相同的任务运动算法：CPU 四个大核心分四批处理，GPU 十六个小单元一次并行处理。两边的 4×4 输入和结果阵列都远离芯片封装。',
      '运镜加速：CPU 转 GPU 只有约 1 秒。镜头围绕目标真实旋转、改变俯仰高度并短暂拉远，而非只有匀速平移与缩放。',
      '移除原先 96 帧单方块运算示意，前 324 帧直接展示 GPU 擅长的 16 个同类任务，后 420 帧接续混合形状任务。全程原生 Three.js 实时计算，非视频。',
      '第二幕：CPU 四个独立核心可同时处理不同控制流；GPU 模拟同一线程组的 4 条分歧执行路径，其他通道暂时掩码等待，四组依次激活。',
      '形状仅代表分歧执行路径，不能推出 GPU 执行异形物件就慢，也不表示 CPU 对全部异质任务必然胜出。演示时序不是实测硬件性能。',
      '第一轮结果于第二轮开始前全部淡出，并从 Three.js 场景树卸载；不会与第二轮几何体重叠。',
      '第一轮与第二轮均用同样的小型无底框章节标题开场（01 / 16 个相同任务、02 / 16 个混合任务），保留双晶片视角；以轻量扫场换轮。',
      'GPU/CPU 胜出时在对应晶片上点亮细线轮廓，并在晶片下方出现短暂、无底框的结果标签。始终避免遮住主要 3D 动画。',
      '全长 24.8 秒，38° 透视运镜。章节及胜负标签统一排版、平滑淡入淡出、克制而一致；仍为实时 WebGL 动画。',
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
  {
    id: 'escapement-physics-lab',
    compositionId: 'EscapementPhysicsLabScene',
    title: '擒纵机构 · Rapier 物理实验室',
    titleEn: 'RAPIER 2D / ESCAPEMENT CONTACT EXPERIMENT',
    category: '机械 / 真实碰撞试验',
    description: '独立于摆钟正片的 2D 刚体可行性实验。展示物理碰撞、卡滞和穿透；不预设正确摆动。',
    status: '技术实验 · 接触候选，尚非机械认证',
    component: EscapementLabScene,
    durationInFrames: 1800,
    fps: 30,
    width: 1280,
    height: 720,
    notes: [
      '两独立转动刚体，固定轴铰链、恒定齿轮力矩、重力钟摆；齿面和擒纵瓦均是 Rapier 实体凸碰撞体。',
      '固定 240 Hz 时间步，进度拖动后重放真实物理计算，不以角度插值或定时放行模拟啮合。',
      '10/60 秒物理结果必须由真实浏览器接触、冲量、倒转、穿透与锁死审计判定；当前实验候选不代表可加工的钟表机械认证。',
      '二维中摆杆和叉臂只展示机构拓扑，不承担碰撞；不代表三维装配干涉或工业可制造性已经验证。',
    ],
  },
  // @mymg-generator-projects
];

export const getProject = (id: string): MgProject | undefined =>
  projects.find((project) => project.id === id);
