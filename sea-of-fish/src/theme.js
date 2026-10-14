// Two looks for the same drawing: cream paper by day, a deep-ink night with chalky lines.
// Canvas code reads `theme` every frame, so switching is just Object.assign + a redraw.
// CSS has matching tokens under :root[data-theme='dark'] in style.css.

export const THEMES = {
  light: {
    name: 'light',
    paper: '#fbf8f1', // background, and the wipe's covering sheet
    ink: '#1d2838', // line art: stars, moon, horizon, boat outlines, splashes
    head: '#fbf8f1', // faces in the boat
    bubble: '#4f9bd3',
    wc: 'day', // watercolour palette for the deep (see sprites.js)
    wcAlpha: 1, // multiplier on each deep fish's opacity
  },
  dark: {
    name: 'dark',
    paper: '#0e1626',
    ink: '#ebe4d2',
    head: '#f1e8d6',
    bubble: '#8fd0ff',
    wc: 'night',
    wcAlpha: 1.3,
  },
};

export const theme = { ...THEMES.light };

const KEY = 'sea-of-fish:theme';

// Stored choice if there is one, otherwise the system preference.
export function initialTheme() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // storage blocked: fall through to the system preference
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function hasSavedTheme() {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
}

export function saveTheme(name) {
  try {
    localStorage.setItem(KEY, name);
  } catch {
    // not persisted; the toggle still works for this visit
  }
}

export function applyTheme(name) {
  Object.assign(theme, THEMES[name]);
  document.documentElement.dataset.theme = name;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.paper);
}
