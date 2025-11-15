let currentStudent = null;
const SELLER_PASSWORD = 'school123';

function showMessage(elementId, message, isError = false) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.className = `status-message ${isError ? 'error' : 'success'}`;
    element.style.display = 'block';
    
    setTimeout(() => {
        element.style.display = 'none';
    }, 3000);
}

function checkPassword() {
    const password = document.getElementById('password').value;
    
    if (!password) {
        showMessage('passwordMessage', '❌ Введите пароль', true);
        return;
    }
    
    if (password === SELLER_PASSWORD) {
        showMessage('passwordMessage', '✅ Успешный вход!', false);
        setTimeout(() => {
            showScreen('scannerScreen');
        }, 1000);
    } else {
        showMessage('passwordMessage', '❌ Неверный пароль! Попробуйте снова.', true);
    }
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

// Функция для ручного ввода QR-кода из поля
function manualQRInputFromField() {
    const qrCode = document.getElementById('manualQRInput').value.trim();
    if (qrCode) {
        fetchStudentInfo(qrCode);
    } else {
        showMessage('operationMessage', '❌ Введите QR-код', true);
    }
}

// Функция для быстрого ввода тестового QR-кода
function manualQRInput() {
    fetchStudentInfo('TEST123');
}

// Поиск ученика по QR-коду
async function fetchStudentInfo(qrCode) {
    try {
        showMessage('operationMessage', '🔄 Поиск ученика...', false);
        
        const response = await fetch(`/api/student/${qrCode}`);
        const student = await response.json();
        
        if (student && !student.error) {
            currentStudent = student;
            displayStudentInfo(student);
            showMessage('operationMessage', '✅ Ученик найден!', false);
        } else {
            showMessage('operationMessage', '❌ Ученик не найден', true);
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showMessage('operationMessage', '⚠️ Ошибка сети', true);
    }
}

function displayStudentInfo(student) {
    document.getElementById('studentName').textContent = `${student.firstName} ${student.lastName}`;
    document.getElementById('studentClass').textContent = student.class;
    document.getElementById('studentBalance').textContent = `${student.balance} баллов`;
    document.getElementById('studentInfo').style.display = 'block';
    
    document.getElementById('studentInfo').scrollIntoView({ behavior: 'smooth' });
}

async function addBalance() {
    if (!currentStudent) {
        showMessage('operationMessage', '❌ Сначала найдите ученика', true);
        return;
    }
    
    const amount = parseInt(document.getElementById('amount').value);
    if (!amount || amount <= 0) {
        showMessage('operationMessage', '💰 Введите корректную сумму', true);
        return;
    }

    try {
        showMessage('operationMessage', '⏳ Обработка операции...', false);
        
        const response = await fetch(`/api/student/${currentStudent.id}/add`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ amount })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showMessage('operationMessage', `✅ Баланс пополнен на ${amount} баллов`, false);
            currentStudent.balance = result.newBalance;
            displayStudentInfo(currentStudent);
        } else {
            showMessage('operationMessage', '❌ Ошибка: ' + result.error, true);
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showMessage('operationMessage', '⚠️ Ошибка сети', true);
    }
}

async function subtractBalance() {
    if (!currentStudent) {
        showMessage('operationMessage', '❌ Сначала найдите ученика', true);
        return;
    }
    
    const amount = parseInt(document.getElementById('amount').value);
    if (!amount || amount <= 0) {
        showMessage('operationMessage', '💰 Введите корректную сумму', true);
        return;
    }

    if (amount > currentStudent.balance) {
        showMessage('operationMessage', '❌ Недостаточно средств на балансе', true);
        return;
    }

    try {
        showMessage('operationMessage', '⏳ Обработка операции...', false);
        
        const response = await fetch(`/api/student/${currentStudent.id}/subtract`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ amount })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showMessage('operationMessage', `✅ Списано ${amount} баллов`, false);
            currentStudent.balance = result.newBalance;
            displayStudentInfo(currentStudent);
        } else {
            showMessage('operationMessage', '❌ Ошибка: ' + result.error, true);
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showMessage('operationMessage', '⚠️ Ошибка сети', true);
    }
}

function logout() {
    currentStudent = null;
    document.getElementById('password').value = '';
    document.getElementById('studentInfo').style.display = 'none';
    document.getElementById('amount').value = '100';
    document.getElementById('manualQRInput').value = '';
    showScreen('passwordScreen');
}

// Enter для пароля
document.getElementById('password').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        checkPassword();
    }
});

// Enter для поля QR-кода
document.getElementById('manualQRInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        manualQRInputFromField();
    }
});

// Enter для суммы
document.getElementById('amount').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        subtractBalance();
    }
});

console.log('🚀 SehriyoPay загружен!');
