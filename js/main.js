import { showToast, printPoster } from './ui.js';
import { processBulkCSV, downloadSampleCSV, parseCSV, MAX_ROWS } from './bulk.js';

const $ = id => document.getElementById(id);
const PREVIEW_SIZE = 600; // rendered size of the on-screen preview (scaled down by CSS, crisp on retina)
const TYPES = ['link', 'wifi', 'vcard', 'email', 'whatsapp', 'sms', 'phone', 'bulk'];
const TYPE_LABELS = { link: 'URL / Text', wifi: 'Wi-Fi', vcard: 'Contact', email: 'Email', whatsapp: 'WhatsApp', sms: 'SMS', phone: 'Phone', bulk: 'Bulk' };
const SAMPLE_DATA = 'https://www.qrlab.eu.org';

// ---------- DOM ----------
const qrCodeDiv = $('qr-code');
const qrEmpty = $('qr-empty');
const qrMeta = $('qr-meta');
const downloadBtn = $('download-btn');
const downloadSvgBtn = $('download-svg-btn');
const copyBtn = $('copy-btn');
const shareBtn = $('share-btn');

const fgColor = $('fg-color'), bgColor = $('bg-color'), fg2Color = $('fg2-color');
const useGradient = $('use-gradient');
const sizeSelect = $('size-select');
const errorCorrection = $('error-correction');
const logoInput = $('logo-input');
const removeLogoBtn = $('remove-logo-btn');
const designPanel = $('design-panel');

const tabBtns = [...document.querySelectorAll('.type-btn')];
const csvInput = $('csv-input');
const bulkBtn = $('bulk-generate-btn');

// Fields per type, used for generation, clearing and history restore
const FIELDS = {
    link: ['qr-input'],
    wifi: ['wifi-ssid', 'wifi-pass', 'wifi-type', 'wifi-hidden'],
    vcard: ['vc-fname', 'vc-lname', 'vc-phone', 'vc-email', 'vc-company', 'vc-title', 'vc-url'],
    email: ['email-to', 'email-sub', 'email-body'],
    whatsapp: ['wa-phone', 'wa-msg'],
    sms: ['sms-phone', 'sms-msg'],
    phone: ['tel-phone'],
    bulk: []
};

// ---------- State ----------
let activeType = 'link';
let logoUrl = '';
let current = { data: '', label: '' };
let csvFile = null;
let csvFirstRow = '';

const v = id => {
    const el = $(id);
    return el.type === 'checkbox' ? el.checked : el.value.trim();
};

