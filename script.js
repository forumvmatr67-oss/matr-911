const canvas = document.getElementById('cityCanvas');
const ctx = canvas.getContext('2d');
const contextMenu = document.getElementById('contextMenu');
let buildings = [];
let complaints = [];
let selectedBuildingId = null;
let autoRefreshInterval;

// Загрузка данных с сервера
async function loadData() {
    try {
        const response = await fetch('/data');
        const data = await response.json();
        buildings = data.buildings || [];
        complaints = data.complaints || [];
        drawMap();
        renderComplaints();
        updateStats();
    } catch (err) {
        console.error('Ошибка загрузки данных:', err);
        document.getElementById('complaintsList').innerHTML = '<div class="loading">⚠️ Не удалось загрузить данные. Убедитесь, что десктоп-приложение запущено.</div>';
    }
}

// Отрисовка карты
function drawMap() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    buildings.forEach(b => {
        const x = b.x, y = b.y;
        
        // Проверяем есть ли активные жалобы на этом здании
        const hasActiveComplaint = complaints.some(c => c.buildingId === b.id && c.status === 'active');
        
        // Цвет здания зависит от наличия жалоб
        if (b.type === 'house') {
            ctx.fillStyle = hasActiveComplaint ? '#ff9999' : '#95a5a6';
        } else {
            ctx.fillStyle = hasActiveComplaint ? '#ffcc99' : '#2ecc71';
        }
        
        ctx.fillRect(x-40, y-20, 80, 40);
        ctx.strokeStyle = '#2c3e50';
        ctx.strokeRect(x-40, y-20, 80, 40);
        
        ctx.fillStyle = '#2c3e50';
        ctx.font = '11px Arial';
        ctx.fillText(b.name, x-35, y);
        
        // Если есть активная жалоба, рисуем красный кружок
        if (hasActiveComplaint) {
            ctx.fillStyle = '#e74c3c';
            ctx.beginPath();
            ctx.arc(x+35, y-15, 8, 0, 2 * Math.PI);
            ctx.fill();
            ctx.fillStyle = 'white';
            ctx.font = 'bold 10px Arial';
            ctx.fillText('!', x+31, y-11);
        }
    });
}

// Отмена вызова (закрытие жалобы)
async function cancelComplaint(complaintId) {
    if (!confirm('Вы уверены, что хотите отменить этот вызов?')) return;
    
    try {
        const response = await fetch('/close_complaint', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ complaint_id: complaintId })
        });
        
        if (response.ok) {
            loadData(); // Перезагружаем данные
            showNotification('Вызов отменён', 'success');
        } else {
            alert('Ошибка при отмене вызова');
        }
    } catch (err) {
        alert('Не удалось соединиться с сервером');
    }
}

// Отметить как выполненный
async function resolveComplaint(complaintId) {
    if (!confirm('Отметить вызов как выполненный?')) return;
    
    try {
        const response = await fetch('/close_complaint', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ complaint_id: complaintId })
        });
        
        if (response.ok) {
            loadData();
            showNotification('Вызов отмечен как выполненный', 'success');
        } else {
            alert('Ошибка при обновлении статуса');
        }
    } catch (err) {
        alert('Не удалось соединиться с сервером');
    }
}

// Отображение уведомления
function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: ${type === 'success' ? '#2ecc71' : '#e74c3c'};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

// Добавляем анимацию в CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`;
document.head.appendChild(style);

