// Visual helpers shared across modules.

/**
 * Show a toast. Optional action button: { label, onClick, duration }.
 */
export function showToast(message, type = 'info', action = null) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const text = document.createElement('span');
    text.textContent = message;
    toast.appendChild(text);

    if (action) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = action.label;
        btn.addEventListener('click', () => { action.onClick(); dismiss(); });
        toast.appendChild(btn);
    }

    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));

    let timer = setTimeout(dismiss, action?.duration || 3200);
    function dismiss() {
        clearTimeout(timer);
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 350);
    }
}

export function printPoster(wifiSsid, wifiPass, qrCanvas) {
    if (wifiSsid.trim() === '') {
        showToast('Enter a network name first.', 'error');
        return;
    }
    if (!qrCanvas) {
        showToast('Please wait for the QR code to render.', 'error');
        return;
    }

    document.getElementById('print-ssid-text').textContent = wifiSsid.trim();
    document.getElementById('print-pass-text').textContent = wifiPass.trim() ? wifiPass.trim() : 'No password';

    const printQrImg = document.getElementById('print-qr-img');
    printQrImg.onload = () => setTimeout(() => window.print(), 100);
    printQrImg.src = qrCanvas.toDataURL('image/png');
}
