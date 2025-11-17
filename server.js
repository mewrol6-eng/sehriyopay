const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Инициализация базы данных
const db = new sqlite3.Database(':memory:'); // Используем память для демо, для продакшена замени на файл

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
    
    db.run(`CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_id INTEGER UNIQUE,
        username TEXT,
        is_active BOOLEAN DEFAULT 1
    )`);
    
    // Добавляем тестовых учеников
    db.run(`INSERT OR IGNORE INTO students (first_name, last_name, class, qr_code, balance) VALUES 
        ('Иван', 'Иванов', '5А', 'TEST123', 500),
        ('Мария', 'Петрова', '6Б', 'TEST456', 300),
        ('Алексей', 'Сидоров', '7В', 'TEST789', 750)
    `);
});

// Пароль продавца (в продакшене храни в .env)
const SELLER_PASSWORD = 'school123';

// ==================== ВЕБ-ИНТЕРФЕЙС ENDPOINTS ====================

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

// Списать баллы
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
                        [studentId, 'subtract', amount, 'Списание баллов']);
                    
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

// Получить ученика по ID
app.get('/api/students/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        db.get('SELECT * FROM students WHERE id = ?', [id], (err, student) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            
            if (!student) {
                return res.status(404).json({ error: 'Student not found' });
            }
            
            res.json(student);
        });
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Добавить администратора
app.post('/api/admin/add', async (req, res) => {
    try {
        const { telegram_id, username } = req.body;
        
        db.run(`INSERT OR REPLACE INTO admins (telegram_id, username) VALUES (?, ?)`,
            [telegram_id, username],
            function(err) {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ error: 'Database error' });
                }
                
                res.json({ success: true, message: 'Admin added successfully' });
            }
        );
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Проверить является ли пользователь админом
app.get('/api/admin/check/:telegramId', async (req, res) => {
    try {
        const { telegramId } = req.params;
        
        db.get('SELECT * FROM admins WHERE telegram_id = ? AND is_active = 1', [telegramId], (err, admin) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            
            res.json({ isAdmin: !!admin });
        });
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ==================== ЗАПУСК СЕРВЕРА ====================

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📱 Endpoints available:`);
    console.log(`   📍 Web interface: http://localhost:${PORT}`);
    console.log(`   🔗 API: http://localhost:${PORT}/api/`);
    console.log(`   👥 Students: http://localhost:${PORT}/api/students`);
    console.log(`   📊 Stats: http://localhost:${PORT}/api/stats`);
});
