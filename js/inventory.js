//Type of medicine in each Group
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

const catSelect = document.getElementById('category');
const typeSelect = document.getElementById('medicine_type');

function updateTypeOptions(selectedCat, currentType = '') {
    typeSelect.innerHTML = '<option value="">-- Select Medicine Type --</option>';
    if (typeMapping[selectedCat]) {
        typeMapping[selectedCat].forEach(t => {
            const isSelected = t === currentType ? 'selected' : '';
            typeSelect.innerHTML += `<option value="${t}" ${isSelected}>${t}</option>`;
        });
    } 
    else {
        typeSelect.innerHTML = '<option value="">-- Please select category first --</option>';
    }
}

catSelect.addEventListener('change', () => {
    updateTypeOptions(catSelect.value);
});

let allMedicines = [];

function getUserRole() {
    return sessionStorage.getItem('userRole') || 'staff';
}

// Restrict frontend UI permissions based on user role
function applyRolePermissions() {
    const role = getUserRole();
    const openAddBtn = document.getElementById('openAddModalBtn');
    
    // Hide 'Add New Medicine' button for non-admin users
    if (role !== 'admin' && openAddBtn) {
        openAddBtn.style.display = 'none';
    }
}

// Modal control elements
const medModal = document.getElementById('medModal');
const openAddModalBtn = document.getElementById('openAddModalBtn');
const closeMedModalX = document.getElementById('closeMedModalX');
const closeMedModalBtn = document.getElementById('closeMedModalBtn');

// Open modal for adding a new medicine
if (openAddModalBtn) {
    openAddModalBtn.addEventListener('click', () => {
        document.getElementById('medForm').reset();
        document.getElementById('medicine_id').readOnly = false;
        document.getElementById('formTitle').innerText = 'Add New Medicine';
        setSubmitBtnText('Save Medicine ✔');
        document.getElementById('previewImage').style.display = 'none';
        updateTypeOptions('');
        medModal.style.display = 'block';
    });
}

// Close modal helper function
function closeMedModal() {
    medModal.style.display = 'none';
}

if (closeMedModalX) closeMedModalX.addEventListener('click', closeMedModal);
if (closeMedModalBtn) closeMedModalBtn.addEventListener('click', closeMedModal);

// Close modal when clicking outside the modal content area
window.addEventListener('click', (e) => {
    if (e.target === medModal) {
        closeMedModal();
    }
});

// Intercept form submission to handle image processing and send JSON payload
document.getElementById('medForm').addEventListener('submit', function(e) {
    e.preventDefault();

    const fileInput = document.getElementById('addMedicineImage');
    const file = fileInput.files[0];
    const isEdit = document.getElementById('medicine_id').readOnly;
    const endpoint = isEdit ? '/update-medicine' : '/add-medicine';

    const payload = {
        medicine_id: document.getElementById('medicine_id').value.trim(),
        medicine_name: document.getElementById('medicine_name').value.trim(),
        category: document.getElementById('category').value,
        medicine_type: document.getElementById('medicine_type').value,
        dosage_form: document.getElementById('dosage_form').value,
        cost_price: document.getElementById('cost_price').value,
        selling_price: document.getElementById('selling_price').value,
        minStock: document.getElementById('minStock').value,
        remarks: document.getElementById('remarks').value,
        userRole: getUserRole(),
        imageBase64: null,
        imageExt: null
    };

    if (file) {
        const reader = new FileReader();
        reader.onload = function() {
            payload.imageBase64 = reader.result;
            payload.imageExt = file.name.split('.').pop();
            sendData(endpoint, payload);
        };
        reader.readAsDataURL(file);
    } 
    else {
        sendData(endpoint, payload);
    }
});

function sendData(endpoint, payload) {
    fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            alert('Saved successfully!');
            location.reload();
        } 
        else {
            alert('Error: ' + data.message);
        }
    })
    .catch(err => alert('Request failed: ' + err.message));
}

// Render grid cards dynamically
function renderGrid(list) {
    const gridContainer = document.getElementById('medicineGrid');
    gridContainer.innerHTML = '';
    
    if (!list || list.length === 0) {
        gridContainer.innerHTML = '<p class="text-center text-muted">No medicines found.</p>';
        return;
    }

    const role = getUserRole(); // Fetch current logged-in role

    list.forEach(m => {
        const currentQty = Number(m.current_units || 0);
        const qtyDisplay = currentQty <= m.minStock ? `<b class="text-danger">${currentQty}</b>` : `<b>${currentQty}</b>`;
        
        // Display image if available, otherwise show placeholder icon
        const imgTag = m.image_url 
            ? `<img src="${m.image_url}" alt="${m.medicine_name}" class="card-img">` 
            : `<div class="card-img-placeholder"><i class="fa-solid fa-pills"></i></div>`;

        // Render Edit and Delete action buttons ONLY for admin users
        const adminActions = (role === 'admin') ? `
            <button type="button" class="btn-action btn-edit" onclick="editMed('${m.medicine_id}')">Edit</button>
            <button type="button" class="btn-action btn-delete" onclick="deleteMed('${m.medicine_id}')">Delete</button>
        ` : '';

        // Construct card HTML structure
        const cardHTML = `
            <div class="medicine-card">
                <div class="card-img-wrapper">
                    ${imgTag}
                </div>
                <div class="card-body">
                    <div class="card-id">${m.medicine_id}</div>
                    <div class="card-name" title="${m.medicine_name}">${m.medicine_name}</div>
                    <div class="card-qty">Stock: ${qtyDisplay}</div>
                </div>
                <div class="card-actions">
                    <button type="button" class="btn-action btn-view" onclick="viewMed('${m.medicine_id}')">View Detail</button>
                    ${adminActions}
                </div>
            </div>
        `;
        gridContainer.innerHTML += cardHTML;
    });
    
    if (window.currentLang && window.currentLang !== 'en' && typeof applyPageTranslation === 'function') {
        applyPageTranslation(window.currentLang);
    }
}