// ---------- Payload builders ----------
const escWifi = s => s.replace(/([\\;,:"])/g, '\\$1');
const escVcard = s => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([;,])/g, '\\$1');

const builders = {
    link() {
        let text = v('qr-input');
        if (!text) return null;
        if (/^www\.[^\s]+\.[^\s]+$/i.test(text)) text = 'https://' + text;
        return { data: text, label: text };
    },
    wifi() {
        const ssid = v('wifi-ssid');
        if (!ssid) return null;
        const type = v('wifi-type');
        const pass = type === 'nopass' ? '' : v('wifi-pass');
        let data = `WIFI:T:${type};S:${escWifi(ssid)};`;
        if (pass) data += `P:${escWifi(pass)};`;
        if (v('wifi-hidden')) data += 'H:true;';
        return { data: data + ';', label: ssid };
    },
    vcard() {
        const fn = v('vc-fname'), ln = v('vc-lname'), tel = v('vc-phone'), email = v('vc-email');
        if (!fn && !ln && !tel && !email) return null;
        const full = [fn, ln].filter(Boolean).join(' ');
        const lines = ['BEGIN:VCARD', 'VERSION:3.0', `N:${escVcard(ln)};${escVcard(fn)};;;`, `FN:${escVcard(full || tel || email)}`];
        if (v('vc-company')) lines.push(`ORG:${escVcard(v('vc-company'))}`);
        if (v('vc-title')) lines.push(`TITLE:${escVcard(v('vc-title'))}`);
        if (tel) lines.push(`TEL;TYPE=CELL:${tel}`);
        if (email) lines.push(`EMAIL:${email}`);
        if (v('vc-url')) lines.push(`URL:${v('vc-url')}`);
        lines.push('END:VCARD');
        return { data: lines.join('\n'), label: full || tel || email };
    },
    email() {
        const to = v('email-to');
        if (!to) return null;
        const params = [];
        if (v('email-sub')) params.push('subject=' + encodeURIComponent(v('email-sub')));
        if (v('email-body')) params.push('body=' + encodeURIComponent(v('email-body')));
        return { data: `mailto:${to}${params.length ? '?' + params.join('&') : ''}`, label: to };
    },
    whatsapp() {
        const num = v('wa-phone').replace(/\D/g, '').replace(/^00/, '');
        if (!num) return null;
        const msg = v('wa-msg');
        return { data: `https://wa.me/${num}${msg ? '?text=' + encodeURIComponent(msg) : ''}`, label: '+' + num };
    },
    sms() {
        const num = v('sms-phone').replace(/[^\d+]/g, '');
        if (!num) return null;
        return { data: `SMSTO:${num}:${v('sms-msg')}`, label: num };
    },
    phone() {
        const num = v('tel-phone').replace(/[^\d+]/g, '');
        if (!num) return null;
        return { data: `tel:${num}`, label: num };
    },
    bulk() {
        return { data: csvFirstRow || SAMPLE_DATA, label: '' };
    }
};

// ---------- Design options ----------
const radio = name => document.querySelector(`input[name="${name}"]:checked`)?.value;

function buildOptions(size, data) {
    const fg = fgColor.value, fg2 = fg2Color.value, bg = bgColor.value;
    const gradient = useGradient.checked
        ? { type: 'linear', rotation: Math.PI / 4, colorStops: [{ offset: 0, color: fg }, { offset: 1, color: fg2 }] }
        : undefined;
    const corner = radio('corner-style') || 'square';
    return {
        width: size,
        height: size,
        margin: Math.round(size * 0.045), // quiet zone: scanners need a light border around the code
        data,
        image: logoUrl || '',
        qrOptions: { errorCorrectionLevel: errorCorrection.value },
        dotsOptions: { type: radio('dot-style') || 'square', color: fg, gradient },
        cornersSquareOptions: { type: corner, color: fg, gradient },
        cornersDotOptions: { type: corner === 'square' ? 'square' : 'dot', color: fg, gradient },
        backgroundOptions: { color: bg },
        imageOptions: { crossOrigin: 'anonymous', margin: 6, imageSize: 0.35, hideBackgroundDots: true }
    };
}

// ---------- Preview ----------
const preview = new QRCodeStyling({ ...buildOptions(PREVIEW_SIZE, SAMPLE_DATA), type: 'canvas' });
preview.append(qrCodeDiv);

function setActionsEnabled(on) {
    [downloadBtn, downloadSvgBtn, copyBtn, shareBtn].forEach(b => (b.disabled = !on));
}

let renderTimer = null;
function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(render, 90);
}

function render() {
    const result = builders[activeType]();
    if (!result) {
        current = { data: '', label: '' };
        qrCodeDiv.hidden = true;
        qrEmpty.hidden = false;
        qrMeta.textContent = '';
        setActionsEnabled(false);
        return;
    }
    current = result;
    preview.update(buildOptions(PREVIEW_SIZE, result.data));
    qrCodeDiv.hidden = false;
    qrEmpty.hidden = true;

    if (activeType === 'bulk') {
        qrMeta.textContent = csvFirstRow ? 'Preview of the first row. This design applies to every code.' : 'Design preview. Applies to every code in your CSV.';
        setActionsEnabled(false);
    } else {
        qrMeta.textContent = `${TYPE_LABELS[activeType]} · ${result.data.length} characters`;
        setActionsEnabled(true);
    }
    updateContrastWarning();
    saveDesign();
}

// ---------- Contrast check ----------
function luminance(hex) {
    const c = hex.replace('#', '').match(/.{2}/g).map(x => {
        const s = parseInt(x, 16) / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrast(a, b) {
    const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
}
function updateContrastWarning() {
    const bg = bgColor.value;
    const fgs = useGradient.checked ? [fgColor.value, fg2Color.value] : [fgColor.value];
    const bad = fgs.some(fg => contrast(fg, bg) < 3 || luminance(fg) > luminance(bg));
    $('contrast-warn').hidden = !bad;
}

// ---------- Tabs ----------
function selectTab(type, { focus = false } = {}) {
    if (!TYPES.includes(type)) type = 'link';
    activeType = type;
    tabBtns.forEach(btn => {
        const on = btn.dataset.type === type;
        btn.setAttribute('aria-selected', on);
        btn.tabIndex = on ? 0 : -1;
        if (on && focus) btn.focus();
    });
    TYPES.forEach(t => ($(`tab-${t}`).hidden = t !== type));
    render();
}

tabBtns.forEach((btn, i) => {
    btn.addEventListener('click', () => selectTab(btn.dataset.type));
    btn.addEventListener('keydown', e => {
        const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
        let next = null;
        if (e.key in keys) next = (i + keys[e.key] + tabBtns.length) % tabBtns.length;
        if (e.key === 'Home') next = 0;
        if (e.key === 'End') next = tabBtns.length - 1;
        if (next !== null) { e.preventDefault(); selectTab(tabBtns[next].dataset.type, { focus: true }); }
    });
});

// Links like /?type=wifi#generator switch tabs without reloading
document.querySelectorAll('[data-type-link]').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    selectTab(a.dataset.typeLink);
    $('generator').scrollIntoView({ behavior: 'smooth' });
    history.replaceState(null, '', a.getAttribute('href'));
}));

// ---------- Inputs ----------
Object.values(FIELDS).flat().forEach(id => {
    const el = $(id);
    el.addEventListener('input', scheduleRender);
    el.addEventListener('change', scheduleRender);
});
$('wifi-type').addEventListener('change', () => {
    $('wifi-pass').disabled = $('wifi-type').value === 'nopass';
});

document.querySelectorAll('[data-clear]').forEach(btn => btn.addEventListener('click', () => {
    const type = btn.dataset.clear.replace('tab-', '');
    FIELDS[type].forEach(id => {
        const el = $(id);
        if (el.type === 'checkbox') el.checked = false;
        else if (el.tagName !== 'SELECT') el.value = '';
    });
    render();
    $(FIELDS[type][0])?.focus();
}));

// ---------- Design controls ----------
const swatches = [...document.querySelectorAll('.swatch')];

function syncHex() {
    $('fg-hex').textContent = fgColor.value;
    $('bg-hex').textContent = bgColor.value;
    $('fg2-hex').textContent = fg2Color.value;
    $('fg2-wrap').hidden = !useGradient.checked;
}

function markSwatch() {
    swatches.forEach(s => {
        const match = s.dataset.fg === fgColor.value && s.dataset.bg === bgColor.value &&
            (s.dataset.fg2 ? useGradient.checked && s.dataset.fg2 === fg2Color.value : !useGradient.checked);
        s.setAttribute('aria-pressed', match);
    });
}

swatches.forEach(s => s.addEventListener('click', () => {
    fgColor.value = s.dataset.fg;
    bgColor.value = s.dataset.bg;
    useGradient.checked = !!s.dataset.fg2;
    if (s.dataset.fg2) fg2Color.value = s.dataset.fg2;
    syncHex(); markSwatch(); render();
}));

[fgColor, bgColor, fg2Color, useGradient, sizeSelect, errorCorrection].forEach(el => {
    el.addEventListener('input', () => { syncHex(); markSwatch(); scheduleRender(); });
    el.addEventListener('change', () => { syncHex(); markSwatch(); scheduleRender(); });
});
document.querySelectorAll('input[name="dot-style"], input[name="corner-style"]').forEach(r => r.addEventListener('change', render));

// Persist design between visits (logo excluded: it can be large)
const DESIGN_KEY = 'qr_lab_design';
function saveDesign() {
    try {
        localStorage.setItem(DESIGN_KEY, JSON.stringify({
            fg: fgColor.value, bg: bgColor.value, fg2: fg2Color.value, grad: useGradient.checked,
            dot: radio('dot-style'), corner: radio('corner-style'), size: sizeSelect.value, ec: errorCorrection.value
        }));
    } catch (e) { /* ignore */ }
}
function applyDesign(d) {
    if (!d) return;
    if (d.fg) fgColor.value = d.fg;
    if (d.bg) bgColor.value = d.bg;
    if (d.fg2) fg2Color.value = d.fg2;
    useGradient.checked = !!d.grad;
    if (d.size && [...sizeSelect.options].some(o => o.value === d.size)) sizeSelect.value = d.size;
    if (d.ec) errorCorrection.value = d.ec;
    const dot = document.querySelector(`input[name="dot-style"][value="${d.dot}"]`);
    if (dot) dot.checked = true;
    const corner = document.querySelector(`input[name="corner-style"][value="${d.corner}"]`);
    if (corner) corner.checked = true;
    syncHex(); markSwatch();
}
try { applyDesign(JSON.parse(localStorage.getItem(DESIGN_KEY))); } catch (e) { /* ignore */ }

// ---------- Logo ----------
function setLogo(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) { showToast('Please choose an image file.', 'error'); return; }
    if (file.size > 5 * 1024 * 1024) { showToast('Logo must be under 5 MB.', 'error'); return; }
    const reader = new FileReader();
    reader.onload = e => {
        logoUrl = e.target.result;
        const thumb = $('logo-thumb');
        thumb.innerHTML = '';
        const img = document.createElement('img');
        img.src = logoUrl; img.alt = '';
        thumb.appendChild(img);
        $('logo-label').textContent = file.name;
        removeLogoBtn.hidden = false;
        errorCorrection.value = 'H';
        render();
        showToast('Logo added. Error correction set to High.', 'success');
    };
    reader.readAsDataURL(file);
}
logoInput.addEventListener('change', e => setLogo(e.target.files[0]));
removeLogoBtn.addEventListener('click', () => {
    logoUrl = '';
    logoInput.value = '';
    $('logo-thumb').innerHTML = '<svg class="i"><use href="/icons/sprite.svg#i-image"/></svg>';
    $('logo-label').textContent = 'Upload your logo';
    removeLogoBtn.hidden = true;
    render();
    showToast('Logo removed.', 'info');
});

