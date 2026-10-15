import React from 'react';

type Props = {eyebrow: string; title: string; subtitle?: string};

// Bounded translucent backing: captions must not blanket the 3D subject.
export const TitlePanel: React.FC<Props> = ({eyebrow, title, subtitle}) => (
  <div style={{
    position: 'absolute', zIndex: 2, top: 40, left: 50,
    maxWidth: 720, padding: '20px 30px 22px', borderRadius: 12,
    background: 'rgba(247, 243, 237, 0.88)',
    color: '#233038', fontFamily: '"Noto Sans CJK SC", "Microsoft YaHei", sans-serif',
    pointerEvents: 'none'
  }}>
    <div style={{color: '#AA4035', fontSize: 19, fontWeight: 700, letterSpacing: 1.2}}>
      {eyebrow}
    </div>
    <div style={{marginTop: 6, fontSize: 40, lineHeight: 1.22, fontWeight: 700}}>
      {title}
    </div>
    {subtitle ? <div style={{marginTop: 8, fontSize: 22, lineHeight: 1.4}}>
      {subtitle}
    </div> : null}
  </div>
);
