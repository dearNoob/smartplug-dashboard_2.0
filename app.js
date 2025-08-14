const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const axios = require('axios');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: process.env.DB_PORT || 3306
};

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

// Database initialization
async function initializeDatabase() {
  try {
    const connection = await mysql.createConnection(dbConfig);
    
    // Create users table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        client_id VARCHAR(255) NOT NULL,
        client_secret VARCHAR(255) NOT NULL,
        access_token VARCHAR(500),
        refresh_token VARCHAR(500),
        token_expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create devices table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS devices (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        device_id VARCHAR(255) NOT NULL,
        device_name VARCHAR(255) NOT NULL,
        device_type VARCHAR(255),
        status VARCHAR(50) DEFAULT 'offline',
        power_consumption DECIMAL(10,2) DEFAULT 0,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    
    // Create energy consumption logs table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS energy_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        device_id VARCHAR(255) NOT NULL,
        user_id INT,
        consumption DECIMAL(10,4) NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        hour INT,
        day DATE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_device_date (device_id, day),
        INDEX idx_user_date (user_id, day)
      )
    `);
    
    await connection.end();
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

// Tuya API functions
class TuyaAPI {
  constructor(clientId, clientSecret) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.baseUrl = 'https://openapi.tuyaeu.com';  // Using Central europe data center
    this.accessToken = null;
  }

  // Generate signature for Tuya API
  generateSign(method, pathWithQuery, body = '') {
    const t = Date.now().toString();
    const nonce = crypto.randomUUID();
    // Always use a string for body
    let bodyStr = body;
    if (bodyStr === null || bodyStr === undefined) bodyStr = '';
    if (typeof bodyStr !== 'string') bodyStr = JSON.stringify(bodyStr);
    const bodyHash = crypto.createHash('sha256').update(bodyStr).digest('hex');
    // String to sign
    const stringToSign = [
      method.toUpperCase(),
      bodyHash,
      '',
      pathWithQuery
    ].join('\n');
    // Final sign string
    const signStr = this.clientId + t + nonce + stringToSign;
    const sign = crypto.createHmac('sha256', this.clientSecret).update(signStr).digest('hex').toUpperCase();
    return {
      t,
      nonce,
      sign
    };
  }

  // Get access token
  async getAccessToken() {
    try {
      const t = Date.now().toString();
      const method = 'GET';
      const path = '/v1.0/token?grant_type=1';
      const stringToSign = this.clientId + t;
      const sign = crypto.createHmac('sha256', this.clientSecret)
        .update(stringToSign)
        .digest('hex').toUpperCase();

      // Log for debugging
      console.log('String to sign:', stringToSign);
      console.log('Generated signature:', sign);
      const url = `${this.baseUrl}${path}`;
      const headers = {
        client_id: this.clientId,
        sign,
        t,
        sign_method: 'HMAC-SHA256',
      };
      console.log('Token request URL:', url);
      console.log('Token request headers:', headers);

      const response = await axios.get(url, { headers });

      console.log('Access Token Response:', response.data);
      if (response.data && response.data.success && response.data.result) {
        this.accessToken = response.data.result.access_token;
        this.tokenExpiresAt = Date.now() + (response.data.result.expire_time - 60) * 1000;
        return this.accessToken;
      } else {
        console.error('Failed to fetch access token:', response.data);
        throw new Error('Failed to fetch access token');
      }
    } catch (error) {
      console.error('Error fetching access token:', error);
      throw error;
    }
  }

  // Get user devices
  async getUserDevices() {
    try {
      // Fetch a new token if missing or expired
      if (!this.accessToken || Date.now() >= this.tokenExpiresAt) {
        console.log('Access token missing or expired. Fetching a new token...');
        await this.getAccessToken();
      }

      const path = '/v1.0/users/devices';
      const method = 'GET';
      const sign = this.generateSign(method, path);

      console.log('Using Access Token:', this.accessToken); // Log the token being used

      const response = await axios.get(`${this.baseUrl}${path}`, {
        headers: {
          client_id: this.clientId,
          sign,
          t: Date.now(),
          sign_method: 'HMAC-SHA256',
          access_token: this.accessToken,
        },
      });

      console.log('Tuya API Response:', response.data); // Log the raw response

      if (response.data && response.data.result) {
        return response.data.result;
      } else {
        console.error('Unexpected API response format:', response.data);
        return [];
      }
    } catch (error) {
      console.error('Error fetching devices from Tuya API:', error);
      return [];
    }
  }

  // Control device
  async controlDevice(deviceId, commands) {
    if (!this.accessToken) {
      await this.getAccessToken();
    }

    try {
      const path = `/v1.0/devices/${deviceId}/commands`;
      const body = { commands };
      const signInfo = this.generateSign('POST', path, JSON.stringify(body));

      const response = await axios.post(`${this.baseUrl}${path}`, body, {
        headers: {
          'client_id': this.clientId,
          'access_token': this.accessToken,
          'sign': signInfo.sign,
          't': signInfo.t,
          'nonce': signInfo.nonce,
          'sign_method': 'HMAC-SHA256',
          'Content-Type': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      console.error('Control device error:', error.response?.data || error.message);
      throw error;
    }
  }

  // Get device status
  async getDeviceStatus(deviceId) {
    if (!this.accessToken) {
      await this.getAccessToken();
    }

    try {
      const path = `/v1.0/devices/${deviceId}/status`;
      const signInfo = this.generateSign('GET', path, '');

      const response = await axios.get(`${this.baseUrl}${path}`, {
        headers: {
          'client_id': this.clientId,
          'access_token': this.accessToken,
          'sign': signInfo.sign,
          't': signInfo.t,
          'nonce': signInfo.nonce,
          'sign_method': 'HMAC-SHA256',
          'Content-Type': 'application/json'
        }
      });

      return response.data.result || [];
    } catch (error) {
      console.error('Get device status error:', error.response?.data || error.message);
      throw error;
    }
  }
}

// Authentication middleware
function requireAuth(req, res, next) {
  if (req.session.userId) {
    next();
  } else {
    res.redirect('/login');
  }
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/dashboard', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/device/:deviceId', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'device-detail.html'));
});

// Signup endpoint
app.post('/api/signup', async (req, res) => {
  try {
    const { username, password, client_id, client_secret } = req.body;
    
    // Validate Tuya credentials
    const tuyaAPI = new TuyaAPI(client_id, client_secret);
    await tuyaAPI.getAccessToken();
    
    const connection = await mysql.createConnection(dbConfig);
    
    // Check if username exists
    const [existing] = await connection.execute(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );
    
    if (existing.length > 0) {
      await connection.end();
      return res.status(400).json({ success: false, message: 'Username already exists' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Insert user
    await connection.execute(
      'INSERT INTO users (username, password, client_id, client_secret) VALUES (?, ?, ?, ?)',
      [username, hashedPassword, client_id, client_secret]
    );
    
    await connection.end();
    res.json({ success: true, message: 'Account created successfully' });
    
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ success: false, message: 'Invalid credentials or server error' });
  }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const connection = await mysql.createConnection(dbConfig);
    
    const [users] = await connection.execute(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );
    
    if (users.length === 0) {
      await connection.end();
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }
    
    const user = users[0];
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      await connection.end();
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }
    
    req.session.userId = user.id;
    req.session.username = user.username;
    
    await connection.end();
    res.json({ success: true, message: 'Login successful' });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get user devices endpoint
app.get('/api/devices', requireAuth, async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    
    const [users] = await connection.execute(
      'SELECT client_id, client_secret FROM users WHERE id = ?',
      [req.session.userId]
    );
    
    if (users.length === 0) {
      await connection.end();
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    const { client_id, client_secret } = users[0];
    const tuyaAPI = new TuyaAPI(client_id, client_secret);
    
    // Get devices from Tuya
    const tuyaDevices = await tuyaAPI.getUserDevices();
    
    // Update local database with devices
    for (const device of tuyaDevices) {
      const deviceStatus = await tuyaAPI.getDeviceStatus(device.id);
      const isOnline = device.online;
      const powerState = deviceStatus.find(s => s.code === 'switch_1' || s.code === 'switch')?.value || false;
      
      await connection.execute(`
        INSERT INTO devices (user_id, device_id, device_name, device_type, status, last_updated) 
        VALUES (?, ?, ?, ?, ?, NOW()) 
        ON DUPLICATE KEY UPDATE 
        device_name = VALUES(device_name), 
        status = VALUES(status),
        last_updated = NOW()
      `, [
        req.session.userId,
        device.id,
        device.name,
        device.category,
        isOnline ? (powerState ? 'on' : 'off') : 'offline'
      ]);
    }
    
    // Get updated devices from database
    const [dbDevices] = await connection.execute(
      'SELECT * FROM devices WHERE user_id = ? ORDER BY device_name',
      [req.session.userId]
    );
    
    await connection.end();
    res.json({ success: true, devices: dbDevices });
    
  } catch (error) {
    console.error('Get devices error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch devices' });
  }
});

// Control device endpoint
app.post('/api/devices/:deviceId/control', requireAuth, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { command } = req.body; // 'on' or 'off'
    
    const connection = await mysql.createConnection(dbConfig);
    
    const [users] = await connection.execute(
      'SELECT client_id, client_secret FROM users WHERE id = ?',
      [req.session.userId]
    );
    
    const { client_id, client_secret } = users[0];
    const tuyaAPI = new TuyaAPI(client_id, client_secret);
    
    // Control device via Tuya API
    const commands = [{ code: 'switch_1', value: command === 'on' }];
    await tuyaAPI.controlDevice(deviceId, commands);
    
    // Update device status in database
    await connection.execute(
      'UPDATE devices SET status = ?, last_updated = NOW() WHERE device_id = ? AND user_id = ?',
      [command, deviceId, req.session.userId]
    );
    
    await connection.end();
    res.json({ success: true, message: `Device turned ${command}` });
    
  } catch (error) {
    console.error('Control device error:', error);
    res.status(500).json({ success: false, message: 'Failed to control device' });
  }
});

// Get energy consumption data
app.get('/api/energy/:deviceId?', requireAuth, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { period } = req.query; // 'day' or 'week'
    
    const connection = await mysql.createConnection(dbConfig);
    
    let query, params;
    
    if (deviceId) {
      // Specific device energy data
      if (period === 'week') {
        query = `
          SELECT DATE(timestamp) as date, SUM(consumption) as total_consumption 
          FROM energy_logs 
          WHERE device_id = ? AND user_id = ? AND timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)
          GROUP BY DATE(timestamp)
          ORDER BY date
        `;
      } else {
        query = `
          SELECT hour, SUM(consumption) as total_consumption 
          FROM energy_logs 
          WHERE device_id = ? AND user_id = ? AND day = CURDATE()
          GROUP BY hour
          ORDER BY hour
        `;
      }
      params = [deviceId, req.session.userId];
    } else {
      // Total energy data for all devices
      if (period === 'week') {
        query = `
          SELECT DATE(timestamp) as date, SUM(consumption) as total_consumption 
          FROM energy_logs 
          WHERE user_id = ? AND timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)
          GROUP BY DATE(timestamp)
          ORDER BY date
        `;
      } else {
        query = `
          SELECT hour, SUM(consumption) as total_consumption 
          FROM energy_logs 
          WHERE user_id = ? AND day = CURDATE()
          GROUP BY hour
          ORDER BY hour
        `;
      }
      params = [req.session.userId];
    }
    
    const [energyData] = await connection.execute(query, params);
    
    // Calculate total consumption and cost (Bangladesh electricity rate: ~10 Taka per kWh)
    const totalConsumption = energyData.reduce((sum, record) => sum + parseFloat(record.total_consumption), 0);
    const totalCost = totalConsumption * 10; // 10 Taka per kWh
    
    await connection.end();
    
    res.json({
      success: true,
      data: energyData,
      totalConsumption: totalConsumption.toFixed(4),
      totalCost: totalCost.toFixed(2)
    });
    
  } catch (error) {
    console.error('Get energy data error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch energy data' });
  }
});

// Logout endpoint
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Simulate energy consumption data (for testing)
async function simulateEnergyData() {
  try {
    const connection = await mysql.createConnection(dbConfig);
    
    const [devices] = await connection.execute('SELECT * FROM devices WHERE status != "offline"');
    
    for (const device of devices) {
      const consumption = Math.random() * 2; // Random consumption between 0-2 kWh
      const currentHour = new Date().getHours();
      
      await connection.execute(`
        INSERT INTO energy_logs (device_id, user_id, consumption, hour, day) 
        VALUES (?, ?, ?, ?, CURDATE())
        ON DUPLICATE KEY UPDATE consumption = consumption + VALUES(consumption)
      `, [device.device_id, device.user_id, consumption, currentHour]);
    }
    
    await connection.end();
  } catch (error) {
    console.error('Simulate energy data error:', error);
  }
}

// Initialize database and start server
initializeDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    
    // Simulate energy data every hour (for testing)
    setInterval(simulateEnergyData, 3600000);
  });
});

// Debug endpoint to get raw Tuya device list response for troubleshooting
app.get('/api/debug/devices', requireAuth, async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [users] = await connection.execute(
      'SELECT client_id, client_secret FROM users WHERE id = ?',
      [req.session.userId]
    );
    await connection.end();
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const { client_id, client_secret } = users[0];
    const tuyaAPI = new TuyaAPI(client_id, client_secret);
    // Get the raw response from Tuya API
    const rawDevices = await tuyaAPI.getUserDevices();
    res.json({ rawDevices });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

module.exports = app;