// Drag & drop for both dropzones
function enableDrop(zone, onFile) {
    ['dragenter', 'dragover'].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.add('dragover'); }));
    ['dragleave', 'drop'].forEach(ev => zone.addEventListener(ev, () => zone.classList.remove('dragover')));
    zone.addEventListener('drop', e => { e.preventDefault(); onFile(e.dataTransfer.files[0]); });
}
enableDrop($('logo-drop'), setLogo);

// ---------- Download / copy / share ----------
function fileName() {
    const slug = (current.label || 'code').toLowerCase().replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
    return `qr-lab-${activeType}-${slug || 'code'}`;
}

function exporter(type = 'canvas') {
    const size = parseInt(sizeSelect.value, 10);
    return new QRCodeStyling({ ...buildOptions(size, current.data), type });
}

downloadBtn.addEventListener('click', async () => {
    if (!current.data) return;
    await exporter().download({ name: fileName(), extension: 'png' });
    saveToHistory();
    showToast('PNG downloaded and saved to history.', 'success');
});

downloadSvgBtn.addEventListener('click', async () => {
    if (!current.data) return;
    await exporter('svg').download({ name: fileName(), extension: 'svg' });
    saveToHistory();
    showToast('SVG downloaded. Scales to any size.', 'success');
});

const canCopy = !!(navigator.clipboard && window.ClipboardItem);
copyBtn.hidden = !canCopy;
copyBtn.addEventListener('click', async () => {
    try {
        const blob = await exporter().getRawData('png');
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        showToast('QR code copied to clipboard.', 'success');
    } catch (e) {
        showToast('Copy is not supported in this browser.', 'error');
    }
});

