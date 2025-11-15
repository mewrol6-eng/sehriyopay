let currentStudent = null;
let html5Qrcode = null;
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
            initializeCamera();
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

// Инициализация камеры и сканирования
async function initializeCamera() {
    try {
        showMessage('operationMessage', '🔄 Запускаю камеру...', false);
        
        // Создаем экземпляр сканера
        html5Qrcode = new Html5Qrcode("qr-reader");
        
        // Конфигурация камеры
        const config = {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
            facingMode: "environment"
        };

        // Запускаем камеру и сканирование
        await html5Qrcode.start(
            { facingMode: "environment" }, 
            config, 
            onScanSuccess, 
            onScanFailure
        );
        
        // Скрываем сообщение о разрешении и показываем камеру
        document.getElementById('cameraPermission').style.display = 'none';
        document.getElementById('qr-reader').classList.add('camera-active');
        document.getElementById('flashToggleBtn').disabled = false;
        
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
        } else {
            errorMessage += error.message;
        }
        
        showMessage('operationMessage', errorMessage, true);
        
        // Показываем ручной ввод как запасной вариант
        document.getElementById('cameraPermission').style.display = 'block';
    }
}

// Успешное сканирование
async function onScanSuccess(decodedText, decodedResult) {
    console.log('✅ QR-код распознан:', decodedText);
    
    try {
        // Временно останавливаем сканирование чтобы избежать повторных срабатываний
        if (html5Qrcode) {
            await html5Qrcode.stop();
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
                restartCamera();
            }, 2000);
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showMessage('operationMessage', '⚠️ Ошибка при обработке QR-кода', true);
        // Перезапускаем камеру через 2 секунды
        setTimeout(() => {
            restartCamera();
        }, 2000);
    }
}

// Перезапуск камеры
async function restartCamera() {
    if (html5Qrcode) {
        try {
            await html5Qrcode.start(
                { facingMode: "environment" }, 
                { fps: 10, qrbox: { width: 250, height: 250 } }, 
                onScanSuccess, 
                onScanFailure
            );
            showMessage('operationMessage', '✅ Камера перезапущена', false);
        } catch (error) {
            console.error('Ошибка перезапуска камеры:', error);
        }
    }
}

// Ошибка сканирования
function onScanFailure(error) {
    // Игнорируем обычные ошибки сканирования - это нормально
}

// Управление вспышкой
async function toggleFlash() {
    if (!html5Qrcode) {
        showMessage('operationMessage', '❌ Сначала включите камеру', true);
        return;
    }

    try {
        // Получаем видеопоток
        const videoElement = document.querySelector('#qr-reader video');
        if (!videoElement) {
            throw new Error('Видео элемент не найден');
        }

        const stream = videoElement.srcObject;
        if (!stream) {
            throw new Error('Видеопоток не найден');
        }

        const track = stream.getVideoTracks()[0];
        if (!track) {
            throw new Error('Видеотрек не найден');
        }

        // Пытаемся управлять вспышкой
        const capabilities = track.getCapabilities();
        if (capabilities.torch) {
            const torch = !track.getSettings().torch;
            await track.applyConstraints({
                advanced: [{ torch: torch }]
            });
            
            const flashBtn = document.getElementById('flashToggleBtn');
            flashBtn.textContent = torch ? '💡 Выключить вспышку' : '🔦 Включить вспышку';
            flashBtn.classList.toggle('btn-success', torch);
            flashBtn.classList.toggle('btn-warning', !torch);
            
            showMessage('operationMessage', torch ? '💡 Вспышка включена' : '🔦 Вспышка выключена', false);
        } else {
            showMessage('operationMessage', '❌ Ваше устройство не поддерживает вспышку', true);
        }
        
    } catch (error) {
        console.error('Ошибка вспышки:', error);
        showMessage('operationMessage', '❌ Не удалось управлять вспышкой', true);
    }
}

// Остановка камеры
async function stopCamera() {
    if (html5Qrcode) {
        try {
            await html5Qrcode.stop();
            console.log('Камера остановлена');
        } catch (error) {
            console.error('Ошибка остановки камеры:', error);
        }
        html5Qrcode.clear();
        html5Qrcode = null;
    }
    
    // Показываем сообщение о разрешении
    document.getElementById('cameraPermission').style.display = 'block';
    document.getElementById('flashToggleBtn').disabled = true;
    document.getElementById('qr-reader').classList.remove('camera-active');
    document.getElementById('flashToggleBtn').textContent = '🔦 Включить вспышку';
    document.getElementById('flashToggleBtn').classList.remove('btn-success');
    document.getElementById('flashToggleBtn').classList.add('btn-warning');
    
    showMessage('operationMessage', '⏹️ Камера остановлена', false);
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
            
            // Перезапускаем камеру для следующего сканирования
            setTimeout(() => {
                restartCamera();
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
            
            // Перезапускаем камеру для следующего сканирования
            setTimeout(() => {
                restartCamera();
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

// Ручной ввод QR-кода для тестирования
function manualQRInput() {
    const qrCode = prompt('Введите QR-код вручную:', 'TEST123');
    if (qrCode) {
        onScanSuccess(qrCode);
    }
}

console.log('🚀 SehriyoPay загружен!');
