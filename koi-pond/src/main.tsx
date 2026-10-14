import React from 'react';
import ReactDOM from 'react-dom/client';
import { KoiPond } from './pond/KoiPond';
import './page.css';

function App() {
  return <>
    <header className="site-header">
      <a className="wordmark" href="./" aria-label="Stillwater home"><svg width="33" height="33" viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M18 41C4 15 50 6 42 30c-4 12-20 20-28 9M43 29l13 4-8-12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/><circle cx="20" cy="28" r="1.5" fill="currentColor"/></svg><span>stillwater<span className="wordmark-period">.</span></span></a>
      <span className="header-note">SMALL MOMENTS, SLOWLY MADE</span>
      <span className="study-number">An interactive study <span>№ 001</span></span>
    </header>
    <main className="sketchbook">
      <div className="introduction"><div className="eyebrow"><span />A LIVING SKETCHBOOK</div><h1>A little<br className="title-break" />{' '}<em>stillness.</em></h1><p>A small world, going at its own pace.<br /> Leave a ripple. Stay a while.</p>
        <div className="margin-note"><svg width="78" height="35" viewBox="0 0 78 35" fill="none" aria-hidden="true"><path d="M18 13c-12 2-14 10 1 13 15 3 36 2 42-4M29 12c-10 2-10 7 1 9 12 2 24 0 24-4M38 13c-5 0-8 3-3 4 6 2 12 0 9-2M6 29c20 5 50 5 64-3" stroke="currentColor" strokeWidth=".8" strokeLinecap="round"/></svg><span>Nothing to finish.<br />Just a little time to yourself.</span></div>
        <div className="study-label"><span>FIELD NOTES</span><span>001 / THE KOI POND</span></div>
      </div>
      <div className="pond-wrap"><KoiPond /></div>
    </main>
    <footer className="site-footer"><span>Paper, pigment & a little life.</span><span>There’s no hurry here. <svg width="21" height="10" viewBox="0 0 28 12" fill="none" aria-hidden="true"><path d="M1 6c8-3 15 3 23 0m-5-4 5 4-5 4" stroke="currentColor" strokeLinecap="round"/></svg></span></footer>
  </>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
