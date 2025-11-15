let currentStudent = null;
let html5QrcodeScanner = null;

// Пароль для продавцов (можно поменять)
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
    const messageElement = document.getElementById('passwordMessage');
    
    if (!password) {
        showMessage('passwordMessage', '❌ Введите пароль', true);
        return;
    }
    
    if (password === SELLER_PASSWORD) {
        showMessage('passwordMessage', '✅ Успешный вход!', false);
        setTimeout(() => {
            showScreen('scannerScreen');
            initializeScanner();
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

function initializeScanner() {
    try {
        html5QrcodeScanner = new Html5QrcodeScanner("qr-reader", { 
            fps: 10,
            qrbox: { width: 250, height: 250 },
            supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
            facingMode: "environment"
        });

        html5QrcodeScanner.render(onScanSuccess);
        
        // Вспышка
        document.getElementById('flashBtn').addEventListener('click', function() {
            alert('📱 На мобильных устройствах вспышка включается автоматически при слабом освещении. Для ручного управления используйте кнопки громкости.');
        });
        
        console.log('Сканер QR-кодов инициализирован');
    } catch (error) {
        console.error('Ошибка инициализации сканера:', error);
        alert('⚠️ Ошибка при запуске камеры. Проверьте разрешения браузера.');
    }
}

async function onScanSuccess(decodedText) {
    try {
        console.log('📱 Сканирован QR-код:', decodedText);
        
        const response = await fetch(`/api/student/${decodedText}`);
        const student = await response.json();
        
        if (student && !student.error) {
            currentStudent = student;
            displayStudentInfo(student);
            showMessage('operationMessage', '✅ Ученик найден!', false);
        } else {
            showMessage('operationMessage', '❌ Ученик не найден в системе', true);
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showMessage('operationMessage', '⚠️ Ошибка сети. Проверьте подключение к интернету.', true);
    }
}

function displayStudentInfo(student) {
    document.getElementById('studentName').textContent = `${student.firstName} ${student.lastName}`;
    document.getElementById('studentClass').textContent = student.class;
    document.getElementById('studentBalance').textContent = `${student.balance} баллов`;
    document.getElementById('studentInfo').style.display = 'block';
    
    // Прокручиваем к информации об ученике
    document.getElementById('studentInfo').scrollIntoView({ behavior: 'smooth' });
}

async function addBalance() {
    if (!currentStudent) {
        showMessage('operationMessage', '❌ Сначала отсканируйте QR-код ученика', true);
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
        showMessage('operationMessage', '⚠️ Ошибка сети. Проверьте подключение к интернету.', true);
    }
}

async function subtractBalance() {
    if (!currentStudent) {
        showMessage('operationMessage', '❌ Сначала отсканируйте QR-код ученика', true);
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
        showMessage('operationMessage', '⚠️ Ошибка сети. Проверьте подключение к интернету.', true);
    }
}

function logout() {
    currentStudent = null;
    if (html5QrcodeScanner) {
        html5QrcodeScanner.clear().catch(error => {
            console.log('Сканер уже остановлен');
        });
    }
    document.getElementById('password').value = '';
    document.getElementById('studentInfo').style.display = 'none';
    document.getElementById('amount').value = '100';
    showScreen('passwordScreen');
}

// Enter для пароля
document.getElementById('password').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        checkPassword();
    }
});

// Enter для суммы
document.getElementById('amount').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        // При нажатии Enter в поле суммы - списываем (как в кассовых аппаратах)
        subtractBalance();
    }
});

console.log('🚀 SehriyoPay загружен!');