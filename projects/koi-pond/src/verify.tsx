import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { KoiPond } from './pond/KoiPond';
import './page.css';

function Review() {
  const [mounted, setMounted] = useState(true);
  const [badAssets, setBadAssets] = useState(false);
  return <main style={{maxWidth:760,margin:'30px auto',padding:20}}>
    <h1 style={{fontSize:28,letterSpacing:0}}>Component lifecycle review</h1>
    <p>Development-only checks for cleanup, remounting, and the asset-error fallback.</p>
    <div style={{display:'flex',gap:16,marginBottom:24}}>
      <button onClick={() => setMounted(value => !value)}>{mounted ? 'Unmount pond' : 'Mount pond'}</button>
      <button onClick={() => setBadAssets(value => !value)}>{badAssets ? 'Restore artwork' : 'Simulate missing artwork'}</button>
    </div>
    {mounted ? <KoiPond assetBase={badAssets ? '/missing-art' : '/art'} /> : <p role="status">Pond unmounted.</p>}
  </main>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><Review/></StrictMode>);
