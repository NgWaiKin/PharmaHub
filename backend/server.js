const express = require('express');
const axios = require('axios');
const bcrypt = require('bcrypt');
const mysql = require('mysql2');
const path = require('path');
const fs = require('fs'); 

const app = express();
const rootDir = path.join(__dirname, '..');

//Create an uploads folder to save picture for the medicine
const uploadDir = path.join(rootDir, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));

app.use('/uploads', express.static(path.join(rootDir, 'uploads')));

// login.html as the main page
app.get('/', (req, res) => {
    res.redirect('/login.html');
});

app.use(express.static(rootDir, { index: false }));

// MySQL database connection
const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'pharmahub_db',
  port: process.env.DB_PORT || 3306,
  dateStrings: true,

  // Enable SSL connection for Aiven cloud database in production or when DB_SSL is true
  ssl: process.env.DB_SSL === 'true' || process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : undefined
});

// Connect to the database and handle connection status
db.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL database:', err);
    return;
  }
  console.log('Connected to MySQL successfully!');
});

// ==================== 1. User Login Side ====================
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    // Validate inputs
    if (!username || !password){
        return res.status(400).json({ success: false, message: 'Please provide both username and password!' });
    }

    try{
        // Fix: Use .promise().query() to support await with mysql2
        const [rows] = await db.promise().query('SELECT * FROM staffs WHERE username = ?', [username]);

        if (rows.length === 0){
            return res.status(401).json({ success: false, message: 'Invalid username or password!' });
        }

        const user = rows[0];

        // Compare plain password with the stored bcrypt hashed password
        const isMatch = await bcrypt.compare(password, user.user_password);

        if (!isMatch){
            return res.status(401).json({ success: false, message: 'Invalid username or password!' });
        }

        // Authentication success: return basic user info along with the role
        return res.json({
            success: true,
            message: 'Login successful',
            user: {
                user_id: user.user_id,
                username: user.username,
                role: user.role // Returns 'admin' or 'staff'
            }
        });

    }
    catch (error){
        console.error('Login error:', error);
        return res.status(500).json({ success: false, message: 'Database error: ' + error.message });
    }
});

// ==================== 2. Medicine ====================
// Get medicine list with real-time stock 
app.get('/api/medicines', (req, res) => {
    const sql = `SELECT m.*, IFNULL(SUM(b.quantity), 0) AS current_units 
        FROM medicines m 
        LEFT JOIN batches b ON m.medicine_id = b.medicine_id 
        GROUP BY m.medicine_id
    `;
    db.query(sql, (err, results) => {
        if (err) 
            return res.status(500).json({ success: false, message: err.message });
        res.json(results);
    });
});

//Add new medicine
app.post('/add-medicine', (req, res) => {
    const { medicine_id, medicine_name, category, medicine_type, dosage_form, cost_price, selling_price, minStock, imageBase64, imageExt, remarks } = req.body;
    
    let imageUrl = null;
    if (imageBase64 && imageExt) {
        try {
            const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            const fileName = `med_${Date.now()}.${imageExt}`;
            const filePath = path.join(rootDir, 'uploads', fileName);
            fs.writeFileSync(filePath, buffer);
            imageUrl = `/uploads/${fileName}`;
        } 
        catch (fsErr) {
            return res.status(500).json({ success: false, message: 'Failed to save image: ' + fsErr.message });
        }
    }

    const sql = 'INSERT INTO medicines (medicine_id, medicine_name, category, medicine_type, dosage_form, cost_price, selling_price, minStock, image_url, remarks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    db.query(sql, [medicine_id, medicine_name, category, medicine_type, dosage_form, cost_price, selling_price, minStock, imageUrl, remarks], (err) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Error inserting medicine: ' + err.message });
        }
        res.json({ success: true });
    });
});

