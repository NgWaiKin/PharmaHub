let allBatchesData = [];

function renderBatchTable(list) {
    const tbody = document.getElementById('batchTrackerTableBody');
    tbody.innerHTML = '';
    const today = new Date();

    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No batches found for this status.</td></tr>';
        return;
    }

    list.forEach(row => {
        const expiry = row.expiry_date ? row.expiry_date.slice(0, 10) : '-';
        let diffDays = '-';
        let statusHtml = '<b class="text-good">Good</b>';
        let actionHtml = '-';

        if (row.expiry_date){
            diffDays = Math.ceil((new Date(row.expiry_date) - today) / (1000 * 60 * 60 * 24));
            
            if (diffDays <= 0){
                statusHtml = '<b class="text-expired">Expired</b>';
                if (row.quantity > 0){
                    actionHtml = `<button type="button" class="btn-delete" onclick="writeOffBatch('${row.batch_id}', '${row.medicine_id}', ${row.quantity})">Write Off</button>`;
                } 
                else{
                    actionHtml = '<span class="write-offAction">Written Off</span>';
                }
            } 
            else if (diffDays <= 90){
                statusHtml = '<b class="text-warning">Near Expiry</b>';
            }
        }

        // Get the supplier information 
        const supplierName = row.supplier_name || '-';
        const supplierHoverInfo = `ID        : ${row.supplier_id || '-'}\nPhone : ${row.contact_number || '-'}\nEmail   : ${row.supplier_email || '-'}`;

        tbody.innerHTML += `
            <tr>
                <td>${row.batch_id}</td>
                <td>${row.medicine_name}</td>
                <td>${row.batch_number}</td>
                <td>${expiry}</td>
                <td><b>${row.quantity}</b></td>
                <td>${diffDays} days</td>
                <td>${statusHtml}</td>
                <td title="${supplierHoverInfo}">
                    <span class="badge bg-light text-dark border">
                        ${supplierName}
                    </span>
                </td>
                <td>${actionHtml}</td>
            </tr>
        `;
    });
    
    if (window.currentLang && window.currentLang !== 'en' && typeof applyPageTranslation === 'function') {
        applyPageTranslation(window.currentLang);
    }
}

function filterBatchesByStatus() {
    const selectedStatus = document.getElementById('statusFilter').value;
    const today = new Date();

    if (!selectedStatus) {
        renderBatchTable(allBatchesData);
        return;
    }

    const filtered = allBatchesData.filter(row => {
        if (!row.expiry_date) return false;
        const diffDays = Math.ceil((new Date(row.expiry_date) - today) / (1000 * 60 * 60 * 24));

        if (selectedStatus === 'Expired') {
            return diffDays <= 0;
        } 
        else if (selectedStatus === 'Near Expiry') {
            return diffDays > 0 && diffDays <= 90;
        } 
        else if (selectedStatus === 'Good') {
            return diffDays > 90;
        }
        return true;
    });

    renderBatchTable(filtered);
}

function loadBatches() {
    fetch('/api/batches')
        .then(res => res.json())
        .then(data => {
            allBatchesData = data;
            filterBatchesByStatus();
        });
}

document.getElementById('statusFilter').addEventListener('change', filterBatchesByStatus);

// Confirm For Write Off
window.writeOffBatch = function(batchId, medicineId, qty) {
    if (confirm(`Are you sure you want to write off ${qty} units of this expired batch?`)) {
        fetch('/api/write-off-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                batch_id: batchId,
                medicine_id: medicineId,
                quantity: qty
            })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                alert('Batch written off successfully!');
                loadBatches();
            } 
            else {
                alert('Error: ' + data.message);
            }
        });
    }
};

loadBatches();