const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Инициализация базы данных
const db = new sqlite3.Database(':memory:');

// Создание таблиц
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        qr_code TEXT UNIQUE,
        first_name TEXT,
        last_name TEXT,
        class TEXT,
        balance INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER,
        type TEXT,
        amount INTEGER,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(student_id) REFERENCES students(id)
    )`);
    
    // Добавляем только одного ученика - Саидамира
    db.run(`INSERT OR IGNORE INTO students (first_name, last_name, class, qr_code, balance) VALUES 
        ('Саидамир', 'Асходжаев', '9Д', '0001', 1000)
    `);
});

// Пароль продавца
const SELLER_PASSWORD = 'school123';

// ==================== API ENDPOINTS ====================

// Главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Получить информацию об ученике по QR-коду
app.get('/api/student/:qrCode', async (req, res) => {
    try {
        const { qrCode } = req.params;
        
        db.get(`SELECT * FROM students WHERE qr_code = ?`, [qrCode], (err, student) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            
            if (!student) {
                return res.status(404).json({ error: 'Student not found' });
            }
            
            res.json({
                id: student.id,
                firstName: student.first_name,
                lastName: student.last_name,
                class: student.class,
                balance: student.balance,
                qrCode: student.qr_code
            });
        });
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Пополнить баланс
app.post('/api/student/:id/add', async (req, res) => {
    try {
        const studentId = req.params.id;
        const { amount } = req.body;
        
        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }

        db.serialize(() => {
            db.run(`UPDATE students SET balance = balance + ? WHERE id = ?`, [amount, studentId], function(err) {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ error: 'Database error' });
                }
                
                if (this.changes === 0) {
                    return res.status(404).json({ error: 'Student not found' });
                }
                
                // Записываем транзакцию
                db.run(`INSERT INTO transactions (student_id, type, amount, description) VALUES (?, ?, ?, ?)`,
                    [studentId, 'add', amount, 'Пополнение баланса']);
                
                // Получаем обновленные данные ученика
                db.get(`SELECT * FROM students WHERE id = ?`, [studentId], (err, student) => {
                    if (err) {
                        return res.status(500).json({ error: 'Database error' });
                    }
                    
                    res.json({ 
                        success: true, 
                        newBalance: student.balance,
                        message: 'Balance added successfully'
                    });
                });
            });
        });
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Списать эльки
app.post('/api/student/:id/subtract', async (req, res) => {
    try {
        const studentId = req.params.id;
        const { amount } = req.body;
        
        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }

        db.serialize(() => {
            // Проверяем достаточно ли средств
            db.get(`SELECT balance FROM students WHERE id = ?`, [studentId], (err, student) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ error: 'Database error' });
                }
                
                if (!student) {
                    return res.status(404).json({ error: 'Student not found' });
                }
                
                if (student.balance < amount) {
                    return res.status(400).json({ error: 'Insufficient funds' });
                }
                
                // Списание средств
                db.run(`UPDATE students SET balance = balance - ? WHERE id = ?`, [amount, studentId], function(err) {
                    if (err) {
                        console.error('Database error:', err);
                        return res.status(500).json({ error: 'Database error' });
                    }
                    
                    // Записываем транзакцию
                    db.run(`INSERT INTO transactions (student_id, type, amount, description) VALUES (?, ?, ?, ?)`,
                        [studentId, 'subtract', amount, 'Списание эльков']);
                    
                    // Получаем обновленные данные ученика
                    db.get(`SELECT * FROM students WHERE id = ?`, [studentId], (err, updatedStudent) => {
                        if (err) {
                            return res.status(500).json({ error: 'Database error' });
                        }
                        
                        res.json({ 
                            success: true, 
                            newBalance: updatedStudent.balance,
                            message: 'Balance subtracted successfully'
                        });
                    });
                });
            });
        });
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ==================== TELEGRAM BOT ENDPOINTS ====================

// Получить всех учеников
app.get('/api/students', async (req, res) => {
    try {
        db.all('SELECT * FROM students ORDER BY class, last_name', (err, students) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(students || []);
        });
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Добавить ученика
app.post('/api/students', async (req, res) => {
    try {
        const { first_name, last_name, class: studentClass, qr_code } = req.body;
        
        if (!first_name || !last_name || !studentClass || !qr_code) {
            return res.status(400).json({ error: 'Все поля обязательны' });
        }
        
        db.run(
            'INSERT INTO students (first_name, last_name, class, qr_code) VALUES (?, ?, ?, ?)',
            [first_name, last_name, studentClass, qr_code],
            function(err) {
                if (err) {
                    console.error('Database error:', err);
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(400).json({ error: 'Ученик с таким QR-кодом уже существует' });
                    }
                    return res.status(500).json({ error: 'Database error' });
                }
                res.json({ success: true, id: this.lastID });
            }
        );
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Удалить ученика
app.delete('/api/students/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        db.run('DELETE FROM students WHERE id = ?', [id], function(err) {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Student not found' });
            }
            res.json({ success: true });
        });
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Получить статистику
app.get('/api/stats', async (req, res) => {
    try {
        db.serialize(() => {
            // Статистика по ученикам
            db.get('SELECT COUNT(*) as total_students, SUM(balance) as total_balance, AVG(balance) as average_balance FROM students', (err, studentStats) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ error: 'Database error' });
                }
                
                // Статистика по операциям
                db.get('SELECT COUNT(*) as total_transactions, SUM(amount) as total_amount FROM transactions', (err, transactionStats) => {
                    if (err) {
                        console.error('Database error:', err);
                        return res.status(500).json({ error: 'Database error' });
                    }
                    
                    res.json({
                        total_students: studentStats.total_students || 0,
                        total_balance: studentStats.total_balance || 0,
                        average_balance: studentStats.average_balance || 0,
                        total_transactions: transactionStats.total_transactions || 0,
                        total_amount: transactionStats.total_amount || 0
                    });
                });
            });
        });
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Получить историю операций
app.get('/api/transactions', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        
        const query = `
            SELECT t.*, s.first_name, s.last_name, s.class 
            FROM transactions t 
            LEFT JOIN students s ON t.student_id = s.id 
            ORDER BY t.created_at DESC 
            LIMIT ?
        `;
        
        db.all(query, [limit], (err, transactions) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(transactions || []);
        });
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Генератор QR-кода
app.get('/api/qr/:qrCode', async (req, res) => {
    try {
        const { qrCode } = req.params;
        
        // Генерируем QR-код
        const qrCodeDataURL = await QRCode.toDataURL(qrCode, {
            width: 300,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });
        
        // Отправляем QR-код как base64 изображение
        res.json({ 
            success: true, 
            qrCode: qrCodeDataURL,
            downloadUrl: `${req.protocol}://${req.get('host')}/api/qr-download/${qrCode}`
        });
        
    } catch (error) {
        console.error('QR generation error:', error);
        res.status(500).json({ error: 'QR generation failed' });
    }
});

// Скачивание QR-кода
app.get('/api/qr-download/:qrCode', async (req, res) => {
    try {
        const { qrCode } = req.params;
        
        const qrBuffer = await QRCode.toBuffer(qrCode, {
            width: 300,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });
        
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Disposition', `attachment; filename="qr-${qrCode}.png"`);
        res.send(qrBuffer);
        
    } catch (error) {
        console.error('QR download error:', error);
        res.status(500).json({ error: 'QR download failed' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