// ==================== Edit Medicine (Update) ====================
app.post('/update-medicine', (req, res) => {
    const { medicine_id, medicine_name, category, medicine_type, dosage_form, cost_price, selling_price, minStock, imageBase64, imageExt, remarks} = req.body;
    
    let imageSqlPart = '';
    let params = [medicine_name, category, medicine_type, dosage_form, cost_price, selling_price, minStock, remarks];

    // Check if a new image was provided in the request
    if (imageBase64 && imageExt) {
        try {
            const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            const fileName = `med_${Date.now()}.${imageExt}`;
            const filePath = path.join(rootDir, 'uploads', fileName);
            fs.writeFileSync(filePath, buffer);
            imageSqlPart = ', image_url = ?';
            params.push(`/uploads/${fileName}`);
        } 
        catch (fsErr) {
            return res.status(500).json({ success: false, message: 'Failed to update image: ' + fsErr.message });
        }
    }

    params.push(medicine_id);
    const sql = `UPDATE medicines SET medicine_name = ?, category = ?, medicine_type = ?, dosage_form = ?, cost_price = ?, selling_price = ?, minStock = ?, remarks = ? ${imageSqlPart} WHERE medicine_id = ?`;

    db.query(sql, params, (err) => {
        if (err) 
            return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true });
    });
});

// ==================== Delete Medicine (Delete) ====================
app.post('/api/delete-medicine', (req, res) => {
    const { medicine_id } = req.body;

    // Check Medicine Stock
    const checkStockSql = 'SELECT SUM(quantity) AS total_stock FROM batches WHERE medicine_id = ? AND quantity > 0';
    db.query(checkStockSql, [medicine_id], (err, results) => {
        if (err) 
            return res.status(500).json({ success: false, message: err.message });

        const totalStock = results[0].total_stock || 0;
        if (totalStock > 0) {
            return res.status(400).json({ 
                success: false, 
                message: `Cannot delete medicine. There are still ${totalStock} units in stock!` 
            });
        }

        // Delete when the medicine id out of stock
        const deleteSql = 'DELETE FROM medicines WHERE medicine_id = ?';
        db.query(deleteSql, [medicine_id], (err2) => {
            if (err2) 
                return res.status(500).json({ success: false, message: err2.message });
            res.json({ success: true });
        });
    });
});

