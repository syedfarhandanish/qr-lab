// --- TOAST ENGINE ---
function showToast(message, type = 'info') {
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

// --- APP STATE & ELEMENTS ---
const themeToggle = document.getElementById('theme-toggle');
const body = document.body;
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

// Inputs
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

// NEW: Bulk Elements
const csvInput = document.getElementById('csv-input');
const csvFileName = document.getElementById('csv-file-name');
const bulkGenerateBtn = document.getElementById('bulk-generate-btn');

const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
let activeTab = 'tab-link'; 

// --- HISTORY LOGIC ---
const historySection = document.getElementById('history-section');
const historyList = document.getElementById('history-list');
const clearHistoryBtn = document.getElementById('clear-history-btn');
let qrHistory = JSON.parse(localStorage.getItem('qr_lab_history')) || [];

function saveToHistory(data, type) {
    if (qrHistory.length > 0 && qrHistory[0].data === data) return;

    const historyItem = {
        data: data,
        type: type,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        settings: {
            fg: fgColor.value,
            bg: bgColor.value,
            style: dotStyle.value,
            size: sizeSelect.value,
            error: errorCorrection.value 
        }
    };

    qrHistory.unshift(historyItem); 
    if (qrHistory.length > 5) qrHistory.pop(); 

    localStorage.setItem('qr_lab_history', JSON.stringify(qrHistory));
    renderHistory();
}

function renderHistory() {
    if (qrHistory.length === 0) {
        historySection.style.display = 'none';
        return;
    }
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
    
    const tabName = `tab-${item.type.toLowerCase()}`;
    const targetBtn = document.querySelector(`[data-target="${tabName}"]`);
    if(targetBtn) targetBtn.click();

    if (item.type === 'link') qrInput.value = item.data;
    
    fgColor.value = item.settings.fg;
    bgColor.value = item.settings.bg;
    dotStyle.value = item.settings.style;
    sizeSelect.value = item.settings.size;
    if(item.settings.error) errorCorrection.value = item.settings.error;

    generateQR();
    showToast('Loaded from history', 'info');
}

clearHistoryBtn.onclick = () => {
    qrHistory = [];
    localStorage.removeItem('qr_lab_history');
    renderHistory();
    showToast('History cleared', 'info');
};

// --- THEME ---
if (localStorage.getItem('theme') === 'dark') {
    body.classList.add('dark-mode');
    themeToggle.innerText = '☀️ Light Mode';
}

themeToggle.addEventListener('click', () => {
    body.classList.toggle('dark-mode');
    localStorage.setItem('theme', body.classList.contains('dark-mode') ? 'dark' : 'light');
    themeToggle.innerText = body.classList.contains('dark-mode') ? '☀️ Light Mode' : '🌙 Dark Mode';
});

// --- GENERATOR LOGIC ---
const qrCodeMaker = new QRCodeStyling({
    width: 300,
    height: 300,
    type: "canvas",
    imageOptions: { crossOrigin: "anonymous", margin: 10 }
});

function generateQR() {
    // If we are on the Bulk Tab, hide the live preview box entirely
    if (activeTab === 'tab-bulk') {
        hideQR();
        return;
    }

    if (activeTab === 'tab-link') {
        currentDataString = qrInput.value.trim();
        currentDataType = 'link';
        if (currentDataString === '') { hideQR(); return; }
    } 
    else if (activeTab === 'tab-wifi') {
        const ssid = wifiSsid.value.trim();
        currentDataType = 'wifi';
        if (ssid === '') { hideQR(); return; }
        currentDataString = `WIFI:T:${wifiType.value};S:${ssid};P:${wifiPass.value.trim()};;`;
    }
    else if (activeTab === 'tab-vcard') {
        const fn = vcFname.value.trim();
        currentDataType = 'vcard';
        if (fn === '' && vcPhone.value.trim() === '') { hideQR(); return; } 
        currentDataString = `BEGIN:VCARD\nVERSION:3.0\nN:;${fn}\nTEL:${vcPhone.value.trim()}\nEND:VCARD`;
    }
    else if (activeTab === 'tab-email') {
        const to = emailTo.value.trim();
        currentDataType = 'email';
        if (to === '') { hideQR(); return; }
        currentDataString = `mailto:${to}?subject=${encodeURIComponent(emailSub.value.trim())}`;
    }
    else if (activeTab === 'tab-whatsapp') {
        currentDataType = 'whatsapp';
        if (waPhone.value.trim() === '') { hideQR(); return; }
        currentDataString = `https://wa.me/${waPhone.value.trim()}`;
    }

    qrCodeMaker.update({
        data: currentDataString, 
        width: parseInt(sizeSelect.value),
        height: parseInt(sizeSelect.value),
        image: currentLogoUrl,
        dotsOptions: { color: fgColor.value, type: dotStyle.value },
        backgroundOptions: { color: bgColor.value },
        qrOptions: { errorCorrectionLevel: errorCorrection.value } 
    });

    qrCodeDiv.innerHTML = '';
    qrCodeMaker.append(qrCodeDiv); 
    qrCodeDiv.style.display = 'flex'; 
    downloadBtn.style.display = 'block';
}

function hideQR() {
    qrCodeDiv.style.display = 'none';
    downloadBtn.style.display = 'none';
}

renderHistory();

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        activeTab = btn.getAttribute('data-target');
        document.getElementById(activeTab).classList.add('active');
        hideQR();
        generateQR(); 
    });
});

const allInputs = [qrInput, wifiSsid, wifiPass, wifiType, sizeSelect, fgColor, bgColor, dotStyle, errorCorrection, vcFname, vcPhone, emailTo, waPhone];
allInputs.forEach(input => {
    input.addEventListener('input', generateQR);
    if(input.tagName === 'SELECT') input.addEventListener('change', generateQR);
});

