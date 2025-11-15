let currentStudent = null;
let html5QrcodeScanner = null;
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

// Запуск камеры
async function startCamera() {
    try {
        showMessage('operationMessage', '🔄 Запрашиваю доступ к камере...', false);
        
        // Создаем сканер
        html5QrcodeScanner = new Html5Qrcode("qr-reader");
        
        // Конфигурация камеры
        const config = {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
        };

        // Запускаем камеру с задней камерой по умолчанию
        await html5QrcodeScanner.start(
            { facingMode: "environment" }, 
            config, 
            onScanSuccess, 
            onScanFailure
        );
        
        // Показываем элементы управления камерой
        document.getElementById('cameraPermission').style.display = 'none';
        document.getElementById('stopCameraBtn').style.display = 'block';
        document.getElementById('qr-reader').classList.add('camera-active');
        
        showMessage('operationMessage', '✅ Камера активна! Наведите на QR-код', false);
        
    } catch (error) {
        console.error('Ошибка камеры:', error);
        let errorMessage = '❌ Ошибка камеры: ';
        
        if (error.name === 'NotAllowedError') {
            errorMessage += 'Доступ к камере запрещен. Разрешите доступ в настройках браузера.';
        } else if (error.name === 'NotFoundError') {
            errorMessage += 'Камера не найдена.';
        } else if (error.name === 'NotSupportedError') {
            errorMessage += 'Браузер не поддерживает сканирование QR-кодов.';
        } else if (error.name === 'NotReadableError') {
            errorMessage += 'Камера уже используется другим приложением.';
        } else if (error.name === 'OverconstrainedError') {
            errorMessage += 'Не удалось запустить заднюю камеру. Попробуйте другое устройство.';
        } else {
            errorMessage += error.message;
        }
        
        showMessage('operationMessage', errorMessage, true);
        
        // Показываем кнопку для повторной попытки
        document.getElementById('cameraPermission').style.display = 'block';
    }
}

// Остановка камеры
async function stopCamera() {
    if (html5QrcodeScanner) {
        try {
            await html5QrcodeScanner.stop();
            html5QrcodeScanner.clear();
            html5QrcodeScanner = null;
            
            // Показываем сообщение о разрешении
            document.getElementById('cameraPermission').style.display = 'block';
            document.getElementById('stopCameraBtn').style.display = 'none';
            document.getElementById('qr-reader').classList.remove('camera-active');
            
            showMessage('operationMessage', '⏹️ Камера остановлена', false);
        } catch (error) {
            console.error('Ошибка остановки камеры:', error);
        }
    }
}

// Успешное сканирование
async function onScanSuccess(decodedText, decodedResult) {
    console.log('✅ QR-код распознан:', decodedText);
    
    try {
        // Временно останавливаем сканирование
        if (html5QrcodeScanner) {
            await html5QrcodeScanner.stop();
        }
        
        showMessage('operationMessage', '📱 Обрабатываю QR-код...', false);
        
        const response = await fetch(`/api/student/${decodedText}`);
        const student = await response.json();
        
        if (student && !student.error) {
            currentStudent = student;
            displayStudentInfo(student);
            showMessage('operationMessage', '✅ Ученик найден!', false);
        } else {
            showMessage('operationMessage', '❌ Ученик не найден', true);
            // Перезапускаем камеру через 2 секунды
            setTimeout(() => {
                if (html5QrcodeScanner) {
                    startCamera();
                }
            }, 2000);
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showMessage('operationMessage', '⚠️ Ошибка при обработке QR-кода', true);
        // Перезапускаем камеру через 2 секунды
        setTimeout(() => {
            if (html5QrcodeScanner) {
                startCamera();
            }
        }, 2000);
    }
}

// Ошибка сканирования
function onScanFailure(error) {
    // Игнорируем обычные ошибки сканирования
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
            
            // Перезапускаем камеру для следующего сканирования
            setTimeout(() => {
                if (!html5QrcodeScanner) {
                    startCamera();
                }
            }, 2000);
            
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
            
            // Перезапускаем камеру для следующего сканирования
            setTimeout(() => {
                if (!html5QrcodeScanner) {
                    startCamera();
                }
            }, 2000);
            
        } else {
            showMessage('operationMessage', '❌ Ошибка: ' + result.error, true);
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showMessage('operationMessage', '⚠️ Ошибка сети', true);
    }
}

function logout() {
    stopCamera();
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

// Автоматически останавливаем камеру при закрытии страницы
window.addEventListener('beforeunload', function() {
    stopCamera();
});

console.log('🚀 SehriyoPay загружен!');
