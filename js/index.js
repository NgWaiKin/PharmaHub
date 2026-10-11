// Calculate total valid stock and stock status
fetch('/api/medicines')
    .then(res => res.json())
    .then(medicines => {
        document.getElementById('dashTotalSkus').innerText = medicines.length;

        fetch('/api/batches')
            .then(res => res.json())
            .then(batches => {
                let lowStockCount = 0;
                const today = new Date();

                medicines.forEach(m => {
                    // Not expired will be calculate
                    const totalValidStock = batches
                        .filter(b => {
                            const isSameMed = b.medicine_id === m.medicine_id;
                            const isNotExpired = b.expiry_date && (new Date(b.expiry_date) > today);
                            return isSameMed && isNotExpired;
                        })
                        .reduce((sum, b) => sum + Number(b.quantity), 0);

                    if (totalValidStock <= m.minStock) {
                        lowStockCount++;
                    }
                });
                document.getElementById('dashLowStock').innerText = lowStockCount;
            });
    });

// 2. Valid status
fetch('/api/batches')
    .then(res => res.json())
    .then(batches => {
        let validSellableUnits = 0; // Only count the medicine can sell
        let nearExpiryCount = 0;
        const tableBody = document.getElementById('dashboardTable');
        tableBody.innerHTML = '';
        const today = new Date();

        batches.forEach(b => {
            if (b.expiry_date) {
                const expDate = new Date(b.expiry_date);
                const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));

                // Medicine that haven't expired
                if (diffDays > 0) {
                    validSellableUnits += Number(b.quantity);
                }

                // Medicine that Near to Expiry Date
                if (diffDays <= 90 && b.quantity > 0) {
                    nearExpiryCount++;
                    const riskClass = diffDays <= 0 ? 'text-danger' : 'text-warning';
                    const riskLabel = diffDays <= 0 ? 'Expired' : 'Near Expiry';
                    tableBody.innerHTML += `
                        <tr>
                            <td>${b.batch_number}</td>
                            <td>${b.medicine_name}</td>
                            <td>${b.category || '-'}</td>
                            <td><b>${b.quantity}</b></td>
                            <td>${b.expiry_date.slice(0, 10)}</td>
                            <td>${diffDays} days</td>
                            <td class="${riskClass}"><b>${riskLabel}</b></td>
                        </tr>
                    `;
                }
                if (window.currentLang && window.currentLang !== 'en' && typeof applyPageTranslation === 'function') {
                    applyPageTranslation(window.currentLang);
                }
            }
        });

        // Show the valid stock of medicine for sell
        document.getElementById('dashTotalUnits').innerText = validSellableUnits;
        document.getElementById('dashNearExpiry').innerText = nearExpiryCount;

        if (nearExpiryCount === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No near-expiry batches detected.</td></tr>';
        }
    });