// Download & Save to History
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
    currentLogoUrl = ""; 
    logoInput.value = ""; 
    document.getElementById('remove-logo-btn').style.display = 'none'; 
    generateQR(); 
    showToast('Logo removed.', 'info'); 
});

document.getElementById('clear-link-btn').addEventListener('click', () => { qrInput.value = ''; hideQR(); qrInput.focus(); });
document.getElementById('clear-wifi-btn').addEventListener('click', () => { wifiSsid.value = ''; wifiPass.value = ''; hideQR(); wifiSsid.focus(); });
document.getElementById('clear-vcard-btn').addEventListener('click', () => { vcFname.value=''; vcLname.value=''; vcPhone.value=''; vcEmail.value=''; vcCompany.value=''; hideQR(); vcFname.focus(); });
document.getElementById('clear-email-btn').addEventListener('click', () => { emailTo.value=''; emailSub.value=''; emailBody.value=''; hideQR(); emailTo.focus(); });
document.getElementById('clear-wa-btn').addEventListener('click', () => { waPhone.value=''; waMsg.value=''; hideQR(); waPhone.focus(); });

// --- PRINT POSTER LOGIC ---
const printWifiBtn = document.getElementById('print-wifi-btn');
const printSsidText = document.getElementById('print-ssid-text');
const printPassText = document.getElementById('print-pass-text');
const printQrImg = document.getElementById('print-qr-img');

printWifiBtn.addEventListener('click', async () => {
    if (wifiSsid.value.trim() === '') {
        showToast('❌ Please enter a Network Name first!', 'error');
        return;
    }
    
    printSsidText.innerText = wifiSsid.value.trim();
    printPassText.innerText = wifiPass.value.trim() ? wifiPass.value.trim() : "No Password";
    
    try {
        const blob = await qrCodeMaker.getRawData("png");
        const imageUrl = URL.createObjectURL(blob);
        
        printQrImg.onload = () => {
            setTimeout(() => {
                window.print();
                URL.revokeObjectURL(imageUrl);
            }, 200); 
        };
        printQrImg.src = imageUrl;
    } catch (error) {
        showToast('❌ Error generating poster image.', 'error');
    }
});

// =========================================
// NEW: BULK CSV GENERATION LOGIC
// =========================================
csvInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        csvFileName.innerText = e.target.files[0].name;
        bulkGenerateBtn.style.display = 'block';
    } else {
        csvFileName.innerText = 'No file chosen';
        bulkGenerateBtn.style.display = 'none';
    }
});

bulkGenerateBtn.addEventListener('click', async () => {
    const file = csvInput.files[0];
    if (!file) return;

    // Show a loading state to the user
    showToast('⏳ Generating Bulk ZIP... Please wait.', 'info');
    bulkGenerateBtn.innerText = 'Generating...';
    bulkGenerateBtn.disabled = true;

    const reader = new FileReader();
    
    reader.onload = async (e) => {
        const text = e.target.result;
        // Split by newlines to handle both Windows (\r\n) and Mac (\n) files
        const lines = text.split(/\r?\n/); 
        
        const zip = new JSZip(); // Initialize an empty ZIP folder
        let count = 0;

        for (let line of lines) {
            if (line.trim() === '') continue; // Skip empty rows
            
            // Find the first comma to split the Filename from the Link
            const firstCommaIdx = line.indexOf(',');
            if(firstCommaIdx === -1) continue; 

            let filename = line.substring(0, firstCommaIdx).trim();
            let data = line.substring(firstCommaIdx + 1).trim();

            // Strip out quotes if Excel accidentally added them
            if(filename.startsWith('"') && filename.endsWith('"')) filename = filename.substring(1, filename.length-1);
            if(data.startsWith('"') && data.endsWith('"')) data = data.substring(1, data.length-1);

            // Tell the QR Engine to load this row's data
            qrCodeMaker.update({
                data: data,
                width: parseInt(sizeSelect.value),
                height: parseInt(sizeSelect.value),
                image: currentLogoUrl,
                dotsOptions: { color: fgColor.value, type: dotStyle.value },
                backgroundOptions: { color: bgColor.value },
                qrOptions: { errorCorrectionLevel: errorCorrection.value }
            });

            try {
                // Wait for the engine to create the raw image
                const blob = await qrCodeMaker.getRawData("png");
                
                // Strip special characters so Windows/Mac doesn't break the filename
                const safeFilename = filename.replace(/[^a-z0-9]/gi, '_');
                
                // Toss the image into our ZIP folder
                zip.file(`${safeFilename}.png`, blob);
                count++;
            } catch (err) {
                console.error("Failed to generate QR for", filename);
            }
        }

        if (count === 0) {
            showToast('❌ No valid data found in CSV.', 'error');
        } else {
            try {
                // Compile the ZIP and force the browser to download it
                const zipBlob = await zip.generateAsync({ type: "blob" });
                const zipUrl = URL.createObjectURL(zipBlob);
                
                const a = document.createElement("a");
                a.href = zipUrl;
                a.download = "QR_Lab_Bulk.zip";
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(zipUrl);

                showToast(`✅ Successfully zipped and downloaded ${count} QR Codes!`, 'success');
            } catch (err) {
                showToast('❌ Failed to zip files.', 'error');
            }
        }
        
        // Restore the button to its normal state
        bulkGenerateBtn.innerText = '📦 Generate & Download ZIP';
        bulkGenerateBtn.disabled = false;
        csvInput.value = ''; // Reset the file input
        csvFileName.innerText = 'No file chosen';
        bulkGenerateBtn.style.display = 'none';
    };
    
    // Trigger the file reading
    reader.readAsText(file);
});