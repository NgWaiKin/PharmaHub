let allReports = [];
let isAscending = false;

// Global currency variables for API integration
let rates = { MYR: 1, USD: 0.21, CNY: 1.52, EUR: 0.19 }; // Fallback rates
let currIndex = 0; // 0: MYR, 1: USD, 2: CNY, 3: EUR
const currList = ['MYR', 'USD', 'CNY', 'EUR'];
const symbols = { MYR: 'RM ', USD: '$ ', CNY: '¥ ', EUR: '€ ' };

function initCurrency() {
    fetch('/api/external/currency-rates')
        .then(res => res.json())
        .then(data => {
            if (data.success && data.rates) {
                rates = data.rates; // Update with live API rates
            }
        })
        .catch(err => console.warn('Using fallback exchange rates:', err))
        .finally(() => {
            fetchReportsData(); // Fetch reports after rates are initialized
        });
}

function fetchReportsData() {
    fetch('/api/reports')
        .then(res => res.json())
        .then(data => {
            allReports = data;
            processAndDisplay();
        });
}

function renderTable(dataList) {
    const tbody = document.getElementById('reportsTableBody');
    tbody.innerHTML = '';

    if (dataList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No transaction records found.</td></tr>';
        return;
    }

    const curr = currList[currIndex];
    const rate = rates[curr] || 1;
    const symbol = symbols[curr] || '';

    dataList.forEach(row => {
        const time = row.txn_time ? row.txn_time.replace('T', ' ').slice(0, 19) : '-';
        const reasonText = (row.reason || '').toLowerCase();
        const operatorName = row.username || '-';

        // Reason with difference colour
        let qtyClass = 'text-addStock'; // Green (Add Stock)

        if (reasonText.includes('loss') || reasonText.includes('expired') || reasonText.includes('damaged')) {
            qtyClass = 'text-loss';  // Red (Loss)
        } 
        else if (reasonText.includes('sale') || reasonText.includes('dispense') || reasonText.includes('selling')) {
            qtyClass = 'text-selling';    // Blue (Selling)
        }

        // ==================== Financial Valuation Logic ====================
        const qty = Math.abs(row.qty_change || 0);
        
        // Loss & Stock In will use cost_price | Selling & Stock Out will use selling_price
        const price = (reasonText.includes('loss') || reasonText.includes('expired') || reasonText.includes('damaged') || row.txn_type === 'Stock In')
                      ? parseFloat(row.cost_price || 0)
                      : parseFloat(row.selling_price || 0);

        // Calculate converted total amount via 3rd-party API rate
        const convertedTotal = (qty * price * rate).toFixed(2);

        tbody.innerHTML += `
            <tr>
                <td>${row.txn_code}</td>
                <td>${time}</td>
                <td>${row.medicine_name || row.medicine_id}</td>
                <td>${row.batch_id}</td>
                <td>${row.txn_type}</td>
                <td class="${qtyClass}"><b>${row.qty_change}</b></td>
                <td>${row.reason}</td>
                <td class="fw-bold text-dark">${symbol}${convertedTotal}</td>
                <td>${operatorName}</td>
            </tr>
        `;
    });
}

function processAndDisplay() {
    const keyword = document.getElementById('filterKeyword').value.toLowerCase().trim();
    const type = document.getElementById('filterType').value;

    let filtered = allReports.filter(row => {
        const medName = (row.medicine_name || '').toLowerCase();
        const code = (row.txn_code || '').toLowerCase();
        const matchKeyword = !keyword || medName.includes(keyword) || code.includes(keyword);
        const matchType = !type || row.txn_type === type;
        return matchKeyword && matchType;
    });

    filtered.sort((a, b) => {
        const timeA = new Date(a.txn_time);
        const timeB = new Date(b.txn_time);
        return isAscending ? (timeA - timeB) : (timeB - timeA);
    });

    renderTable(filtered);
}

initCurrency();

fetch('/api/reports')
    .then(res => res.json())
    .then(data => {
        allReports = data;
        processAndDisplay();
    });

document.getElementById('applyFilterBtn').addEventListener('click', () => {
    processAndDisplay();
});

document.getElementById('resetFilterBtn').addEventListener('click', () => {
    document.getElementById('filterKeyword').value = '';
    document.getElementById('filterType').value = '';
    processAndDisplay();
});

document.getElementById('sortTimeBtn').addEventListener('click', () => {
    isAscending = !isAscending;
    const btn = document.getElementById('sortTimeBtn');
    btn.innerHTML = isAscending ? '&#x25B2; (ASC)' : '&#x25BC; (DESC)';
    processAndDisplay();
});

// Event Listener: Dynamic Currency Switcher Toggle Button
document.getElementById('currencyToggleBtn').addEventListener('click', () => {
    currIndex = (currIndex + 1) % currList.length;
    const curr = currList[currIndex];
    
    // Update button text indicator
    document.getElementById('currencyLabel').innerText = `(${curr})`;
    processAndDisplay(); // Re-render table with updated currency
});