// ==================== Batches ====================
app.get('/api/batches', (req, res) => {
    const sql = `
        SELECT b.*, m.medicine_name, m.category, m.cost_price, s.*
        FROM batches b
        JOIN medicines m ON b.medicine_id = m.medicine_id
        LEFT JOIN suppliers s ON b.supplier_id = s.supplier_id
        ORDER BY CAST(SUBSTRING_INDEX(b.batch_id, '-', -1) AS UNSIGNED) ASC
    `;
    db.query(sql, (err, results) => {
        if (err) 
            return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// ====================== Supplier =======================
app.get('/api/suppliers', (req, res) => {
    const sql = 'SELECT * FROM suppliers';
    db.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching suppliers:', err);
            return res.status(500).json({ success: false, message: err.message });
        }
        res.json(results);
    });
});

// ==================== (Stock In) ====================
app.post('/add-stock-in', async (req, res) => {
    // Destructure supplier_id and user_id from req.body
    const { medicine_id, quantity, expiry_date, supplier_id, user_id } = req.body;
    const qtyNum = parseInt(quantity, 10);

    // Validate inputs including supplier_id
    if (!medicine_id || !qtyNum || qtyNum <= 0 || !expiry_date || !supplier_id) {
        return res.status(400).json({ success: false, message: 'Please provide valid input.' });
    }

    try {
        // Create batch_id and batch_number with date and following number
        const { nextBatchId, nextBatchNumber } = await generateNextBatchDetails();
        const inbound_date = new Date().toISOString().slice(0, 10);

        // Insert into batches table with supplier_id included
        await new Promise((resolve, reject) => {
            const batchSql = 'INSERT INTO batches (batch_id, medicine_id, batch_number, inbound_date, expiry_date, quantity, supplier_id) VALUES (?, ?, ?, ?, ?, ?, ?)';
            db.query(batchSql, [nextBatchId, medicine_id, nextBatchNumber, inbound_date, expiry_date, qtyNum, supplier_id], (err) => {
                if (err) 
                    return reject(err);
                resolve();
            });
        });

        const { nextTxnId, nextTxnCode } = await generateNextTxnDetails();

        // Insert into stock_transaction table with user_id included
        const txnSql = 'INSERT INTO stock_transaction (txn_id, txn_code, batch_id, medicine_id, txn_type, qty_change, reason, user_id) VALUES (?, ?, ?, ?, \'Stock In\', ?, \'Add Stock\', ?)';
        db.query(txnSql, [nextTxnId, nextTxnCode, nextBatchId, medicine_id, qtyNum, user_id || null], (err2) => {
            if (err2) 
                return res.status(500).json({ success: false, message: err2.message });
            res.json({ success: true });
        });
    } 
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ==================== Stock Out ====================
app.post('/add-stock-out', async (req, res) => {
    const { medicine_id, deduct_qty, reason, user_id } = req.body;
    let remainingToDeduct = parseInt(deduct_qty, 10);

    const findBatchesSql = `
        SELECT batch_id, quantity FROM batches 
        WHERE medicine_id = ? AND quantity > 0 AND (expiry_date > CURDATE() OR expiry_date IS NULL) 
        ORDER BY expiry_date ASC, batch_id ASC
    `;

    db.query(findBatchesSql, [medicine_id], async (err, batches) => {
        if (err) 
            return res.status(500).json({ success: false, message: err.message });
        if (!batches || batches.length === 0) {
            return res.status(400).json({ success: false, message: 'No valid sellable batches available.' });
        }

        const totalValidStock = batches.reduce((sum, b) => sum + Number(b.quantity), 0);
        if (remainingToDeduct > totalValidStock) {
            return res.status(400).json({ 
                success: false, 
                message: `Insufficient stock! Total sellable units: ${totalValidStock}` 
            });
        }

        try {
            //For loop for contiunue to deduct the stock if early batch not enough
            for (let i = 0; i < batches.length && remainingToDeduct > 0; i++) {
                const batch = batches[i];
                const currentBatchQty = Number(batch.quantity);

                let deductFromThisBatch = 0;
                if (currentBatchQty <= remainingToDeduct) {
                    deductFromThisBatch = currentBatchQty;
                    remainingToDeduct -= currentBatchQty;
                } 
                else {
                    deductFromThisBatch = remainingToDeduct;
                    remainingToDeduct = 0;
                }

                const newBatchQty = currentBatchQty - deductFromThisBatch;

                await new Promise((resolve, reject) => {
                    db.query('UPDATE batches SET quantity = ? WHERE batch_id = ?', [newBatchQty, batch.batch_id], (e) => {
                        if (e) 
                            return reject(e);
                        resolve();
                    });
                });

                const { nextTxnId, nextTxnCode } = await generateNextTxnDetails();

                const txnSql = `
                    INSERT INTO stock_transaction (txn_id, txn_code, batch_id, medicine_id, txn_type, qty_change, reason, user_id) 
                    VALUES (?, ?, ?, ?, 'Stock Out', ?, ?, ?)
                `;
                await new Promise((resolve, reject) => {
                    db.query(txnSql, [nextTxnId, nextTxnCode, batch.batch_id, medicine_id, -deductFromThisBatch, reason, user_id], (e) => {
                        if (e) 
                            return reject(e);
                        resolve();
                    });
                });
            }

            res.json({ success: true });
        } 
        catch (error){
            res.status(500).json({ success: false, message: error.message });
        }
    });
});

// ==================== Write Off Medicine (After expiry date) ====================
app.post('/api/write-off-batch', async (req, res) => {
    const { batch_id, medicine_id, quantity } = req.body;

    try {
        await new Promise((resolve, reject) => {
            db.query('UPDATE batches SET quantity = 0 WHERE batch_id = ?', [batch_id], (err) => {
                if (err) 
                    return reject(err);
                resolve();
            });
        });

        const { nextTxnId, nextTxnCode } = await generateNextTxnDetails();

        const txnSql = `
            INSERT INTO stock_transaction (txn_id, txn_code, batch_id, medicine_id, txn_type, qty_change, reason) 
            VALUES (?, ?, ?, ?, 'Stock Out', ?, "Expired Write-off (Loss)")
        `;
        db.query(txnSql, [nextTxnId, nextTxnCode, batch_id, medicine_id, -Number(quantity)], (err2) => {
            if (err2) 
                return res.status(500).json({ success: false, message: err2.message });
            res.json({ success: true });
        });
    } 
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ==================== 6. Report ====================
// Currenry rates API
app.get('/api/external/currency-rates', async (req, res) => {
    try {
        const apiKey = process.env.CURRENCY_API_KEY;
        
        // Fetch live exchange rates from 3rd-party CurrencyAPI
        const response = await axios.get("https://api.currencyapi.com/v3/latest", {
            params: { 
                apikey: apiKey, 
                currencies: 'MYR,USD,CNY,EUR' 
            }
        });

        const rates = response.data.data;
        const myrRate = rates.MYR.value; // Base rate against USD

        // Normalize rates relative to MYR (1 MYR = X Foreign Currency)
        res.json({
            success: true,
            rates: {
                MYR: 1,
                USD: parseFloat((rates.USD.value / myrRate).toFixed(4)),
                CNY: parseFloat((rates.CNY.value / myrRate).toFixed(4)),
                EUR: parseFloat((rates.EUR.value / myrRate).toFixed(4))
            }
        });
    }
    catch (error) {
        console.error('Currency API Fetch Error:', error.message);
        
        // Use the currency rates if the API is not access
        res.json({
            success: true,
            rates: { MYR: 1, USD: 0.21, CNY: 1.52, EUR: 0.19 }
        });
    }
});

app.get('/api/reports', (req, res) => {
    const sql = `
        SELECT t.*, m.medicine_name, m.cost_price, m.selling_price, s.username
        FROM stock_transaction t
        LEFT JOIN medicines m ON t.medicine_id = m.medicine_id
        LEFT JOIN staffs s ON t.user_id = s.user_id
        ORDER BY t.txn_time DESC
    `;
    db.query(sql, (err, results) => {
        if (err) 
            return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

//============== API Translate Section ===============
const translationCache = {}; // Memory cache to store translated strings and avoid redundant API requests
const fallbackDictionary = {
    // General Message (Nav Bar) 
    'Please enter your credentials to login': 'Sila masukkan maklumat anda untuk log masuk',
    'User Login': 'Log Masuk Pengguna',
    'Username': 'Nama Pengguna',
    'Password': 'Kata Laluan',
    'Login': 'Log Masuk',
    'Logged in as': 'Log masuk sebagai',
    'Logout': 'Log Keluar',
    'Time:': 'Masa:',
    'Dashboard': 'Papan Pemuka',
    'Inventory': 'Inventori',
    'Stock In/Out': 'Stok Masuk/Keluar',
    'Batch & Expiry': 'Kelompok & Tamat Tempoh',
    'Reports': 'Laporan',

    // Dashboard Page
    'PharmaHub Dashboard': 'Papan Pemuka PharmaHub',
    'Total Registered SKUs': 'Jumlah SKU Berdaftar',
    'Total Units in Stock': 'Jumlah Unit dalam Stok',
    'Near-Expiry Batches': 'Kelompok Hampir Luput',
    'Low Stock Alerts': 'Amaran Stok Rendah',
    'Near Expiry Batches': 'Kelompok Hampir Luput',
    'Batch Number': 'Nombor Kelompok',
    'Medicine Name': 'Nama Ubat',
    'Category': 'Kategori',
    'Stock Left': 'Stok Tertinggal',
    'Expiry Date': 'Tarikh Luput',
    'Days Remain': 'Baki Hari',
    'Risk Level': 'Tahap Risiko',

    // Inventory Page
    'PharmaHub Inventory': 'Inventori PharmaHub',
    'Search & Filter': 'Cari & Penapis',
    'Search Medicine': 'Cari Ubat',
    'Search': 'Cari',
    'Reset': 'Set Semula',
    'Registered Drug List': 'Senarai Ubat Berdaftar',
    'Overview of all registered medicine items in inventory': 'Gambaran keseluruhan semua item ubat berdaftar dalam inventori',
    'Add New Medicine': 'Tambah Ubat Baru',
    'Medicine ID': 'ID Ubat',
    'Medicine Image': 'Gambar Ubat',
    'Medicine Type': 'Jenis Ubat',
    'Dosage Form': 'Bentuk Ubat',
    'Cost Price (RM)': 'Harga (RM)',
    'Selling Price (RM)': 'Harga Jualan (RM)',
    'Minimum Safety Stock': 'Stok Keselamatan Minimum',
    'Medicine Remarks': 'Catatan Ubat',
    'Save Medicine ✔': 'Simpan Ubat ✔',
    'Update Medicine ✎': 'Kemas Kini Ubat ✔',
    'Cancel': 'Batal',

    //  Batch & Expiry Tracker Page
    'PharmaHub Batch Tracker': 'Penjejak Kelompok PharmaHub',
    'Filter by Status': 'Tapis mengikut Status',
    'Select Status': 'Pilih Status',
    'All Batches in Storage': 'Semua Kelompok dalam Simpanan',
    'Batch ID': 'ID Kelompok',
    'Remaining Quantity': 'Kuantiti Tertinggal',
    'Status': 'Status',
    'Supplier': 'Pembekal',
    'Action': 'Tindakan',
    'Select a medicine to view batches': 'Pilih ubat untuk lihat kelompok',

    // Stock In/Out Page
    'PharmaHub Stock Operations': 'Operasi Stok PharmaHub',
    'Stock In (Receive Inventory)': 'Stok Masuk (Terima Inventori)',
    'Select Supplier': 'Pilih Pembekal',
    'Select a medicine to view batches': 'Pilih ubat untuk lihat kelompok',
    'Select Medicine': 'Pilih Ubat',
    'Existing Batches': 'Batch Sedia Ada',
    'Quantity': 'Kuantiti',
    'Submit Stock In': 'Hantar Stok Masuk',
    'Stock Out (Dispense / Deduct)': 'Stok Keluar (Agih / Potong)',
    'Available Batches (Deduct Order)': 'Kelompok Tersedia (Pesanan Potongan)',
    'Deduct Quantity': 'Kuantiti Potongan',
    'Stock Out Reason': 'Sebab Stok Keluar',
    'Confirm Stock Out': 'Sahkan Stok Keluar',

    // Reports Page
    'PharmaHub Audit Trail Reports': 'Laporan Jejak Audit PharmaHub',
    'Filter Transaction Logs': 'Tapis Log Transaksi',
    'Search by Medicine Name': 'Cari mengikut Nama Ubat',
    'Filter by Type': 'Tapis mengikut Jenis',
    'Stock Movement Transaction Logs': 'Log Transaksi Pergerakan Stok',
    'Transaction Time': 'Masa Transaksi',
    'Medicine': 'Ubat',
    'Type': 'Jenis',
    'Quantity Change': 'Perubahan Kuantiti',
    'Reason': 'Sebab',
    'Total Amount': 'Jumlah Amaun',
    'Action By': 'Tindakan Oleh'
};

app.get('/api/external/translate', async (req, res) => {
    try {
        const { text, targetLang } = req.query;

        // Validate if text is provided in the query parameters
        if (!text) {
            return res.status(400).json({ success: false, message: 'Text is required' });
        }

        const lang = targetLang || 'ms';
        const cacheKey = `${lang}:${text}`;

        // Return cached translation immediately if available to bypass external API call limits
        if (translationCache[cacheKey]) {
            return res.json({
                success: true,
                translated_text: translationCache[cacheKey]
            });
        }

        const response = await axios.get('https://api.mymemory.translated.net/get', {
            params: {
                q: text,
                langpair: `en|${lang}`,
                de: 'waikin.ng@qiu.edu.my' // Email for higher daily free quota
            },
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 8000
        });

        // 3. Parse MyMemory response format
        if (response.data && response.data.responseData && response.data.responseData.translatedText) {
            const translatedText = response.data.responseData.translatedText;

            // Check for MyMemory warning (quota exhausted)
            if (translatedText.includes('MYMEMORY WARNING') || translatedText.includes('PLEASE SELECT TWO DISTINCT LANGUAGES')) {
                console.warn('MyMemory quota warning, using fallback dictionary');
                const fallback = fallbackDictionary[text] || text;
                return res.json({ success: false, translated_text: fallback });
            }

            translationCache[cacheKey] = translatedText;
            return res.json({
                success: true,
                translated_text: translatedText
            });
        } 
        else {
            // API returned empty data, use fallback dictionary
            const fallback = fallbackDictionary[text] || text;
            return res.json({ success: false, translated_text: fallback });
        }
    }
    catch (error){
        console.error('Translation API Error:', error.message);
        const fallback = fallbackDictionary[req.query.text] || req.query.text;
        res.json({ success: false, translated_text: fallback });
    }
});
// ==================== Real-Time Weather API Proxy (Open-Meteo) ====================
let weatherCache = {
    data: null,
    lastFetched: 0
};

const WEATHER_CACHE_DURATION = 10 * 60 * 1000;

app.get('/api/external/weather', async (req, res) => {
    try {
        const currentTime = Date.now();

        if (weatherCache.data && (currentTime - weatherCache.lastFetched < WEATHER_CACHE_DURATION)) {
            return res.json(weatherCache.data);
        }

        const weatherUrl = 'https://api.open-meteo.com/v1/forecast?latitude=4.5825&longitude=101.0948&current=temperature_2m,relative_humidity_2m,weather_code';
        const response = await axios.get(weatherUrl);
        
        const data = response.data;
        res.json({
            success: true,
            current: data.current,
            units: data.current_units
        });
    } 
    catch (error) {
        console.error('Weather API Error:', error.message);

        if (weatherCache.data) {
            return res.json(weatherCache.data);
        }

        res.status(500).json({ success: false, message: 'Failed to fetch weather data' });
    }
});

// =========== Create batch_id (BTH-100X) and batch_number (BN-YYYYMMDD-XX) =========
function generateNextBatchDetails() {
    return new Promise((resolve, reject) => {
        // Check the larger number of batch_id
        const maxSql = `SELECT MAX(CAST(SUBSTRING_INDEX(batch_id, '-', -1) AS UNSIGNED)) AS max_id_num FROM batches`;

        db.query(maxSql, (err, resMax) => {
            if (err) 
                return reject(err);

            //Increase value from the larger batch_id
            const nextNum = (resMax[0].max_id_num && resMax[0].max_id_num >= 1000) 
                ? resMax[0].max_id_num + 1 
                : 1001;
            const nextBatchId = `BTH-${nextNum}`;

            // Getting the Date with Format YYYYMMDD
            const now = new Date();
            const y = now.getFullYear();
            const m = String(now.getMonth() + 1).padStart(2, '0');
            const d = String(now.getDate()).padStart(2, '0');
            const bnPrefix = `BN-${y}${m}${d}-`;

            // heck how many batches have been generated for the same day
            const bnSql = `SELECT batch_number FROM batches WHERE batch_number LIKE ? ORDER BY batch_number DESC LIMIT 1`;
            db.query(bnSql, [`${bnPrefix}%`], (err2, resBn) => {
                if (err2) 
                    return reject(err2);

                let seq = 1;
                if (resBn.length > 0 && resBn[0].batch_number) {
                    const parts = resBn[0].batch_number.split('-');
                    seq = parseInt(parts[2], 10) + 1;
                }
                const nextBatchNumber = `${bnPrefix}${String(seq).padStart(2, '0')}`;

                resolve({ nextBatchId, nextBatchNumber });
            });
        });
    });
}

// =========== Create Fixed Format Of Transaction ID and Code =========
function generateNextTxnDetails() {
    return new Promise((resolve, reject) => {
        // 1. Check the MAX Value of txn_id 
        const maxSql = `
            SELECT MAX(CAST(SUBSTRING_INDEX(txn_id, '-', -1) AS UNSIGNED)) AS max_id_num
            FROM stock_transaction
        `;
        db.query(maxSql, (err, resMax) => {
            if (err) 
                return reject(err);

            //Increase the number id from max_id
            const nextNum = (resMax[0].max_id_num && resMax[0].max_id_num >= 1000) 
                ? resMax[0].max_id_num + 1 
                : 1001;
            const nextTxnId = `TSC-${nextNum}`;

            // 2. Getting the Date Format YYYYMMDD
            const now = new Date();
            const y = now.getFullYear();
            const m = String(now.getMonth() + 1).padStart(2, '0');
            const d = String(now.getDate()).padStart(2, '0');
            const datePrefix = `TXN-${y}${m}${d}-`;

            // Check how many transactions have been generated for the same day
            const codeSql = `SELECT txn_code FROM stock_transaction WHERE txn_code LIKE ? ORDER BY txn_code DESC LIMIT 1`;
            db.query(codeSql, [`${datePrefix}%`], (err2, resCode) => {
                if (err2) 
                    return reject(err2);

                let seq = 1;
                if (resCode.length > 0) {
                    const lastCode = resCode[0].txn_code;
                    const parts = lastCode.split('-');
                    seq = parseInt(parts[2], 10) + 1;
                }
                const nextTxnCode = `${datePrefix}${String(seq).padStart(3, '0')}`;

                resolve({ nextTxnId, nextTxnCode });
            });
        });
    });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Local link: http://localhost:${PORT}`);
});