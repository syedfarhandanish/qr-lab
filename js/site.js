// Shared behaviour for every page: theme, header, scroll reveal, PWA install + service worker.
import { showToast } from './ui.js';

const root = document.documentElement;

// ---------- Theme ----------
const themeToggle = document.getElementById('theme-toggle');
const themeMeta = () => document.querySelectorAll('meta[name="theme-color"]');

function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    // Keep the browser/OS chrome in sync with the chosen theme
    themeMeta().forEach(m => m.setAttribute('content', theme === 'dark' ? '#0b1120' : '#f6f8fc'));
}
applyTheme(root.getAttribute('data-theme') || 'light');

themeToggle?.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem('theme', next); } catch (e) { /* storage blocked */ }
});

// ---------- Header shadow on scroll ----------
const header = document.getElementById('site-header');
if (header) {
    const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
}

// ---------- Reveal on scroll ----------
const revealEls = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window && revealEls.length) {
    const io = new IntersectionObserver(entries => {
        entries.forEach(e => {
            if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
        });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealEls.forEach(el => io.observe(el));
} else {
    revealEls.forEach(el => el.classList.add('in'));
}

// ---------- PWA: install prompt ----------
let deferredPrompt = null;
const installBtns = document.querySelectorAll('[data-install]');
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    if (!isStandalone) installBtns.forEach(b => (b.hidden = false));
});

installBtns.forEach(btn => btn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtns.forEach(b => (b.hidden = true));
    if (outcome === 'accepted') showToast('QR Lab installed. Find it on your home screen.', 'success');
}));

window.addEventListener('appinstalled', () => {
    installBtns.forEach(b => (b.hidden = true));
});

// ---------- PWA: service worker ----------
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(reg => {
            reg.addEventListener('updatefound', () => {
                const worker = reg.installing;
                worker?.addEventListener('statechange', () => {
                    // A new version finished installing while an old one controls the page
                    if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                        showToast('A new version of QR Lab is available.', 'info', {
                            label: 'Refresh',
                            onClick: () => location.reload(),
                            duration: 10000
                        });
                    }
                });
            });
        }).catch(() => { /* SW registration is a progressive enhancement */ });
    });
}
