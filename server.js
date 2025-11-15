const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Правильная настройка статических файлов
app.use(express.static(path.join(__dirname, 'public')));

app.use(bodyParser.json());

// База данных
const db = new sqlite3.Database('./school.db');

// Создаем таблицы при запуске
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        qr_code TEXT UNIQUE,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        class TEXT NOT NULL,
        phone TEXT,
        password TEXT,
        balance INTEGER DEFAULT 0
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER,
        amount INTEGER,
        type TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Добавляем тестового ученика
    db.run(`INSERT OR IGNORE INTO students (qr_code, first_name, last_name, class, phone, password, balance) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`, 
            ['TEST123', 'Иван', 'Иванов', '5А', '+998901234567', 'pass123', 1000]);
});

// API для получения информации об ученике
app.get('/api/student/:qrCode', (req, res) => {
    const qrCode = req.params.qrCode;
    db.get('SELECT * FROM students WHERE qr_code = ?', [qrCode], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (row) {
            res.json({
                id: row.id,
                firstName: row.first_name,
                lastName: row.last_name,
                class: row.class,
                balance: row.balance
            });
        } else {
            res.status(404).json({ error: 'Ученик не найден' });
        }
    });
});

// API для пополнения баланса
app.post('/api/student/:id/add', (req, res) => {
    const studentId = req.params.id;
    const amount = req.body.amount;

    if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Неверная сумма' });
    }

    db.run('UPDATE students SET balance = balance + ? WHERE id = ?', [amount, studentId], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        db.run('INSERT INTO transactions (student_id, amount, type) VALUES (?, ?, ?)', [studentId, amount, 'add']);
        
        db.get('SELECT balance FROM students WHERE id = ?', [studentId], (err, row) => {
            res.json({ 
                message: 'Баланс пополнен', 
                newBalance: row.balance 
            });
        });
    });
});

// API для списания баланса
app.post('/api/student/:id/subtract', (req, res) => {
    const studentId = req.params.id;
    const amount = req.body.amount;

    if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Неверная сумма' });
    }

    db.get('SELECT balance FROM students WHERE id = ?', [studentId], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        if (row.balance < amount) {
            return res.status(400).json({ error: 'Недостаточно средств' });
        }

        db.run('UPDATE students SET balance = balance - ? WHERE id = ?', [amount, studentId], function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            db.run('INSERT INTO transactions (student_id, amount, type) VALUES (?, ?, ?)', [studentId, amount, 'subtract']);
            
            db.get('SELECT balance FROM students WHERE id = ?', [studentId], (err, row) => {
                res.json({ 
                    message: 'Средства списаны', 
                    newBalance: row.balance 
                });
            });
        });
    });
});

// Главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Запуск сервера
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер запущен: http://localhost:${PORT}`);
});