function loadMedicines() {
    fetch('/api/medicines')
        .then(res => res.json())
        .then(data => {
            allMedicines = data;
            renderGrid(allMedicines); 
        })
        .catch(err => console.error('Error loading medicines:', err));
}

function previewSelectedImage(event) {
    const input = event.target;
    const preview = document.getElementById('previewImage');
    
    if (input.files && input.files[0]) {
        preview.src = URL.createObjectURL(input.files[0]);
        preview.style.display = 'block';
    }
}

function setSubmitBtnText(text) {
    const span = document.getElementById('submitBtnText');
    if (span) {
        span.textContent = text;
    }

    if (window.currentLang && window.currentLang !== 'en' && typeof applyPageTranslation === 'function') {
        applyPageTranslation(window.currentLang);
    }
}

//View the medicine detail
window.viewMed = function(id) {
    const m = allMedicines.find(item => item.medicine_id === id);
    if (!m) return;
    alert(
        `[ Medicine Details ]\n` +
        `Medicine ID          : ${m.medicine_id}\n` +
        `Medicine Name    : ${m.medicine_name}\n` +
        `Category               : ${m.category}\n` +
        `Medicine Type      : ${m.medicine_type}\n` +
        `Dosage Form        : ${m.dosage_form}\n` +
        `Current In Stock    : ${m.current_units || 0} units\n` +
        `Cost                       : RM ${Number(m.cost_price).toFixed(2)}\n` +
        `Selling Price           : RM ${Number(m.selling_price).toFixed(2)}\n` +
        `Minimum Stock     : ${m.minStock} units\n` +
        `Medicine Remarks : ${m.remarks || '-'}`
    );
};

window.editMed = function(id) {
    const m = allMedicines.find(item => item.medicine_id === id);
    if (!m) return;

    document.getElementById('medicine_id').value = m.medicine_id;
    document.getElementById('medicine_id').readOnly = true;
    document.getElementById('medicine_name').value = m.medicine_name;
    document.getElementById('category').value = m.category;
    updateTypeOptions(m.category, m.medicine_type);
    document.getElementById('dosage_form').value = m.dosage_form;
    document.getElementById('cost_price').value = m.cost_price;
    document.getElementById('selling_price').value = m.selling_price;
    document.getElementById('minStock').value = m.minStock;
    document.getElementById('remarks').value = m.remarks || '-';

    if (m.image_url){
        const preview = document.getElementById('previewImage');
        preview.src = m.image_url;
        preview.style.display = 'block';
    } 
    else{
        document.getElementById('previewImage').style.display = 'none';
    }

    document.getElementById('formTitle').innerText = 'Edit Medicine (' + m.medicine_id + ')';
    setSubmitBtnText('Update Medicine ✎');
    
    // Open the modal for editing
    medModal.style.display = 'block';
};

window.deleteMed = function(id) {
    const m = allMedicines.find(item => item.medicine_id === id);
    if (!m) return;

    const currentQty = Number(m.current_units || 0);
    if (currentQty > 0) {
        alert(`Cannot delete ${m.medicine_name} (${id})!\nThere are still ${currentQty} units remaining in stock.`);
        return;
    }

    if (confirm(`Are you sure you want to delete ${m.medicine_name} (${id})?`)) {

        fetch('/api/delete-medicine', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ medicine_id: id, userRole: getUserRole() })
        })

        .then(res => res.json())
        .then(data => {
            if (data.success){
                alert('Medicine deleted successfully!');
                loadMedicines();
            } 
            else{
                alert('Error: ' + data.message);
            }
        })
        .catch(err => alert('Failed to delete medicine: ' + err.message));
    }
};

document.getElementById('searchMedBtn').addEventListener('click', () => {
    const query = document.getElementById('searchMedInput').value.toLowerCase();
    const filtered = allMedicines.filter(m => 
        m.medicine_name.toLowerCase().includes(query) || 
        m.medicine_id.toLowerCase().includes(query)
    );
    renderGrid(filtered); 
});

document.getElementById('resetFilterBtn').addEventListener('click', () => {
    document.getElementById('searchMedInput').value = '';
    renderGrid(allMedicines); 
});

applyRolePermissions();
loadMedicines();