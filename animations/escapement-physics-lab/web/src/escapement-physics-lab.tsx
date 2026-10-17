import React, {useEffect, useRef, useState} from 'react';
import {useCurrentFrame} from 'remotion';
import {EscapementSimulation, initRapier, runAudit, STEP, PARAMETERS,
  LAB_VERSION, type Mode, type Point, type Readout, type Solid} from './physics-lab';
import {grahamPallet} from './graham-geometry';

// Anchor arms connect to the BACK of the actual working pallets, not their tips.
const entryPallet = grahamPallet('left');
const exitPallet = grahamPallet('right');
const X = (x: number) => 640 + 88 * x;
const Y = (y: number) => 388 - 88 * y;
const fmt = (x: number, digits = 3) => Number.isFinite(x) ? x.toFixed(digits) : 'NaN';
const path = (points: readonly Point[]) =>
  points.map((p, i) => (i === 0 ? 'M' : 'L') + X(p[0]).toFixed(2) + ' ' + Y(p[1]).toFixed(2)).join(' ') + ' Z';
const transform = (solid: Solid, angle: number) => {
  const x = solid.owner === 'anchor' ? 0 : 0;
  const y = solid.owner === 'anchor' ? PARAMETERS.pivotY : 0;
  return `translate(${X(x)} ${Y(y)}) rotate(${-angle * 180 / Math.PI}) translate(${-X(0)} ${-Y(0)})`;
};
function circlePosition(p: Point, angle: number, anchor: boolean): Point {
  const [x,y] = p;
  return [x * Math.cos(angle) - y * Math.sin(angle),
    x * Math.sin(angle) + y * Math.cos(angle) + (anchor ? PARAMETERS.pivotY : 0)];
}
function SolidShape({solid, angle, contact}: {solid: Solid; angle: number; contact: boolean}) {
  const isAnchor = solid.owner === 'anchor';
  const material = solid.side ? (contact ? '#ffc875' : '#83d7c8') :
    solid.name === 'bob' ? '#d4ac73' :
    solid.name === 'hub' ? '#c6aa7f' :
    solid.name.startsWith('rim-') ? '#a88962' :
    solid.name.startsWith('spoke-') ? '#bda079' : '#e5c08d';
  if (solid.kind === 'circle' && solid.center && solid.radius) {
    const point = circlePosition(solid.center, angle, isAnchor);
    return <circle data-model-part={solid.name} cx={X(point[0])} cy={Y(point[1])} r={solid.radius * 88}
      fill={material} stroke="#f5d9a8" strokeWidth={solid.name === 'hub' ? 1.8 : 1.1}/>;
  }
  const rim = solid.name.startsWith('rim-');
  return <path data-model-part={solid.name} d={path(solid.vertices ?? [])} transform={transform(solid, angle)}
    fill={material} stroke={rim ? 'none' : solid.side ? '#d2f7ed' : '#edd6b6'}
    strokeWidth={rim ? 0 : solid.side ? 1.6 : 0.75} />;
}
declare global {
  interface Window {
    __mymgEscapementLab?: {
      version: string;
      audit: (seconds: 10 | 60, mode?: Mode) => ReturnType<typeof runAudit>;
      state: () => Readout | null;
      replay: (frame: number, mode?: Mode) => Readout;
    };
  }
}
export const EscapementLabScene: React.FC = () => {
  const frame = useCurrentFrame();
  const sim = useRef<EscapementSimulation | null>(null);
  const [state, setState] = useState<Readout | null>(null);
  const [solids, setSolids] = useState<Solid[]>([]);
  const [failure, setFailure] = useState('');
  const [mode, setMode] = useState<Mode>('full');
  const generation = useRef(0);
  useEffect(() => {
    const stamp = ++generation.current;
    initRapier().then(() => {
      if (stamp !== generation.current) return;
      const reset = (nextMode: Mode) => {
        sim.current?.free();
        sim.current = new EscapementSimulation(nextMode);
        setSolids(sim.current.solids);
        return sim.current;
      };
      const initial = reset(mode);
      setState(initial.read());
      window.__mymgEscapementLab = {
        version: LAB_VERSION,
        audit: runAudit,
        state: () => sim.current?.read() ?? null,
        replay: (target, nextMode = 'full') => {
          const instance = new EscapementSimulation(nextMode);
          try {return instance.advanceToStep(Math.max(0,Math.floor(target)) * 8);}
          finally {instance.free();}
        },
      };
    }).catch(e => setFailure(String(e)));
    return () => {
      generation.current++;
      sim.current?.free();
      sim.current = null;
      delete window.__mymgEscapementLab;
    };
  }, [mode]);
  useEffect(() => {
    const instance = sim.current;
    if (!instance) return;
    try {
      let current = instance;
      const target = frame * 8; // 30 FPS portal, 240 Hz Rapier steps.
      if (target < instance.read().step) {
        instance.free();
        current = new EscapementSimulation(mode);
        sim.current = current;
        setSolids(current.solids);
      }
      setState(current.advanceToStep(target));
    } catch(e) {setFailure(String(e));}
  }, [frame, mode, solids]);

  const angleWheel = state?.wheelAngle ?? 0;
  const angleAnchor = state?.anchorAngle ?? 0;
  const a = ([x,y]: Point): Point => circlePosition([x,y], angleAnchor, true);
  const baseLeft = a(entryPallet[5]);
  const baseRight = a(exitPallet[3]);
  const pivot: Point = [0, PARAMETERS.pivotY];
  const bob = a([0, -PARAMETERS.pendulumLength]);
  const passed = mode === 'single' ? '单齿碰撞夹具 · 不代表完整机构' :
    state?.status === 'CANDIDATE' ? '接触实验达到候选门槛 · 尚非机械认证' :
    state?.status === 'FAILED' ? '物理实验失败 · 实验未通过物理验证' :
    '采集中 · 至少运行 10 秒后评估';
  return <div data-testid="escapement-physics-lab-scene"
    data-physics-engine={LAB_VERSION}
    data-lab-step={state?.step ?? 0}
    data-lab-alternations={state?.alternations ?? 0}
    data-lab-status={state?.status ?? 'UNVERIFIED'}
    data-wheel-structure="open-rim-six-spokes"
    style={{width:'100%',height:'100%',background:'#091721',position:'relative',color:'#e8f0f2',
      fontFamily:'system-ui, sans-serif',overflow:'hidden'}}>
    <svg viewBox="0 0 1280 720" width="100%" height="100%" role="img"
      aria-label="二维机械实验：Rapier 刚体碰撞驱动的擒纵轮与双片擒纵瓦">
      <rect width="1280" height="720" fill="#091721"/>
      <g opacity=".28" stroke="#54768d" fill="none">
        <path d="M 640 35 V 716 M 360 445 H 920" strokeDasharray="4 9"/>
      </g>
      <text x="38" y="57" fill="#dcebf3" fontSize="26" letterSpacing="1.6">ESCAPEMENT / PHYSICS LAB</text>
      <text x="40" y="88" fill="#88a3b7" fontSize="15">RAPIER 2D · Graham 静止式擒纵 · 30 齿 / 7.5 齿跨距 · 真实刚体试验</text>
      <g stroke="#607f95" strokeWidth="2" fill="none">
        <path d={`M ${X(pivot[0])} ${Y(pivot[1])} L ${X(bob[0])} ${Y(bob[1])}`}
          stroke="#7a8496" strokeDasharray="10 5" strokeWidth="5"/>
        <path d={`M ${X(pivot[0])} ${Y(pivot[1])} L ${X(baseLeft[0])} ${Y(baseLeft[1])}`}
          stroke="#a9d2ce" strokeWidth="13" strokeLinecap="square"/>
        {mode === 'full' && <path d={`M ${X(pivot[0])} ${Y(pivot[1])} L ${X(baseRight[0])} ${Y(baseRight[1])}`}
          stroke="#a9d2ce" strokeWidth="13" strokeLinecap="square"/>}
      </g>
      <g>
        {solids.filter(s => s.owner === 'wheel').map(s =>
          <SolidShape key={s.name} solid={s} angle={angleWheel} contact={false}/>)}
        {solids.filter(s => s.owner === 'anchor').map(s =>
          <SolidShape key={s.name} solid={s} angle={angleAnchor}
            contact={Boolean(s.side && state?.contactNow[s.side])}/>)}
        <circle cx={X(0)} cy={Y(0)} r="10" fill="#0e1721" stroke="#dcebf3" strokeWidth="3"/>
        <circle cx={X(0)} cy={Y(PARAMETERS.pivotY)} r="12" fill="#0e1721" stroke="#dcebf3" strokeWidth="3"/>
      </g>
      <g fontSize="15" fill="#87a7ba">
        <text x="782" y="143">共用摆轴 / REVOLUTE</text>
        <text x="932" y="444">30 齿擒纵轮</text>
      </g>
      <g fontSize="17" fill="#cad6df">
        <text x="40" y="148">轮角度  {fmt(angleWheel * 180 / Math.PI,2)}°</text>
        <text x="40" y="178">轮角速度  {fmt(state?.wheelOmega ?? 0)} rad/s</text>
        <text x="40" y="210">摆角度  {fmt(angleAnchor * 180 / Math.PI,2)}°</text>
        <text x="40" y="242">摆角速度  {fmt(state?.anchorOmega ?? 0)} rad/s</text>
        <text x="40" y="282">左瓦接触  {state?.contactCount.left ?? 0}</text>
        <text x="40" y="313">右瓦接触  {state?.contactCount.right ?? 0}</text>
        <text x="40" y="344">左右交替  {state?.alternations ?? 0}</text>
        <text x="40" y="385">总冲量  {fmt(state?.totalImpulse ?? 0,5)} N·s</text>
        <text x="40" y="418">最大穿透  {fmt(state?.maxPenetration ?? 0,5)} 模型单位</text>
        <text x="40" y="461">持续锁停  {fmt(state?.longestStuck ?? 0,2)} s</text>
        <text x="40" y="494">倒转累计  {fmt(state?.reverse ?? 0,3)} rad</text>
      </g>
      <rect x="38" y="630" width="555" height="55" rx="6" fill="#142430" stroke="#3c5b68"/>
      <text x="53" y="653" fill={state?.status === 'FAILED' ? '#ffb68d' : '#a8e0cd'} fontSize="18">{passed}</text>
      <text x="53" y="674" fill="#8eacbc" fontSize="13">
        {state ? `${fmt(state.time,2)} s / 60 s · ${state.step} steps · ${mode === 'single' ? '单齿夹具' : '完整机构'}` : 'Rapier WASM 初始化中…'}
      </text>
      {failure && <text x="40" y="601" fill="#ff8f8f" fontSize="17">物理引擎错误：{failure.slice(0,92)}</text>}
    </svg>
    <div style={{position:'absolute',right:18,top:18,display:'flex',gap:8,fontSize:13}}>
      <button type="button" data-testid="lab-mode-full" onClick={()=>setMode('full')}
        style={{background:mode==='full'?'#406474':'#1e3442',color:'#fff',border:'1px solid #7293a3',borderRadius:5,padding:'5px 10px'}}>30 齿 / 双瓦</button>
      <button type="button" data-testid="lab-mode-single" onClick={()=>setMode('single')}
        style={{background:mode==='single'?'#406474':'#1e3442',color:'#fff',border:'1px solid #7293a3',borderRadius:5,padding:'5px 10px'}}>单齿夹具</button>
    </div>
  </div>;
};
