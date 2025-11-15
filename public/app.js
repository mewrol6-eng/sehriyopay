let currentStudent = null;
let stream = null;
let animationFrame = null;
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
        
        // Останавливаем предыдущую камеру если есть
        if (stream) {
            stopCamera();
        }
        
        // Запрашиваем доступ к камере
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: "environment",
                width: { ideal: 1280 },
                height: { ideal: 720 }
            } 
        });
        
        // Показываем видео
        const video = document.getElementById('camera-video');
        video.srcObject = stream;
        video.style.display = 'block';
        
        // Скрываем сообщение о разрешении
        document.getElementById('cameraPermission').style.display = 'none';
        document.getElementById('stopCameraBtn').style.display = 'block';
        document.getElementById('camera-container').classList.add('camera-active');
        
        showMessage('operationMessage', '✅ Камера активна! Наведите на QR-код', false);
        
        // Запускаем распознавание QR-кодов
        startQRScanning();
        
    } catch (error) {
        console.error('Ошибка камеры:', error);
        let errorMessage = '❌ Ошибка камеры: ';
        
        if (error.name === 'NotAllowedError') {
            errorMessage += 'Доступ к камере запрещен. Разрешите доступ в настройках браузера.';
        } else if (error.name === 'NotFoundError') {
            errorMessage += 'Камера не найдена.';
        } else if (error.name === 'NotSupportedError') {
            errorMessage += 'Браузер не поддерживает камеру.';
        } else if (error.name === 'NotReadableError') {
            errorMessage += 'Камера уже используется другим приложением.';
        } else {
            errorMessage += error.message;
        }
        
        showMessage('operationMessage', errorMessage, true);
    }
}

// Распознавание QR-кодов
function startQRScanning() {
    const video = document.getElementById('camera-video');
    const canvas = document.getElementById('canvas');
    const context = canvas.getContext('2d');
    
    function scanQR() {
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            
            // Рисуем текущий кадр видео на canvas
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            // Получаем данные изображения
            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
            
            // Распознаем QR-код
            const code = jsQR(imageData.data, imageData.width, imageData.height);
            
            if (code) {
                console.log('✅ Найден QR-код:', code.data);
                onQRCodeDetected(code.data);
                return; // Останавливаем сканирование после нахождения кода
            }
        }
        
        // Продолжаем сканирование
        animationFrame = requestAnimationFrame(scanQR);
    }
    
    // Запускаем сканирование
    video.addEventListener('loadeddata', scanQR);
}

// Обработка найденного QR-кода
async function onQRCodeDetected(qrCode) {
    try {
        // Останавливаем камеру
        stopCamera();
        
        showMessage('operationMessage', '📱 Обрабатываю QR-код...', false);
        
        const response = await fetch(`/api/student/${qrCode}`);
        const student = await response.json();
        
        if (student && !student.error) {
            currentStudent = student;
            displayStudentInfo(student);
            showMessage('operationMessage', '✅ Ученик найден!', false);
        } else {
            showMessage('operationMessage', '❌ Ученик не найден', true);
            // Перезапускаем камеру через 2 секунды
            setTimeout(() => {
                startCamera();
            }, 2000);
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showMessage('operationMessage', '⚠️ Ошибка при обработке QR-кода', true);
        // Перезапускаем камеру через 2 секунды
        setTimeout(() => {
            startCamera();
        }, 2000);
    }
}

// Остановка камеры
function stopCamera() {
    if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = null;
    }
    
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    
    // Скрываем видео
    const video = document.getElementById('camera-video');
    video.style.display = 'none';
    video.srcObject = null;
    
    // Показываем сообщение о разрешении
    document.getElementById('cameraPermission').style.display = 'block';
    document.getElementById('stopCameraBtn').style.display = 'none';
    document.getElementById('camera-container').classList.remove('camera-active');
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
