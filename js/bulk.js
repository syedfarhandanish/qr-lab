import { showToast } from './ui.js';

const JSZIP_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
export const MAX_ROWS = 500;

// JSZip is only needed for bulk export, so load it on demand.
let jszipPromise = null;
function loadJSZip() {
    if (window.JSZip) return Promise.resolve(window.JSZip);
    if (!jszipPromise) {
        jszipPromise = new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = JSZIP_URL;
            s.crossOrigin = 'anonymous';
            s.onload = () => resolve(window.JSZip);
            s.onerror = () => { jszipPromise = null; reject(new Error('Could not load JSZip')); };
            document.head.appendChild(s);
        });
    }
    return jszipPromise;
}

/** Minimal RFC 4180 CSV parser (handles quotes, escaped quotes and commas inside quotes). */
export function parseCSV(text) {
    const rows = [];
    let row = [], field = '', inQuotes = false;
    text = text.replace(/^﻿/, '');
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inQuotes) {
            if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
            else if (c === '"') inQuotes = false;
            else field += c;
        } else if (c === '"') inQuotes = true;
        else if (c === ',') { row.push(field); field = ''; }
        else if (c === '\n' || c === '\r') {
            if (c === '\r' && text[i + 1] === '\n') i++;
            row.push(field); rows.push(row); row = []; field = '';
        } else field += c;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows
        .map(r => r.map(v => v.trim()))
        .filter(r => r.length >= 2 && r[1] !== '');
}

/**
 * Build a ZIP of QR codes from a CSV file.
 * @param {File} file
 * @param {object} options  qr-code-styling options (without data)
 * @param {(done:number,total:number)=>void} onProgress
 */
export async function processBulkCSV(file, options, onProgress) {
    const text = await file.text();
    let rows = parseCSV(text);

    // Skip a header row like "filename,url"
    if (rows.length && /^(file ?name|name)$/i.test(rows[0][0]) && /url|text|data|link/i.test(rows[0][1])) rows.shift();

    if (!rows.length) { showToast('No valid rows found in the CSV.', 'error'); return 0; }
    if (rows.length > MAX_ROWS) {
        showToast(`Only the first ${MAX_ROWS} rows will be generated.`, 'info');
        rows = rows.slice(0, MAX_ROWS);
    }

    const JSZip = await loadJSZip();
    const zip = new JSZip();
    // Separate instance so the live preview is not overwritten
    const maker = new QRCodeStyling({ ...options, type: 'canvas' });
    const used = new Map();
    let count = 0;

    for (let i = 0; i < rows.length; i++) {
        const [rawName, data] = rows[i];
        let name = (rawName || `qr_${i + 1}`).replace(/[^a-z0-9-_]+/gi, '_').replace(/^_+|_+$/g, '') || `qr_${i + 1}`;
        // De-duplicate file names
        const n = used.get(name) || 0;
        used.set(name, n + 1);
        if (n) name = `${name}_${n + 1}`;

        try {
            maker.update({ data });
            const blob = await maker.getRawData('png');
            zip.file(`${name}.png`, blob);
            count++;
        } catch (err) {
            console.error('Failed to generate QR for', rawName, err);
        }
        onProgress?.(i + 1, rows.length);
    }

    if (!count) { showToast('Could not generate any QR codes.', 'error'); return 0; }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'QR_Lab_Bulk.zip';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    showToast(`Downloaded ${count} QR codes as a ZIP.`, 'success');
    return count;
}

export function downloadSampleCSV() {
    const csv = 'file_name,url_or_text\nwebsite,https://www.qrlab.eu.org\ntable_1,https://myrestaurant.com/menu?table=1\ntable_2,https://myrestaurant.com/menu?table=2\nhello,"Hello, world!"\n';
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'qr-lab-sample.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}
