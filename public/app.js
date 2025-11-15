let currentStudent = null;
let html5QrcodeScanner = null;
let currentStream = null;
let isFlashOn = false;

const SELLER_PASSWORD = 'school123';

// Автоматически запрашиваем камеру при входе в сканер
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
            requestCameraPermission();
        }, 1000);
    } else {
        showMessage('passwordMessage', '❌ Неверный пароль! Попробуйте снова.', true);
    }
}

function showMessage(elementId, message, isError = false) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.className = `status-message ${isError ? 'error' : 'success'}`;
    element.style.display = 'block';
    
    setTimeout(() => {
        element.style.display = 'none';
    }, 3000);
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

// Запрос разрешения на камеру и запуск сканера
async function requestCameraPermission() {
    try {
        showMessage('operationMessage', '🔄 Запрашиваю доступ к камере...', false);
        
        // Сначала проверяем поддержку медиа устройств
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('Ваш браузер не поддерживает доступ к камере');
        }

        // Запрашиваем доступ к камере
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: 'environment', // Предпочтительно задняя камера
                width: { ideal: 1280 },
                height: { ideal: 720 }
            } 
        });

        currentStream = stream;
        
        // Скрываем сообщение о разрешении
        document.getElementById('cameraPermission').style.display = 'none';
        
        // Активируем кнопку вспышки
        document.getElementById('flashToggleBtn').disabled = false;
        document.getElementById('qr-reader').classList.add('camera-active');
        
        showMessage('operationMessage', '✅ Камера активирована! Наведите на QR-код', false);
        
        // Запускаем сканер QR-кодов
        initializeScanner(stream);
        
    } catch (error) {
        console.error('Ошибка доступа к камере:', error);
        let errorMessage = '❌ Не удалось получить доступ к камере. ';
        
        if (error.name === 'NotAllowedError') {
            errorMessage += 'Разрешение было отклонено.';
        } else if (error.name === 'NotFoundError') {
            errorMessage += 'Камера не найдена.';
        } else if (error.name === 'NotSupportedError') {
            errorMessage += 'Ваш браузер не поддерживает эту функцию.';
        } else {
            errorMessage += error.message;
        }
        
        showMessage('operationMessage', errorMessage, true);
    }
}

// Инициализация сканера QR-кодов
function initializeScanner(stream) {
    try {
        html5QrcodeScanner = new Html5QrcodeScanner("qr-reader", { 
            fps: 10,
            qrbox: { width: 250, height: 250 },
            supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
            showTorchButtonIfSupported: true
        });

        html5QrcodeScanner.render(onScanSuccess, onScanFailure);
        
    } catch (error) {
        console.error('Ошибка инициализации сканера:', error);
        showMessage('operationMessage', '❌ Ошибка запуска сканера QR-кодов', true);
    }
}

// Управление вспышкой
async function toggleFlash() {
    if (!currentStream) {
        showMessage('operationMessage', '❌ Сначала включите камеру', true);
        return;
    }

    try {
        const videoTrack = currentStream.getVideoTracks()[0];
        
        if (!videoTrack) {
            throw new Error('Видео поток не найден');
        }

        // Пытаемся управлять вспышкой через ImageCapture API
        const imageCapture = new ImageCapture(videoTrack);
        const capabilities = videoTrack.getCapabilities();
        
        if (capabilities.torch) {
            isFlashOn = !isFlashOn;
            await videoTrack.applyConstraints({
                advanced: [{ torch: isFlashOn }]
            });
            
            const flashBtn = document.getElementById('flashToggleBtn');
            flashBtn.textContent = isFlashOn ? '💡 Выключить вспышку' : '🔦 Включить вспышку';
            flashBtn.classList.toggle('btn-success', isFlashOn);
            flashBtn.classList.toggle('btn-warning', !isFlashOn);
            
            showMessage('operationMessage', isFlashOn ? '💡 Вспышка включена' : '🔦 Вспышка выключена', false);
        } else {
            showMessage('operationMessage', '❌ Ваше устройство не поддерживает управление вспышкой', true);
        }
        
    } catch (error) {
        console.error('Ошибка управления вспышкой:', error);
        showMessage('operationMessage', '❌ Не удалось управлять вспышкой', true);
    }
}

// Остановка камеры
function stopCamera() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }
    
    if (html5QrcodeScanner) {
        html5QrcodeScanner.clear();
        html5QrcodeScanner = null;
    }
    
    // Показываем сообщение о разрешении снова
    document.getElementById('cameraPermission').style.display = 'block';
    document.getElementById('flashToggleBtn').disabled = true;
    document.getElementById('qr-reader').classList.remove('camera-active');
    document.getElementById('flashToggleBtn').textContent = '🔦 Включить вспышку';
    document.getElementById('flashToggleBtn').classList.remove('btn-success');
    document.getElementById('flashToggleBtn').classList.add('btn-warning');
    
    showMessage('operationMessage', '⏹️ Камера остановлена', false);
}

// Обработка успешного сканирования
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

// Обработка ошибок сканирования
function onScanFailure(error) {
    // Игнорируем частые ошибки сканирования - это нормально
    if (!error.includes('No MultiFormat Readers')) {
        console.log('Ошибка сканирования:', error);
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
    stopCamera();
    currentStudent = null;
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
        subtractBalance();
    }
});

// Автоматически останавливаем камеру при закрытии страницы
window.addEventListener('beforeunload', function() {
    stopCamera();
});

console.log('🚀 SehriyoPay загружен!');
