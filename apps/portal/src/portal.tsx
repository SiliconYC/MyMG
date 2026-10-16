import React, {useEffect, useRef, useState} from 'react';
import {Player, type PlayerRef} from '@remotion/player';
import {getProject, projects, type MgProject} from './catalog';

const readRoute = (): string => {
  const hash = window.location.hash;
  if (!hash || hash === '#' || hash === '#/') return '';
  return hash.startsWith('#/') ? decodeURIComponent(hash.slice(2)) : '';
};

const Brand: React.FC = () => (
  <a className="brand" href="#/" aria-label="MyMG 首页">
    <span className="brand-square" aria-hidden="true"><span/></span>
    <span>MY<span className="brand-accent">MG</span><small>LABORATORY</small></span>
  </a>
);

const HbmArtwork: React.FC = () => (
  <div className="artwork artwork-hbm" aria-hidden="true">
    <div className="chip-floor" />
    <div className="gpu-chip"><span>GPU</span></div>
    <div className="hbm-chip hbm-chip-a"><i/><i/><i/><i/></div>
    <div className="hbm-chip hbm-chip-b"><i/><i/><i/><i/></div>
    <div className="trace trace-one"/><div className="trace trace-two"/>
    <span className="artwork-label">3D / DRAM / TSV</span>
  </div>
);

const ProjectCard: React.FC<{project: MgProject; index: number}> = ({project, index}) => (
  <a className="project-card" href={`#/${encodeURIComponent(project.id)}`} data-testid={`project-${project.id}`}>
    <div className="project-art">
      {project.cover?.type === 'hbm' ? <HbmArtwork /> :
        project.cover?.type === 'image' ?
          <img className="artwork-cover" src={project.cover.src} alt={project.cover.alt} loading="lazy" /> :
          <div className="artwork artwork-placeholder" aria-hidden="true">
            <div className="placeholder-disc"/><div className="placeholder-orbit"/>
            <span>{project.titleEn}</span>
          </div>}
      <span className="card-index">{String(index+1).padStart(2,'0')} / {String(projects.length).padStart(2,'0')}</span>
      <span className="view-button">进入播放页 ↗</span>
    </div>
    <div className="project-description">
      <div className="card-kicker"><span>{project.category}</span><span className="status-dot"/> {project.status}</div>
      <div className="card-title">{project.title}</div>
      <p>{project.description}</p>
      <div className="card-footer">{(project.durationInFrames/project.fps).toFixed(1)} 秒　·　{project.width} × {project.height}　·　{project.fps} 帧/秒 <span>→</span></div>
    </div>
  </a>
);

const Home: React.FC = () => (
  <>
    <section className="hero page-container">
      <p className="eyebrow"><span className="eyebrow-line"/> MOTION GRAPHICS / EXPERIMENTAL WORKBENCH</p>
      <h1>让复杂的事物<br/><span>动</span>起来。</h1>
      <p className="hero-lead">MyMG 是一座持续生长的动态图形实验室。<br/>打开作品，直接在浏览器中观看、暂停、逐帧研究。</p>
      <div className="hero-meta"><span>React / TypeScript / Three.js</span><span>无需下载影片</span></div>
    </section>
    <section className="projects-section page-container" id="projects">
      <div className="section-title"><div><span className="section-count">01 / LIBRARY</span><h2>作品目录</h2></div><span className="section-side">{String(projects.length).padStart(2,'0')} PROJECTS</span></div>
      <div className="project-grid">{projects.map((p,index)=><ProjectCard key={p.id} project={p} index={index}/>)}</div>
    </section>
    <section className="note-section page-container"><div><span>WHY WE BUILD</span><p>这里存放的是技术原型，不是对外提供商用服务的产品。每一次实验都应该能够被播放、比较与复现。</p></div></section>
  </>
);

