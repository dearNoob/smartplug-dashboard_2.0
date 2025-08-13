// app.js (Final Version using @tuyapi/cloud)

const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');
const TuyaCloud = require('@tuyapi/cloud'); // <-- Using the official library

const app = express();
const PORT = process.env.PORT || 3000;

// Database configuration (Please ensure this is correct)
// Read database configuration from Environment Variables
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
  secret: 'your-secret-key-that-is-long-and-secure',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, httpOnly: true } // httpOnly for security
}));

// Helper function to create a Tuya API instance for a user
const createTuyaInstance = (clientId, clientSecret) => {
    return new TuyaCloud({
        clientId: clientId,
        clientSecret: clientSecret,
        region: 'EU', // IMPORTANT: Make sure this matches your project's Data Center (EU, US, WEU, IN, etc.)
    });
};

// Authentication middleware
function requireAuth(req, res, next) {
  if (req.session.userId) {
    next();
  } else {
    res.status(401).redirect('/login');
  }
}

// --- All HTML Page Routes ---
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/signup', (req, res) => res.sendFile(path.join(__dirname, 'public', 'signup.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/dashboard', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get('/device/:deviceId', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'public', 'device-detail.html')));

// --- API Endpoints ---

// Signup endpoint
app.post('/api/signup', async (req, res) => {
    const { username, password, client_id, client_secret } = req.body;
    let connection;
    try {
        // Validate credentials by getting devices (a good way to test connection)
        const tuyaAPI = createTuyaInstance(client_id, client_secret);
        await tuyaAPI.getDevices();
        
        connection = await mysql.createConnection(dbConfig);
        const hashedPassword = await bcrypt.hash(password, 10);
        
        await connection.execute(
            'INSERT INTO users (username, password, client_id, client_secret) VALUES (?, ?, ?, ?)',
            [username, hashedPassword, client_id, client_secret]
        );
        
        res.status(201).json({ success: true, message: 'Account created successfully' });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(400).json({ success: false, message: 'Invalid Tuya credentials or server error.' });
    } finally {
        if (connection) await connection.end();
    }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        const [users] = await connection.execute('SELECT * FROM users WHERE username = ?', [username]);
        
        if (users.length === 0 || !(await bcrypt.compare(password, users[0].password))) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        
        req.session.userId = users[0].id;
        res.json({ success: true, message: 'Login successful' });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    } finally {
        if (connection) await connection.end();
    }
});

// Get all user devices endpoint
app.get('/api/devices', requireAuth, async (req, res) => {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        const [users] = await connection.execute('SELECT client_id, client_secret FROM users WHERE id = ?', [req.session.userId]);

        if (users.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        const tuyaAPI = createTuyaInstance(users[0].client_id, users[0].client_secret);
        const tuyaDevices = await tuyaAPI.getDevices();

        // Update our local database with the latest status from Tuya
        for (const device of tuyaDevices) {
            const status = await tuyaAPI.getProperties(device.id);
            const switchProp = status.properties.find(p => p.code === 'switch_1' || p.code === 'switch');
            const deviceState = device.online ? (switchProp && switchProp.value ? 'on' : 'off') : 'offline';

            await connection.execute(`
                INSERT INTO devices (user_id, device_id, device_name, device_type, status) 
                VALUES (?, ?, ?, ?, ?) 
                ON DUPLICATE KEY UPDATE 
                    device_name = VALUES(device_name), 
                    status = VALUES(status), 
                    last_updated = NOW()
            `, [req.session.userId, device.id, device.name, device.category, deviceState]);
        }

        const [dbDevices] = await connection.execute('SELECT * FROM devices WHERE user_id = ? ORDER BY device_name', [req.session.userId]);
        res.json({ success: true, devices: dbDevices });

    } catch (error) {
        console.error('Get devices error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch devices from Tuya.' });
    } finally {
        if (connection) await connection.end();
    }
});

// Control a single device
app.post('/api/devices/:deviceId/control', requireAuth, async (req, res) => {
    const { deviceId } = req.params;
    const { command } = req.body; // 'on' or 'off'
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        const [users] = await connection.execute('SELECT client_id, client_secret FROM users WHERE id = ?', [req.session.userId]);
        
        if (users.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const tuyaAPI = createTuyaInstance(users[0].client_id, users[0].client_secret);
        await tuyaAPI.sendCommands(deviceId, [{
            code: 'switch_1', // Use 'switch' if 'switch_1' does not work
            value: command === 'on'
        }]);

        // Update our local database
        await connection.execute('UPDATE devices SET status = ? WHERE device_id = ? AND user_id = ?', [command, deviceId, req.session.userId]);
        
        res.json({ success: true, message: `Device turned ${command}` });

    } catch (error) {
        console.error('Control device error:', error);
        res.status(500).json({ success: false, message: 'Failed to control device.' });
    } finally {
        if (connection) await connection.end();
    }
});

// Logout endpoint
app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Could not log out.' });
        }
        res.clearCookie('connect.sid'); // The default session cookie name
        res.json({ success: true, message: 'Logged out' });
    });
});


// (The rest of your endpoints like /api/energy and the initializeDatabase function can remain as they are)
// ...
// --- Database Initialization ---
async function initializeDatabase() {
    try {
      const connection = await mysql.createConnection(dbConfig);
      await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\``);
      await connection.changeUser({ database: dbConfig.database });
  
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          username VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          client_id VARCHAR(255) NOT NULL,
          client_secret VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
  
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS devices (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT,
          device_id VARCHAR(255) NOT NULL,
          device_name VARCHAR(255) NOT NULL,
          device_type VARCHAR(255),
          status VARCHAR(50) DEFAULT 'offline',
          last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE KEY uniq_user_device (user_id, device_id)
        )`);
  
      console.log('Database initialized successfully');
      await connection.end();
    } catch (error) {
      console.error('Database initialization error:', error);
      process.exit(1);
    }
}
  

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

initializeDatabase();
