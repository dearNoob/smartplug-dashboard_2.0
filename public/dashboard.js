let devices = [];
let energyChart = null;
let refreshInterval = null;

document.addEventListener('DOMContentLoaded', function() {
    initializeDashboard();
});

async function initializeDashboard() {
    try {
        // Show loading modal
        const loadingModalEl = document.getElementById('loadingModal');
        const loadingModal = new bootstrap.Modal(loadingModalEl);
        loadingModalEl.setAttribute('aria-hidden', 'false');
        loadingModal.show();

        // Load initial data
        await loadDevices();
        await loadEnergyData('day');

        // Hide loading modal
        loadingModal.hide();
        loadingModalEl.setAttribute('aria-hidden', 'true');

        // Set up auto-refresh every 30 seconds
        refreshInterval = setInterval(() => {
            loadDevices();
        }, 30000);

    } catch (error) {
        console.error('Dashboard initialization error:', error);
        showAlert('Failed to load dashboard', 'danger');
    }
}

async function loadDevices() {
    try {
        const response = await fetch('/api/devices');
        const result = await response.json();
        
        if (result.success) {
            devices = result.devices;
            renderDevices();
            updateEnergyOverview();
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error('Load devices error:', error);
        showAlert('Failed to load devices', 'danger');
    }
}

function renderDevices() {
    const deviceGrid = document.getElementById('deviceGrid');
    
    if (devices.length === 0) {
        deviceGrid.innerHTML = `
            <div class="col-span-full text-center">
                <div class="bg-white bg-opacity-20 rounded-2xl p-8">
                    <h3 class="text-white text-xl mb-2">No Devices Found</h3>
                    <p class="text-gray-300">Make sure your Tuya devices are connected to your cloud account.</p>
                </div>
            </div>
        `;
        return;
    }
    
    deviceGrid.innerHTML = devices.map(device => `
        <div class="device-card">
            <button class="device-button ${device.status}" 
                    onclick="toggleDevice('${device.device_id}')"
                    data-device-id="${device.device_id}">
                <div class="device-icon">
                    ${getDeviceIcon(device.device_type)}
                </div>
                <div class="device-name">${device.device_name}</div>
                <div class="device-status">${device.status}</div>
            </button>
            <button class="btn btn-sm btn-outline-light mt-2 w-100" 
                    onclick="goToDeviceDetail('${device.device_id}')">
                View Details
            </button>
        </div>
    `).join('');
}

function getDeviceIcon(deviceType) {
    const icons = {
        'switch': '💡',
        'plug': '🔌',
        'light': '💡',
        'fan': '🌀',
        'ac': '❄️',
        'heater': '🔥',
        'camera': '📷',
        'sensor': '📡',
        'default': '⚡'
    };
    
    return icons[deviceType] || icons.default;
}

async function toggleDevice(deviceId) {
    try {
        const device = devices.find(d => d.device_id === deviceId);
        if (!device) return;
        
        if (device.status === 'offline') {
            showAlert('Device is offline', 'info');
            return;
        }
        
        const newCommand = device.status === 'on' ? 'off' : 'on';
        
        // Show loading state
        const button = document.querySelector(`[data-device-id="${deviceId}"]`);
        const originalContent = button.innerHTML;
        button.innerHTML = '<div class="spinner-custom"></div>';
        button.disabled = true;
        
        const response = await fetch(`/api/devices/${deviceId}/control`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ command: newCommand })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Update device status locally
            device.status = newCommand;
            renderDevices();
            updateEnergyOverview();
            showAlert(`Device turned ${newCommand}`, 'success');
        } else {
            throw new Error(result.message);
        }
        
    } catch (error) {
        console.error('Toggle device error:', error);
        showAlert('Failed to control device', 'danger');
        // Restore button state
        const button = document.querySelector(`[data-device-id="${deviceId}"]`);
        if (button) {
            button.disabled = false;
            renderDevices(); // Re-render to restore original state
        }
    }
}

function goToDeviceDetail(deviceId) {
    window.location.href = `/device/${deviceId}`;
}

function updateEnergyOverview() {
    const activeDevices = devices.filter(d => d.status === 'on').length;
    document.getElementById('activeDevices').textContent = activeDevices;
}

async function loadEnergyData(period) {
    try {
        const response = await fetch(`/api/energy?period=${period}`);
        const result = await response.json();
        
        if (result.success) {
            document.getElementById('totalConsumption').textContent = `${result.totalConsumption} kWh`;
            document.getElementById('totalCost').textContent = `৳${result.totalCost}`;
            
            renderEnergyChart(result.data, period);
            
            // Update button states
            document.getElementById('dayBtn').className = period === 'day' 
                ? 'bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition duration-300'
                : 'bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition duration-300';
            document.getElementById('weekBtn').className = period === 'week' 
                ? 'bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition duration-300'
                : 'bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition duration-300';
        }
    } catch (error) {
        console.error('Load energy data error:', error);
        showAlert('Failed to load energy data', 'danger');
    }
}

function renderEnergyChart(data, period) {
    const ctx = document.getElementById('energyChart').getContext('2d');
    
    if (energyChart) {
        energyChart.destroy();
    }
    
    const labels = period === 'week' 
        ? data.map(d => new Date(d.date).toLocaleDateString())
        : data.map(d => `${d.hour}:00`);
    
    const consumptionData = data.map(d => parseFloat(d.total_consumption));
    
    energyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Energy Consumption (kWh)',
                data: consumptionData,
                backgroundColor: 'rgba(59, 130, 246, 0.6)',
                borderColor: 'rgba(59, 130, 246, 1)',
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: 'white'
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: 'white'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                },
                x: {
                    ticks: {
                        color: 'white'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                }
            }
        }
    });
}

async function logout() {
    try {
        await fetch('/api/logout', { method: 'POST' });
        window.location.href = '/login';
    } catch (error) {
        console.error('Logout error:', error);
        window.location.href = '/login';
    }
}

function showAlert(message, type) {
    // Create alert container if it doesn't exist
    let alertContainer = document.getElementById('alertContainer');
    if (!alertContainer) {
        alertContainer = document.createElement('div');
        alertContainer.id = 'alertContainer';
        alertContainer.className = 'fixed top-4 right-4 z-50';
        document.body.appendChild(alertContainer);
    }
    
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-custom alert-dismissible fade show mb-2`;
    alertDiv.style.minWidth = '300px';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="alert"></button>
    `;
    
    alertContainer.appendChild(alertDiv);
    
    // Auto dismiss after 5 seconds
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 5000);
}

// Cleanup on page unload
window.addEventListener('beforeunload', function() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
    if (energyChart) {
        energyChart.destroy();
    }
});

// Handle page visibility changes to pause/resume auto-refresh
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        if (refreshInterval) {
            clearInterval(refreshInterval);
        }
    } else {
        // Resume auto-refresh when page becomes visible
        refreshInterval = setInterval(() => {
            loadDevices();
        }, 30000);
    }
});