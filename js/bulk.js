import { showToast } from './ui.js';

export async function processBulkCSV(file, settings, qrCodeMaker) {
    if (!file) return;

    const bulkGenerateBtn = document.getElementById('bulk-generate-btn');
    showToast('⏳ Generating Bulk ZIP... Please wait.', 'info');
    bulkGenerateBtn.innerText = 'Generating...';
    bulkGenerateBtn.disabled = true;

    const reader = new FileReader();
    
    reader.onload = async (e) => {
        const text = e.target.result;
        const lines = text.split(/\r?\n/); 
        const zip = new JSZip(); 
        let count = 0;

        for (let line of lines) {
            if (line.trim() === '') continue; 
            
            const firstCommaIdx = line.indexOf(',');
            if(firstCommaIdx === -1) continue; 

            let filename = line.substring(0, firstCommaIdx).trim();
            let data = line.substring(firstCommaIdx + 1).trim();

            if(filename.startsWith('"') && filename.endsWith('"')) filename = filename.substring(1, filename.length-1);
            if(data.startsWith('"') && data.endsWith('"')) data = data.substring(1, data.length-1);

            qrCodeMaker.update({
                data: data,
                width: settings.size,
                height: settings.size,
                image: settings.logoUrl,
                dotsOptions: { color: settings.fgColor, type: settings.dotStyle },
                backgroundOptions: { color: settings.bgColor },
                qrOptions: { errorCorrectionLevel: settings.errorCorrection }
            });

            try {
                const blob = await qrCodeMaker.getRawData("png");
                const safeFilename = filename.replace(/[^a-z0-9]/gi, '_');
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
        
        bulkGenerateBtn.innerText = '📦 Generate & Download ZIP';
        bulkGenerateBtn.disabled = false;
        document.getElementById('csv-input').value = ''; 
        document.getElementById('csv-file-name').innerText = 'No file chosen';
        bulkGenerateBtn.style.display = 'none';
    };
    
    reader.readAsText(file);
}