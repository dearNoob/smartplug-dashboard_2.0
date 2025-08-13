let currentDevice = null;
let deviceEnergyChart = null;
let deviceId = null;
let refreshInterval = null;

document.addEventListener('DOMContentLoaded', function() {
    // Get device ID from URL
    const pathParts = window.location.pathname.split('/');
    deviceId = pathParts[pathParts.length - 1];
    
    if (deviceId) {
        initializeDeviceDetail();
    } else {
        showAlert('Invalid device ID', 'danger');
    }
});

async function initializeDeviceDetail() {
    try {
        await loadDeviceDetails();
        await loadDeviceEnergyData('day');
        
        // Set up auto-refresh every 30 seconds
        refreshInterval = setInterval(() => {
            loadDeviceDetails();
        }, 30000);
        
    } catch (error) {
        console.error('Device detail initialization error:', error);
        showAlert('Failed to load device details', 'danger');
    }
}

async function loadDeviceDetails() {
    try {
        const response = await fetch('/api/devices');
        const result = await response.json();
        
        if (result.success) {
            currentDevice = result.devices.find(d => d.device_id === deviceId);
            
            if (currentDevice) {
                renderDeviceDetails();
                renderDeviceControl();
            } else {
                showAlert('Device not found', 'danger');
                setTimeout(() => {
                    window.location.href = '/dashboard';
                }, 2000);
            }
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error('Load device details error:', error);
        showAlert('Failed to load device details', 'danger');
    }
}

function renderDeviceDetails() {
    if (!currentDevice) return;
    
    // Update page title
    document.getElementById('deviceTitle').textContent = currentDevice.device_name;
    document.title = `${currentDevice.device_name} - Tuya Dashboard`;
    
    // Update device information
    document.getElementById('deviceName').textContent = currentDevice.device_name;
    document.getElementById('deviceType').textContent = currentDevice.device_type || 'Unknown';
    document.getElementById('deviceStatus').textContent = currentDevice.status.toUpperCase();
    
    // Format last updated time
    const lastUpdated = new Date(currentDevice.last_updated);
    document.getElementById('lastUpdated').textContent = lastUpdated.toLocaleString();
    
    // Update status color
    const statusElement = document.getElementById('deviceStatus');
    statusElement.className = 'text-gray-300';
    
    switch(currentDevice.status) {
        case 'on':
            statusElement.className = 'text-green-400 font-semibold';
            break;
        case 'off':
            statusElement.className = 'text-red-400 font-semibold';
            break;
        case 'offline':
            statusElement.className = 'text-gray-400 font-semibold';
            break;
    }
}

function renderDeviceControl() {
    if (!currentDevice) return;
    
    const controlButton = document.getElementById('deviceControlButton');
    
    const deviceIcon = getDeviceIcon(currentDevice.device_type);
    const isDisabled = currentDevice.status === 'offline';
    
    controlButton.innerHTML = `
        <div class="mb-4">
            <button class="power-button ${currentDevice.status}" 
                    onclick="toggleCurrentDevice()" 
                    ${isDisabled ? 'disabled' : ''}
                    title="${isDisabled ? 'Device is offline' : 'Click to toggle power'}">
                ${deviceIcon}
            </button>
        </div>
        <h3 class="text-white text-xl font-semibold mb-2">${currentDevice.device_name}</h3>
        <p class="text-gray-300 text-lg">Status: <span class="font-semibold">${currentDevice.status.toUpperCase()}</span></p>
    `;
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

async function toggleCurrentDevice() {
    if (!currentDevice || currentDevice.status === 'offline') {
        showAlert('Device is offline', 'info');
        return;
    }
    
    try {
        const newCommand = currentDevice.status === 'on' ? 'off' : 'on';
        
        // Show loading state
        const button = document.querySelector('.power-button');
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
            currentDevice.status = newCommand;
            renderDeviceDetails();
            renderDeviceControl();
            showAlert(`Device turned ${newCommand}`, 'success');
        } else {
            throw new Error(result.message);
        }
        
    } catch (error) {
        console.error('Toggle device error:', error);
        showAlert('Failed to control device', 'danger');
        // Restore button state
        renderDeviceControl();
    }
}

async function loadDeviceEnergyData(period) {
    try {
        const response = await fetch(`/api/energy/${deviceId}?period=${period}`);
        const result = await response.json();
        
        if (result.success) {
            document.getElementById('deviceConsumption').textContent = `${result.totalConsumption} kWh`;
            document.getElementById('deviceCost').textContent = `৳${result.totalCost}`;
            
            renderDeviceEnergyChart(result.data, period);
            
            // Update button states
            document.getElementById('dayBtn').className = period === 'day' 
                ? 'bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition duration-300'
                : 'bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition duration-300';
            document.getElementById('weekBtn').className = period === 'week' 
                ? 'bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition duration-300'
                : 'bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition duration-300';
        }
    } catch (error) {
        console.error('Load device energy data error:', error);
        showAlert('Failed to load energy data', 'danger');
    }
}

function renderDeviceEnergyChart(data, period) {
    const ctx = document.getElementById('deviceEnergyChart').getContext('2d');
    
    if (deviceEnergyChart) {
        deviceEnergyChart.destroy();
    }
    
    const labels = period === 'week' 
        ? data.map(d => new Date(d.date).toLocaleDateString())
        : data.map(d => `${d.hour}:00`);
    
    const consumptionData = data.map(d => parseFloat(d.total_consumption));
    
    deviceEnergyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Energy Consumption (kWh)',
                data: consumptionData,
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                borderColor: 'rgba(16, 185, 129, 1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: 'rgba(16, 185, 129, 1)',
                pointBorderColor: 'white',
                pointBorderWidth: 2,
                pointRadius: 6,
                pointHoverRadius: 8
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
    if (deviceEnergyChart) {
        deviceEnergyChart.destroy();
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
            loadDeviceDetails();
        }, 30000);
    }
});