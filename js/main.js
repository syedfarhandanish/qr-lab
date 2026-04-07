import { showToast, printPoster } from './ui.js';
import { processBulkCSV } from './bulk.js';

// --- STATE & DOM ELEMENTS ---
const qrWrapper = document.getElementById('qr-wrapper-container'); // Controls the new hover overlay
const qrCodeDiv = document.getElementById('qr-code');
const downloadBtn = document.getElementById('download-btn');
const fgColor = document.getElementById('fg-color');
const bgColor = document.getElementById('bg-color');
const sizeSelect = document.getElementById('size-select');
const dotStyle = document.getElementById('dot-style');
const errorCorrection = document.getElementById('error-correction');
const logoInput = document.getElementById('logo-input');
const removeLogoBtn = document.getElementById('remove-logo-btn');
let currentLogoUrl = ""; 

let currentDataString = "";
let currentDataType = "";

const qrInput = document.getElementById('qr-input');
const wifiSsid = document.getElementById('wifi-ssid');
const wifiPass = document.getElementById('wifi-pass');
const wifiType = document.getElementById('wifi-type');
const vcFname = document.getElementById('vc-fname');
const vcLname = document.getElementById('vc-lname');
const vcPhone = document.getElementById('vc-phone');
const vcEmail = document.getElementById('vc-email');
const vcCompany = document.getElementById('vc-company');
const emailTo = document.getElementById('email-to');
const emailSub = document.getElementById('email-sub');
const emailBody = document.getElementById('email-body');
const waPhone = document.getElementById('wa-phone');
const waMsg = document.getElementById('wa-msg');

const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
let activeTab = 'tab-link'; 

// --- HISTORY LOGIC ---
const historySection = document.getElementById('history-section');
const historyList = document.getElementById('history-list');
let qrHistory = JSON.parse(localStorage.getItem('qr_lab_history')) || [];

function saveToHistory(data, type) {
    if (qrHistory.length > 0 && qrHistory[0].data === data) return;

    const historyItem = {
        data: data, type: type,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        settings: {
            fg: fgColor.value, bg: bgColor.value, style: dotStyle.value,
            size: sizeSelect.value, error: errorCorrection.value 
        }
    };

    qrHistory.unshift(historyItem); 
    if (qrHistory.length > 5) qrHistory.pop(); 
    localStorage.setItem('qr_lab_history', JSON.stringify(qrHistory));
    renderHistory();
}

function renderHistory() {
    if (qrHistory.length === 0) { historySection.style.display = 'none'; return; }
    historySection.style.display = 'block';
    historyList.innerHTML = '';

    qrHistory.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `
            <div class="history-info">
                <span class="history-title">${item.data}</span>
                <span class="history-meta">${item.timestamp}</span>
            </div>
            <span class="history-tag">${item.type}</span>
        `;
        div.onclick = () => loadHistoryItem(index);
        historyList.appendChild(div);
    });
}

function loadHistoryItem(index) {
    const item = qrHistory[index];
    const targetBtn = document.querySelector(`[data-target="tab-${item.type.toLowerCase()}"]`);
    if(targetBtn) targetBtn.click();

    if (item.type === 'link') qrInput.value = item.data;
    fgColor.value = item.settings.fg; bgColor.value = item.settings.bg;
    dotStyle.value = item.settings.style; sizeSelect.value = item.settings.size;
    if(item.settings.error) errorCorrection.value = item.settings.error;

    generateQR();
    showToast('Loaded from history', 'info');
}

document.getElementById('clear-history-btn').onclick = () => {
    qrHistory = [];
    localStorage.removeItem('qr_lab_history');
    renderHistory();
    showToast('History cleared', 'info');
};

// --- CORE GENERATOR LOGIC ---
const qrCodeMaker = new QRCodeStyling({
    width: 300, height: 300, type: "canvas",
    imageOptions: { crossOrigin: "anonymous", margin: 10 }
});

