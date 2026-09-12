// Renderer bootstrap for the embedded terminal. Kept in an external file
// because the CSP (`script-src 'self'`) blocks inline scripts — everything
// here must load through <script src>.
// window.Terminal is the Terminal class itself; FitAddon/WebLinksAddon are
// namespace objects ({ FitAddon: class }). Destructure accordingly, with a
// defensive fallback for other UMD builds.
const Terminal = window.Terminal && window.Terminal.Terminal ? window.Terminal.Terminal : window.Terminal;
const FitAddon = window.FitAddon && window.FitAddon.FitAddon ? window.FitAddon.FitAddon : window.FitAddon;
const WebLinksAddon = window.WebLinksAddon && window.WebLinksAddon.WebLinksAddon ? window.WebLinksAddon.WebLinksAddon : window.WebLinksAddon;

const term = new Terminal({
  cursorBlink: true,
  fontFamily: '"SF Mono","JetBrains Mono",Menlo,monospace',
  fontSize: 13,
  theme: {
    background: '#0b1020',
    foreground: '#e6edf3',
    cursor: '#e6edf3',
    selectionBackground: '#264f78aa'
  },
  allowProposedApi: true
});
const fit = new FitAddon();
term.loadAddon(fit);
term.loadAddon(new WebLinksAddon());
term.open(document.getElementById('terminal'));
fit.fit();

const veil = document.getElementById('veil');
let revealed = false;
function hideVeil() {
  if (revealed) return;
  revealed = true;
  veil.classList.add('hidden');
  setTimeout(() => veil.remove(), 500);
}

const bridge = window.terminalBridge;

// PTY -> terminal
bridge.onData((data) => {
  if (!revealed && data.length > 0) hideVeil();
  term.write(data);
});
bridge.onExit(({ exitCode }) => {
  term.write(`\r\n\x1b[90m[进程已退出 code=${exitCode}]\x1b[0m\r\n`);
});

// terminal -> PTY
term.onData((d) => bridge.write(d));

// Resize handling: debounce, then tell the PTY
let resizeTimer = null;
const ro = new ResizeObserver(() => {
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    try { fit.fit(); } catch (e) {}
    if (term.cols && term.rows) bridge.resize(term.cols, term.rows);
  }, 80);
});
ro.observe(document.getElementById('terminal'));
window.addEventListener('resize', () => { try { fit.fit(); } catch (e) {} });

// Initial size report once the terminal is mounted
setTimeout(() => { if (term.cols && term.rows) bridge.resize(term.cols, term.rows); }, 100);