// Отображение списка жалоб
function renderComplaints() {
    const container = document.getElementById('complaintsList');
    
    if (!complaints.length) {
        container.innerHTML = '<div class="no-complaints">📭 Нет активных жалоб</div>';
        return;
    }
    
    container.innerHTML = '';
    
    complaints.forEach(c => {
        const div = document.createElement('div');
        div.className = `complaint-item ${c.status === 'active' ? 'complaint-active' : 'complaint-closed'}`;
        
        const typeNames = {
            'police': '🚔 Полиция',
            'ambulance': '🚑 Скорая помощь',
            'workers': '🛠 Рабочие'
        };
        
        const time = new Date(c.timestamp).toLocaleString('ru-RU');
        
        div.innerHTML = `
            <div class="complaint-building">🏠 ${c.buildingName}</div>
            <div class="complaint-type ${c.type === 'police' ? 'type-police' : (c.type === 'ambulance' ? 'type-ambulance' : 'type-workers')}">
                ${typeNames[c.type] || c.typeRu || c.type}
            </div>
            <div class="complaint-time">⏰ ${time}</div>
            ${c.description ? `<div class="complaint-description">📝 ${c.description}</div>` : ''}
            <div class="complaint-actions">
                ${c.status === 'active' ? `
                    <button class="resolved-btn" onclick="resolveComplaint('${c.id}')">✓ Выполнено</button>
                    <button class="cancel-btn" onclick="cancelComplaint('${c.id}')">✗ Отменить</button>
                ` : `
                    <span style="font-size:0.75em; color:#27ae60;">✓ Закрыт</span>
                `}
            </div>
        `;
        
        container.appendChild(div);
    });
}

// Обновление статистики
function updateStats() {
    const total = complaints.length;
    const active = complaints.filter(c => c.status === 'active').length;
    const closed = complaints.filter(c => c.status === 'closed').length;
    
    document.getElementById('totalCount').textContent = total;
    document.getElementById('activeCount').textContent = active;
    document.getElementById('closedCount').textContent = closed;
}

// Отправка новой жалобы
async function sendComplaint(buildingId, serviceType, serviceName) {
    const building = buildings.find(b => b.id === buildingId);
    if (!building) return;
    
    const complaintData = {
        buildingId: buildingId,
        buildingName: building.name,
        type: serviceType,
        typeRu: serviceName,
        timestamp: new Date().toISOString(),
        description: `Вызов ${serviceName}`,
        status: 'active',
        color: 'red'
    };
    
    try {
        const response = await fetch('/complaint', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(complaintData)
        });
        
        if (response.ok) {
            loadData();
            showNotification(`Вызов ${serviceName} для ${building.name} отправлен`, 'success');
        } else {
            alert('Ошибка при добавлении жалобы');
        }
    } catch (err) {
        alert('Не удалось соединиться с сервером');
    }
}

// Поиск здания по координатам
function findBuilding(mouseX, mouseY) {
    for (let b of buildings) {
        const left = b.x - 40;
        const right = b.x + 40;
        const top = b.y - 20;
        const bottom = b.y + 20;
        if (mouseX >= left && mouseX <= right && mouseY >= top && mouseY <= bottom) {
            return b.id;
        }
    }
    return null;
}

// ПКМ на карте
canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;
    
    const buildingId = findBuilding(mouseX, mouseY);
    if (buildingId) {
        selectedBuildingId = buildingId;
        contextMenu.style.display = 'block';
        contextMenu.style.left = e.pageX + 'px';
        contextMenu.style.top = e.pageY + 'px';
    } else {
        contextMenu.style.display = 'none';
    }
});

// Скрыть меню
window.addEventListener('click', () => {
    contextMenu.style.display = 'none';
});

// Обработчики меню
document.getElementById('menuPolice').onclick = () => {
    if (selectedBuildingId) sendComplaint(selectedBuildingId, 'police', 'Полиция');
    contextMenu.style.display = 'none';
};

document.getElementById('menuAmbulance').onclick = () => {
    if (selectedBuildingId) sendComplaint(selectedBuildingId, 'ambulance', 'Скорая помощь');
    contextMenu.style.display = 'none';
};

document.getElementById('menuWorkers').onclick = () => {
    if (selectedBuildingId) sendComplaint(selectedBuildingId, 'workers', 'Рабочие');
    contextMenu.style.display = 'none';
};

// Кнопка обновления
document.getElementById('refreshBtn').onclick = () => loadData();

// Автообновление каждые 30 секунд
autoRefreshInterval = setInterval(loadData, 30000);

// Инициализация
loadData();