// Web Share with files (mostly mobile)
try {
    const probe = new File([''], 'x.png', { type: 'image/png' });
    shareBtn.hidden = !(navigator.canShare && navigator.canShare({ files: [probe] }));
} catch (e) { shareBtn.hidden = true; }
shareBtn.addEventListener('click', async () => {
    try {
        const blob = await exporter().getRawData('png');
        const file = new File([blob], fileName() + '.png', { type: 'image/png' });
        await navigator.share({ files: [file], title: 'QR code', text: 'Made with QR Lab: https://www.qrlab.eu.org' });
        saveToHistory();
    } catch (e) {
        if (e.name !== 'AbortError') showToast('Sharing failed.', 'error');
    }
});

$('print-wifi-btn').addEventListener('click', () => {
    printPoster(v('wifi-ssid'), $('wifi-type').value === 'nopass' ? '' : v('wifi-pass'), qrCodeDiv.querySelector('canvas'));
});

// ---------- History ----------
const HISTORY_KEY = 'qr_lab_history';
const historySection = $('history-section');
const historyList = $('history-list');
let qrHistory = [];
try { qrHistory = JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch (e) { qrHistory = []; }

function saveToHistory() {
    if (qrHistory[0]?.data === current.data) return;
    const fields = {};
    FIELDS[activeType].forEach(id => { const el = $(id); fields[id] = el.type === 'checkbox' ? el.checked : el.value; });
    qrHistory.unshift({
        type: activeType,
        data: current.data,
        label: current.label,
        fields,
        timestamp: new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    });
    qrHistory = qrHistory.slice(0, 6);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(qrHistory)); } catch (e) { /* ignore */ }
    renderHistory();
}

