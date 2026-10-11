const typeMapping = {
    'Group B': [
        'Antibiotics & Antimicrobials',
        'Sleeping Pills & Sedatives',
        'Blood Pressure (Antihypertensives)',
        'Cholesterol (Statins)',
        'Diabetic Medications',
        'Blood Thinners (Oral Anticoagulants)',
        'Prescription Pain Relief'
    ],
    'Group C': [
        'Decongestants',
        'Mild Sleep Aids & Allergy',
        'Cough & Respiratory Remedies'
    ],
    'Group OTC': [
        'Pain & Fever Relief',
        'Antacids (Gastrointestinal)'
    ]
};

let medicineList = [];
let batchList = [];

function loadSuppliers() {
    fetch('/api/suppliers')
        .then(res => res.json())
        .then(suppliers => {
            const supplierSelect = document.getElementById('inSupplier');
            if (!supplierSelect)
                return;

            supplierSelect.innerHTML = '<option value="">Select Supplier</option>';
            suppliers.forEach(supplier => {
                const option = document.createElement('option');
                option.value = supplier.supplier_id;
                option.textContent = supplier.supplier_name;
                supplierSelect.appendChild(option);
            });
        })
        .catch(err => console.error('Failed to load suppliers:', err));
}

// Batch Detail
function renderBatchDetails(medId, listElId, onlySellable = false) {
    const listEl = document.getElementById(listElId);
    if (!listEl) return;

    if (!medId) {
        listEl.innerHTML = '<li class="text-muted">Select a medicine to view batches</li>';
        return;
    }

    const today = new Date();
    let matched = batchList.filter(b => b.medicine_id === medId && Number(b.quantity) > 0);

    // Show the valid stock
    if (onlySellable) {
        matched = matched.filter(b => b.expiry_date && new Date(b.expiry_date) > today);
    }

    // Asecding Order with the date
    matched.sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date));

    if (matched.length === 0) {
        listEl.innerHTML = '<li class="text-muted">No active batches in storage</li>';
        return;
    }

    listEl.innerHTML = '';
    matched.forEach(b => {
        const expStr = b.expiry_date ? b.expiry_date.slice(0, 10) : '-';
        listEl.innerHTML += `
            <li>
                <span><b>${b.batch_number}</b> (Exp: ${expStr})</span>
                <span class="text-info"><b>${b.quantity}</b> units</span>
            </li>
        `;
    });
}

// Option for the medicine
function populateMedicines(selectElement, filteredList) {
    selectElement.innerHTML = '<option value="">-- Choose Medicine --</option>';
    filteredList.forEach(med => {
        selectElement.innerHTML += `<option value="${med.medicine_id}">${med.medicine_name} (${med.medicine_id})</option>`;
    });
}

// Reload the Batch Data
function reloadBatches() {
    return fetch('/api/batches')
        .then(res => res.json())
        .then(batches => {
            batchList = batches;
            renderBatchDetails(document.getElementById('inMedicine').value, 'inBatchList', false);
            renderBatchDetails(document.getElementById('outMedicine').value, 'outBatchList', true);
        });
}

// Step By Step select form Category to Medicine Type until Medicine
function setupCascade(catId, typeId, medId, listElId, onlySellable) {
    const catEl = document.getElementById(catId);
    const typeEl = document.getElementById(typeId);
    const medEl = document.getElementById(medId);

    catEl.addEventListener('change', () => {
        const cat = catEl.value;
        typeEl.innerHTML = '<option value="">-- Please select medicine type --</option>';

        if (cat && typeMapping[cat]) {
            typeMapping[cat].forEach(t => {
                typeEl.innerHTML += `<option value="${t}">${t}</option>`;
            });
        }

        medEl.innerHTML = '<option value="">-- Please select medicine type first --</option>';
        renderBatchDetails('', listElId, onlySellable);
    });

    typeEl.addEventListener('change', () => {
        const cat = catEl.value;
        const type = typeEl.value;

        if (!type) {
            medEl.innerHTML = '<option value="">-- Please select medicine type first --</option>';
            renderBatchDetails('', listElId, onlySellable);
            return;
        }

        const filtered = medicineList.filter(m => {
            const matchCat = !cat || m.category === cat;
            const matchType = m.medicine_type === type;
            return matchCat && matchType;
        });

        populateMedicines(medEl, filtered);
        renderBatchDetails('', listElId, onlySellable);
    });

    medEl.addEventListener('change', () => {
        renderBatchDetails(medEl.value, listElId, onlySellable);
    });
}

