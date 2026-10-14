import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { PondRenderer, PondStats, PondStyle } from './renderer';
import { WORLD } from './simulation';
import './koi-pond.css';

export type KoiPondProps = {
  initialStyle?: PondStyle;
  /** Directory containing the pond bed, koi atlas, scenery atlas, and poster. */
  assetBase?: string;
  className?: string;
  onStyleChange?: (style: PondStyle) => void;
};

const styles: { value: PondStyle; label: string; note: string }[] = [
  { value: 'watercolor', label: 'Watercolor', note: 'Pigment, paper & a little life.' },
  { value: 'graphite', label: 'Graphite', note: 'Soft graphite, warm paper & a little grain.' },
  { value: 'blue', label: 'Blue pencil', note: 'Loose blue strokes on a cool sheet of paper.' },
];

export function KoiPond({ initialStyle = 'watercolor', assetBase = `${import.meta.env.BASE_URL}art`, className = '', onStyleChange }: KoiPondProps) {
  const [style, setStyle] = useState<PondStyle>(initialStyle);
  const [paused, setPaused] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [stats, setStats] = useState<PondStats>({ time: 0, ripples: 0, fps: 60 });
  const [message, setMessage] = useState('');
  const [feeding, setFeeding] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<PondRenderer | null>(null);
  const live = useRef({ style, paused });
  live.current = { style, paused };
  const gesture = useRef<{ x: number; y: number; moved: boolean; id: number } | null>(null);
  const lastRipple = useRef(0);
  const messageTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const helpId = useId();

  useEffect(() => {
    const abort = new AbortController();
    let renderer: PondRenderer | null = null;
    setReady(false); setError(false);
    const element = host.current;
    if (!element) return;
    import('./renderer').then(({ createRenderer }) => abort.signal.aborted ? null :
      createRenderer(element, { assetBase, style: live.current.style, paused: live.current.paused,
        onStats: setStats, signal: abort.signal })).then(result => {
      if (!result) return;
      if (abort.signal.aborted) { result.destroy(); return; }
      renderer = result; engine.current = result;
      result.setStyle(live.current.style); result.setPaused(live.current.paused);
      setReady(true);
    }).catch(cause => {
      if (abort.signal.aborted) return;
      console.error('Pond initialization failed:', cause); setError(true);
    });
    return () => { abort.abort(); renderer?.destroy(); engine.current = null; };
  }, [assetBase, attempt]);
  useEffect(() => { engine.current?.setStyle(style); }, [style]);
  useEffect(() => { engine.current?.setPaused(paused); }, [paused]);
  useEffect(() => () => clearTimeout(messageTimer.current), []);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => { if (media.matches) setPaused(true); };
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);

  function announce(text: string) {
    setMessage(text); clearTimeout(messageTimer.current);
    messageTimer.current = setTimeout(() => setMessage(''), 3500);
  }
  function choose(value: PondStyle) { setStyle(value); onStyleChange?.(value); }
  function touchWater(point?: { x: number; y: number }) {
    if (!ready || paused) return;
    if(feeding)engine.current?.feed(point);
    else engine.current?.disturb(point, 1.35);
  }
  function point(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / rect.width * WORLD.width,
      y: (event.clientY - rect.top) / rect.height * WORLD.height };
  }
  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const p = point(event);
    const drag = gesture.current;
    if (drag && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 6) drag.moved = true;
    const now = performance.now();
    if (ready && !paused && now - lastRipple.current > (drag ? 110 : 280)) {
      engine.current?.disturb(p, drag ? .30 : .12); lastRipple.current = now;
    }
  }
  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0) return;
    gesture.current = { x: event.clientX, y: event.clientY, moved: false, id: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
    touchWater(point(event));
  }
  function pointerUp(event: PointerEvent<HTMLDivElement>) {
    const drag = gesture.current;
    if (!drag || drag.id !== event.pointerId) return;
    gesture.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function keyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if(!event.repeat){touchWater();announce(feeding?'A few morsels settle on the water.':'A ripple crosses the pond.');} }
    if (event.key.toLowerCase() === 'p') setPaused(value => !value);
  }

  return <section className={`koi-component ${className}`} data-style={style}
    data-simulation-time={stats.time.toFixed(2)} data-ripples={stats.ripples} data-fps={stats.fps.toFixed(1)}
    aria-label="Interactive koi pond">
    <div className="medium-toolbar"><span className="toolbar-label" aria-hidden="true">THE MEDIUM</span>
    <div className="medium-picker" role="radiogroup" aria-label="Drawing medium">
      {styles.map((s, index) => <button key={s.value} type="button" role="radio"
        aria-checked={style === s.value} tabIndex={style === s.value ? 0 : -1}
        className={`medium-option ${style === s.value ? 'is-selected' : ''}`}
        onClick={() => choose(s.value)} onKeyDown={event => {
          let next: number | undefined;
          if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % styles.length;
          if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index + styles.length - 1) % styles.length;
          if (event.key === 'Home') next = 0;
          if (event.key === 'End') next = styles.length - 1;
          if (next !== undefined) {
            event.preventDefault(); choose(styles[next].value);
            (event.currentTarget.parentElement?.children[next] as HTMLButtonElement)?.focus();
          }
        }}>
        <span className={`medium-swatch swatch-${s.value}`} aria-hidden="true" /><span>{s.label}</span>
      </button>)}
    </div>
    </div>

    <div className={`pond-frame ${paused ? 'is-paused' : ''} ${ready ? 'is-ready' : ''}`}>
      <div className="pond-surface" ref={host} role="group" tabIndex={0}
        aria-label={feeding?'Living koi pond. Tap the water or press Enter to scatter food. Press P to pause or resume.':'Living koi pond. Tap a fish or nearby water to watch it dart away. Press Enter for ripples. Press P to pause or resume.'}
        aria-describedby={helpId}
        onPointerDown={pointerDown} onPointerUp={pointerUp} onPointerMove={pointerMove}
        onPointerCancel={() => { gesture.current = null; }} onLostPointerCapture={() => { gesture.current = null; }}
        onKeyDown={keyboard} />
      {!ready && <div className="pond-poster">
        <img src={`${assetBase}/poster.webp`} alt="Three watercolor koi in a jade pond on textured paper" />
        <div className="loading-label" role="status">{error ? <>
          The live pond couldn’t open. <button onClick={() => setAttempt(n => n + 1)}>Try again</button>
        </> : 'Letting the water settle…'}</div>
      </div>}
      {paused && ready && <div className="paused-label">A still moment</div>}
      <div className="pond-signature" aria-hidden="true"><span>静</span><small>stillwater</small></div>
    </div>

    <div className="pond-caption"><span className="caption-line" /><span>{styles.find(s => s.value === style)?.note}</span><span className="caption-line" /></div>
    <div className="pond-tools">
      <div className="pond-presence"><span className={`living-dot ${paused ? 'resting' : ''}`} /><span>Three koi. <span className="presence-soft">{paused ? 'Resting for a moment.' : 'Nowhere to be.'}</span></span></div>
      <div className="pond-actions">
        <button className="feed-mode" type="button" aria-pressed={feeding} disabled={!ready} onClick={()=>{setFeeding(value=>!value);announce(feeding?'Tap the water to make ripples.':'Tap the water to scatter food. The koi will come closer.');}}><FoodIcon /><span>Feed koi</span></button>
        <button className="ripple-button" type="button" disabled={!ready || paused} onClick={() => touchWater()}><RippleIcon /><span>{feeding?'Scatter food':'Touch the water'}</span></button>
        <span className="tool-divider" />
        <button className="pause-button" type="button" disabled={!ready} onClick={() => setPaused(value => !value)}
          aria-label={paused ? 'Resume swimming' : 'Pause swimming'} title={paused ? 'Resume swimming (P)' : 'Pause swimming (P)'}>
          {paused ? <PlayIcon /> : <PauseIcon />}
        </button>
      </div>
    </div>
    <div className="pond-help" id={helpId}>
      <span className="help-default">{feeding?'Tap to leave a few morsels. Let the koi come to you.':'Tap near a koi to startle it. Or feed them and watch them come closer.'}</span>
      <span className="help-feedback" role="status" aria-live="polite">{message}</span>
    </div>
  </section>;
}

function RippleIcon() { return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true"><ellipse cx="12" cy="15" rx="9" ry="4" stroke="currentColor" strokeWidth="1"/><ellipse cx="12" cy="14" rx="4.5" ry="2" stroke="currentColor" strokeWidth="1"/><path d="M12 4v5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>; }
function FoodIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 17c4 3 12 3 16-1M8 7l1 .4M16 5l.6 .6M13 12l.8 .4M6 12l.5 .6M19 11l.4 .7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>; }
function PauseIcon() { return <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M7 5v10M13 5v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>; }
function PlayIcon() { return <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m7 4 9 6-9 6V4Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>; }