function renderHistory() {
    historySection.hidden = qrHistory.length === 0;
    historyList.replaceChildren(...qrHistory.map((item, i) => {
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'history-item';
        const info = document.createElement('span');
        info.className = 'history-info';
        const title = document.createElement('span');
        title.className = 'history-title';
        title.textContent = item.label || item.data; // textContent: never inject user data as HTML
        const meta = document.createElement('span');
        meta.className = 'history-meta';
        meta.textContent = item.timestamp;
        info.append(title, meta);
        const tag = document.createElement('span');
        tag.className = 'history-tag';
        tag.textContent = TYPE_LABELS[item.type] || item.type;
        btn.append(info, tag);
        btn.addEventListener('click', () => loadHistoryItem(i));
        li.appendChild(btn);
        return li;
    }));
}

function loadHistoryItem(i) {
    const item = qrHistory[i];
    if (!item) return;
    const type = TYPES.includes(item.type) ? item.type : 'link';
    if (item.fields) {
        Object.entries(item.fields).forEach(([id, val]) => {
            const el = $(id);
            if (!el) return;
            if (el.type === 'checkbox') el.checked = !!val; else el.value = val;
        });
    } else if (type === 'link') {
        $('qr-input').value = item.data; // entries saved by the previous version
    }
    selectTab(type);
    showToast('Loaded from history.', 'info');
}

$('clear-history-btn').addEventListener('click', () => {
    qrHistory = [];
    try { localStorage.removeItem(HISTORY_KEY); } catch (e) { /* ignore */ }
    renderHistory();
    showToast('History cleared.', 'info');
});

// ---------- Bulk ----------
async function setCsv(file) {
    if (!file) return;
    if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') { showToast('Please choose a .csv file.', 'error'); return; }
    csvFile = file;
    const rows = parseCSV(await file.text());
    const dataRows = rows.filter((r, idx) => !(idx === 0 && /^(file ?name|name)$/i.test(r[0])));
    csvFirstRow = dataRows[0]?.[1] || '';
    $('csv-file-name').textContent = file.name;
    $('csv-file-info').textContent = `${Math.min(dataRows.length, MAX_ROWS)} QR code${dataRows.length === 1 ? '' : 's'} ready`;
    bulkBtn.disabled = dataRows.length === 0;
    render();
}
csvInput.addEventListener('change', e => setCsv(e.target.files[0]));
enableDrop($('csv-drop'), setCsv);
$('sample-csv').addEventListener('click', e => { e.preventDefault(); downloadSampleCSV(); });

bulkBtn.addEventListener('click', async () => {
    if (!csvFile) return;
    const label = bulkBtn.querySelector('span');
    const progress = $('bulk-progress');
    const bar = progress.firstElementChild;
    bulkBtn.disabled = true;
    progress.hidden = false;
    bar.style.width = '0%';
    try {
        const opts = buildOptions(parseInt(sizeSelect.value, 10), SAMPLE_DATA);
        await processBulkCSV(csvFile, opts, (done, total) => {
            bar.style.width = `${Math.round((done / total) * 100)}%`;
            label.textContent = `Generating ${done} / ${total}…`;
        });
    } catch (e) {
        showToast('Bulk generation failed. Check your connection and try again.', 'error');
    } finally {
        label.textContent = 'Generate & download ZIP';
        bulkBtn.disabled = false;
        setTimeout(() => (progress.hidden = true), 800);
    }
});

// ---------- Init ----------
if (window.matchMedia('(min-width: 920px)').matches) designPanel.open = true;
syncHex();
markSwatch();
renderHistory();
selectTab(new URLSearchParams(location.search).get('type') || 'link');