// ==================== Limit ====================
// Expiry Date must after Current Date when Stock In
const inExpiryInput = document.getElementById('inExpiry');
if (inExpiryInput) {
    const minDate = new Date();
    minDate.setDate(minDate.getDate() + 30);
    inExpiryInput.min = minDate.toISOString().split('T')[0];
}

// Load for the option data
Promise.all([
    fetch('/api/medicines').then(res => res.json()),
    fetch('/api/batches').then(res => res.json())
]).then(([meds, batches]) => {
    medicineList = meds;
    batchList = batches;

    document.getElementById('inMedicine').innerHTML = '<option value="">-- Please select category & type first --</option>';
    document.getElementById('outMedicine').innerHTML = '<option value="">-- Please select category & type first --</option>';

    setupCascade('inCategory', 'inMedicineType', 'inMedicine', 'inBatchList', false);
    setupCascade('outCategory', 'outMedicineType', 'outMedicine', 'outBatchList', true);

    // Initialize suppliers dropdown
    loadSuppliers();
});

// ==================== Fetch ====================
document.getElementById('stockInForm').addEventListener('submit', (e) => {
    e.preventDefault();

    const expiryVal = document.getElementById('inExpiry').value;
    const selectedExpiry = new Date(expiryVal);
    const minAllowedDate = new Date();
    minAllowedDate.setDate(minAllowedDate.getDate() + 30);
    minAllowedDate.setHours(0, 0, 0, 0);

    if (selectedExpiry < minAllowedDate) {
        alert('Invalid Expiry Date! The expiry date must be at least 30 days from today.');
        return;
    }

    // Retrieve user_id from sessionStorage and supplier_id from dropdown
    const currentUserId = sessionStorage.getItem('userId');
    const supplierId = document.getElementById('inSupplier').value;

    if (!supplierId) {
        alert('Please select a supplier.');
        return;
    }

    const data = {
        medicine_id: document.getElementById('inMedicine').value,
        quantity: document.getElementById('inQty').value,
        expiry_date: expiryVal,
        supplier_id: supplierId,
        user_id: currentUserId
    };

    fetch('/add-stock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
    .then(res => res.json())
    .then(result => {
        if (result.success) {
            alert('Stock In successfully added!');
            document.getElementById('inQty').value = '';
            document.getElementById('inExpiry').value = '';
            document.getElementById('inSupplier').value = '';
            reloadBatches();
        } 
        else {
            alert('Error: ' + result.message);
        }
    })
    .catch(err => alert('Network error: ' + err.message));
});

document.getElementById('stockOutForm').addEventListener('submit', (e) => {
    e.preventDefault();

    // Retrieve current logged-in user_id from sessionStorage
    const currentUserId = sessionStorage.getItem('userId');

    const data = {
        medicine_id: document.getElementById('outMedicine').value,
        deduct_qty: document.getElementById('outQty').value,
        reason: document.getElementById('outReason').value,
        user_id: currentUserId
    };

    fetch('/add-stock-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
    .then(res => res.json())
    .then(result => {
        if (result.success) {
            alert('Stock Out successfully deducted!');
            document.getElementById('outQty').value = '';
            reloadBatches();
        } 
        else {
            alert('Error: ' + result.message);
        }
    })
    .catch(err => alert('Network error: ' + err.message));
});