function generateQR() {
    if (activeTab === 'tab-bulk') { hideQR(); return; }

    if (activeTab === 'tab-link') {
        currentDataString = qrInput.value.trim(); currentDataType = 'link';
        if (currentDataString === '') { hideQR(); return; }
    } 
    else if (activeTab === 'tab-wifi') {
        currentDataType = 'wifi';
        if (wifiSsid.value.trim() === '') { hideQR(); return; }
        currentDataString = `WIFI:T:${wifiType.value};S:${wifiSsid.value.trim()};P:${wifiPass.value.trim()};;`;
    }
    else if (activeTab === 'tab-vcard') {
        const fn = vcFname.value.trim(); currentDataType = 'vcard';
        if (fn === '' && vcPhone.value.trim() === '') { hideQR(); return; } 
        currentDataString = `BEGIN:VCARD\nVERSION:3.0\nN:;${fn}\nTEL:${vcPhone.value.trim()}\nEND:VCARD`;
    }
    else if (activeTab === 'tab-email') {
        currentDataType = 'email';
        if (emailTo.value.trim() === '') { hideQR(); return; }
        currentDataString = `mailto:${emailTo.value.trim()}?subject=${encodeURIComponent(emailSub.value.trim())}`;
    }
    else if (activeTab === 'tab-whatsapp') {
        currentDataType = 'whatsapp';
        if (waPhone.value.trim() === '') { hideQR(); return; }
        currentDataString = `https://wa.me/${waPhone.value.trim()}`;
    }

    qrCodeMaker.update({
        data: currentDataString, width: parseInt(sizeSelect.value), height: parseInt(sizeSelect.value),
        image: currentLogoUrl, dotsOptions: { color: fgColor.value, type: dotStyle.value },
        backgroundOptions: { color: bgColor.value }, qrOptions: { errorCorrectionLevel: errorCorrection.value } 
    });

    qrCodeDiv.innerHTML = ''; qrCodeMaker.append(qrCodeDiv); 
    
    // THE FIX: Displays the wrapper so the hover-download button works properly!
    qrCodeDiv.style.display = 'flex'; 
    qrWrapper.style.display = 'flex'; 
}

function hideQR() { 
    qrWrapper.style.display = 'none'; 
    qrCodeDiv.style.display = 'none'; 
}

renderHistory();

// --- EVENT LISTENERS ---
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        activeTab = btn.getAttribute('data-target');
        document.getElementById(activeTab).classList.add('active');
        hideQR(); generateQR(); 
    });
});

const allInputs = [qrInput, wifiSsid, wifiPass, wifiType, sizeSelect, fgColor, bgColor, dotStyle, errorCorrection, vcFname, vcPhone, emailTo, waPhone];
allInputs.forEach(input => {
    input.addEventListener('input', generateQR);
    if(input.tagName === 'SELECT') input.addEventListener('change', generateQR);
});

downloadBtn.addEventListener('click', () => {
    qrCodeMaker.download({ name: `QR_Lab`, extension: "png" });
    saveToHistory(currentDataString, currentDataType);
    showToast('✅ Downloaded & Saved to History!', 'success');
});

logoInput.addEventListener('change', (e) => {
    const reader = new FileReader();
    reader.onload = (event) => {
        currentLogoUrl = event.target.result; 
        removeLogoBtn.style.display = 'inline-block'; 
        errorCorrection.value = 'H'; 
        generateQR(); 
        showToast('Logo added! Error correction set to High.', 'success');
    };
    reader.readAsDataURL(e.target.files[0]);
});

document.getElementById('remove-logo-btn').addEventListener('click', () => {
    currentLogoUrl = ""; logoInput.value = ""; 
    document.getElementById('remove-logo-btn').style.display = 'none'; 
    generateQR(); showToast('Logo removed.', 'info'); 
});

// Clear Buttons
document.getElementById('clear-link-btn').addEventListener('click', () => { qrInput.value = ''; hideQR(); qrInput.focus(); });
document.getElementById('clear-wifi-btn').addEventListener('click', () => { wifiSsid.value = ''; wifiPass.value = ''; hideQR(); wifiSsid.focus(); });
document.getElementById('clear-vcard-btn').addEventListener('click', () => { vcFname.value=''; vcLname.value=''; vcPhone.value=''; vcEmail.value=''; vcCompany.value=''; hideQR(); vcFname.focus(); });
document.getElementById('clear-email-btn').addEventListener('click', () => { emailTo.value=''; emailSub.value=''; emailBody.value=''; hideQR(); emailTo.focus(); });
document.getElementById('clear-wa-btn').addEventListener('click', () => { waPhone.value=''; waMsg.value=''; hideQR(); waPhone.focus(); });

// Calling imported functions!
document.getElementById('print-wifi-btn').addEventListener('click', () => {
    const canvas = qrCodeDiv.querySelector('canvas');
    printPoster(wifiSsid.value, wifiPass.value, canvas);
});

const csvInput = document.getElementById('csv-input');
const bulkGenerateBtn = document.getElementById('bulk-generate-btn');

csvInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        document.getElementById('csv-file-name').innerText = e.target.files[0].name;
        bulkGenerateBtn.style.display = 'block';
    } else {
        document.getElementById('csv-file-name').innerText = 'No file chosen';
        bulkGenerateBtn.style.display = 'none';
    }
});

bulkGenerateBtn.addEventListener('click', () => {
    const file = csvInput.files[0];
    const settings = {
        size: parseInt(sizeSelect.value), logoUrl: currentLogoUrl,
        fgColor: fgColor.value, bgColor: bgColor.value,
        dotStyle: dotStyle.value, errorCorrection: errorCorrection.value
    };
    processBulkCSV(file, settings, qrCodeMaker);
});