// Ultra-simple server - NO dependencies needed!
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;
const DB_FILE = './database.json';

// Initialize database
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({
        students: [{
            id: 1,
            qr_code: 'TEST123',
            firstName: 'Иван',
            lastName: 'Иванов', 
            class: '5А',
            balance: 1000
        }],
        transactions: []
    }, null, 2));
}

// Read database
function readDB() {
    return JSON.parse(fs.readFileSync(DB_FILE));
}

// Write database  
function writeDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// Create server
const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    // Serve HTML
    if (pathname === '/' && req.method === 'GET') {
        serveFile(res, './public/index.html', 'text/html');
        return;
    }
    
    // Serve JS
    if (pathname === '/app.js' && req.method === 'GET') {
        serveFile(res, './public/app.js', 'application/javascript');
        return;
    }
    
    // API routes
    if (pathname.startsWith('/api/student/') && req.method === 'GET') {
        const qrCode = pathname.split('/')[3];
        handleGetStudent(res, qrCode);
        return;
    }
    
    if (pathname.match(/\/api\/student\/\d+\/add/) && req.method === 'POST') {
        const studentId = parseInt(pathname.split('/')[3]);
        handlePostRequest(req, res, studentId, 'add');
        return;
    }
    
    if (pathname.match(/\/api\/student\/\d+\/subtract/) && req.method === 'POST') {
        const studentId = parseInt(pathname.split('/')[3]);
        handlePostRequest(req, res, studentId, 'subtract');
        return;
    }
    
    // 404
    res.writeHead(404);
    res.end('Not found');
});

function serveFile(res, filePath, contentType) {
    const fullPath = path.join(__dirname, filePath);
    fs.readFile(fullPath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('File not found');
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(data);
        }
    });
}

function handleGetStudent(res, qrCode) {
    const db = readDB();
    const student = db.students.find(s => s.qr_code === qrCode);
    
    if (student) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            id: student.id,
            firstName: student.firstName,
            lastName: student.lastName, 
            class: student.class,
            balance: student.balance
        }));
    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Ученик не найден' }));
    }
}

function handlePostRequest(req, res, studentId, operation) {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
        try {
            const data = JSON.parse(body);
            const amount = data.amount;
            
            if (!amount || amount <= 0) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Неверная сумма' }));
                return;
            }
            
            const db = readDB();
            const studentIndex = db.students.findIndex(s => s.id === studentId);
            
            if (studentIndex === -1) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Ученик не найден' }));
                return;
            }
            
            if (operation === 'add') {
                db.students[studentIndex].balance += amount;
            } else {
                if (db.students[studentIndex].balance < amount) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Недостаточно средств' }));
                    return;
                }
                db.students[studentIndex].balance -= amount;
            }
            
            db.transactions.push({
                student_id: studentId,
                amount: amount,
                type: operation,
                timestamp: new Date().toISOString()
            });
            
            writeDB(db);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                message: operation === 'add' ? 'Баланс пополнен' : 'Средства списаны',
                newBalance: db.students[studentIndex].balance
            }));
            
        } catch (error) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Ошибка формата данных' }));
        }
    });
}

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер запущен: http://localhost:${PORT}`);
    console.log(`🔐 Пароль: school123 | QR-код: TEST123`);
    console.log(`📁 База данных: ${DB_FILE}`);
});