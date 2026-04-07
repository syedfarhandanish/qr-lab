// Handles all the visual interface elements

export function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = message;
    container.appendChild(toast);
    
    setTimeout(() => { toast.classList.add('show'); }, 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => { toast.remove(); }, 400);
    }, 3000);
}

export function printPoster(wifiSsid, wifiPass, qrCanvas) {
    if (wifiSsid.trim() === '') {
        showToast('❌ Please enter a Network Name first!', 'error');
        return;
    }
    if (!qrCanvas) {
        showToast('❌ Please wait for the QR code to generate!', 'error');
        return;
    }

    document.getElementById('print-ssid-text').innerText = wifiSsid.trim();
    document.getElementById('print-pass-text').innerText = wifiPass.trim() ? wifiPass.trim() : "No Password";
    
    const printQrImg = document.getElementById('print-qr-img');
    
    printQrImg.onload = () => {
        setTimeout(() => window.print(), 100);
    };
    
    printQrImg.src = qrCanvas.toDataURL('image/png');
}