const ProjectPage: React.FC<{project: MgProject}> = ({project}) => {
  const playerRef = useRef<PlayerRef>(null);
  const masterRef = useRef<HTMLVideoElement>(null);
  const isHbmMaster = project.id === 'hbm';
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [mediaFailed, setMediaFailed] = useState(false);
  useEffect(() => {
    if (isHbmMaster) {
      const video = masterRef.current;
      if (!video) return;
      const onFrame = () => setFrame(Math.min(project.durationInFrames - 1,
        Math.max(0, Math.round(video.currentTime * project.fps))));
      const onPlay = () => setPlaying(true);
      const onPause = () => setPlaying(false);
      video.addEventListener('timeupdate', onFrame);
      video.addEventListener('seeked', onFrame);
      video.addEventListener('play', onPlay);
      video.addEventListener('pause', onPause);
      return () => {
        video.removeEventListener('timeupdate', onFrame);
        video.removeEventListener('seeked', onFrame);
        video.removeEventListener('play', onPlay);
        video.removeEventListener('pause', onPause);
      };
    }
    const player = playerRef.current;
    if (!player) return;
    const onFrame = (event: {detail: {frame: number}}) => setFrame(event.detail.frame);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    player.addEventListener('frameupdate', onFrame);
    player.addEventListener('play', onPlay);
    player.addEventListener('pause', onPause);
    return () => {
      player.removeEventListener('frameupdate', onFrame);
      player.removeEventListener('play', onPlay);
      player.removeEventListener('pause', onPause);
    };
  }, [project.id, project.durationInFrames, project.fps, isHbmMaster]);
  const seek = (target: number) => {
    const next = Math.max(0, Math.min(project.durationInFrames - 1, Math.round(target)));
    if (isHbmMaster) {
      const video = masterRef.current;
      if (!video) return;
      video.pause();
      video.currentTime = next / project.fps;
    } else {
      const player = playerRef.current;
      if (!player) return;
      player.pause();
      player.seekTo(next);
    }
    setFrame(next);
    setPlaying(false);
  };
  const step = (delta: number) => seek(
    (isHbmMaster ? frame : (playerRef.current?.getCurrentFrame() ?? frame)) + delta);
  const togglePlayback = () => {
    if (isHbmMaster) {
      const video = masterRef.current;
      if (!video) return;
      if (!video.paused) video.pause();
      else void video.play().catch(() => setMediaFailed(true));
      return;
    }
    const player = playerRef.current;
    if (!player) return;
    if (playing) player.pause();
    else player.play();
    setPlaying(!playing);
  };
  return (
    <main className="project-page page-container" data-testid="project-player-page">
      <a href="#/" className="back-link">←　返回所有作品</a>
      <div className="detail-head"><div><div className="eyebrow detail-kicker">{project.titleEn}</div><h1>{project.title}</h1><p>{project.description}</p></div><span className="status-pill">{project.status}</span></div>
      <div className="player-shell" data-testid="player-shell">
        {isHbmMaster ? (
          <>
            <video ref={masterRef} data-testid="hbm-master-video"
              src={`${import.meta.env.BASE_URL}media/hbm-mustard03.mp4`}
              poster={`${import.meta.env.BASE_URL}media/hbm-poster.jpg`}
              preload="auto" playsInline loop
              aria-label="HBM Mustard-03 Python 原版完整影片"
              onError={() => setMediaFailed(true)}
              style={{width:'100%',aspectRatio:'16 / 9',display:'block',background:'#eeeae1'}}
            />
            {mediaFailed && <div className="player-error" role="alert">
              HBM 正式影片加载失败。请检查 Pages 媒体资源部署。
            </div>}
          </>
        ) : (
          <Player ref={playerRef} key={project.id} component={project.component}
            compositionWidth={project.width} compositionHeight={project.height}
            fps={project.fps} durationInFrames={project.durationInFrames}
            loop
            style={{width: '100%', aspectRatio: `${project.width} / ${project.height}`, display:'block'}}
            errorFallback={({error}) => <div className="player-error" role="alert">播放器运行出错：{error.message}</div>}
          />
        )}
      </div>
      <div className="transport" data-testid="transport">
        <button type="button" data-testid="play-toggle" onClick={togglePlayback}
          aria-label={playing ? '暂停播放' : '开始播放'}>{playing ? '暂停' : '播放'}</button>
        <input type="range" min={0} max={project.durationInFrames-1} step={1}
          value={frame} onChange={event=>seek(Number(event.currentTarget.value))}
          aria-label="播放进度" data-testid="frame-slider" />
        <output data-testid="frame-readout" aria-live="off">{frame}</output>
        <span>/ {project.durationInFrames-1} 帧</span>
      </div>
      <div className="playbar"><div className="frame-actions"><button type="button" onClick={()=>step(-1)} aria-label="后退一帧">← 前一帧</button><button type="button" onClick={()=>step(1)} aria-label="前进一帧">后一帧 →</button></div><span>{project.width} × {project.height} · {project.fps} FPS · {(project.durationInFrames/project.fps).toFixed(1)}S</span></div>
      {isHbmMaster && <div className="master-link">
        <span>画面源：Python Mustard-03（同源生成）</span>
        <a href={`${import.meta.env.BASE_URL}media/hbm-python-original.mp4`} download>查看原始 MP4 ↗</a>
      </div>}
      <div className="project-notes"><div className="notes-title">关于这项实验</div>{project.notes.map(note=><p key={note}>{note}</p>)}</div>
      <div className="other-projects"><a href="#/">← 浏览全部 MG 项目</a></div>
    </main>
  );
};

export const App: React.FC = () => {
  const [route,setRoute] = useState(readRoute);
  useEffect(() => {
    const onHash = () => {setRoute(readRoute()); window.scrollTo({top: 0,behavior:'instant'});};
    window.addEventListener('hashchange',onHash);
    return ()=>window.removeEventListener('hashchange',onHash);
  },[]);
  const project = route ? getProject(route) : undefined;
  useEffect(()=>{document.title=project ? `${project.title} | MyMG` : 'MyMG — 动态图形实验室';},[project]);
  return <div className="site-root">
    <header className="site-header"><div className="page-container nav-inner"><Brand/><a href="#/" className="nav-projects">全部项目 <span>↗</span></a></div></header>
    {route ? (project ? <ProjectPage project={project}/> : <main className="page-container not-found"><h1>没有找到该项目</h1><a href="#/">返回作品目录 →</a></main>) : <Home/>}
    <footer className="site-footer"><div className="page-container footer-inner"><span>MYMG / MOTION GRAPHICS LAB</span><span>EXPERIMENTS, NOT PRODUCTS · © 2026</span></div></footer>
  </div>;
};
