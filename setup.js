const mysql = require('mysql2/promise');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function setupDatabase() {
  console.log('🚀 Welcome to Tuya IoT Dashboard Setup!\n');
  
  try {
    // Get database configuration
    console.log('📝 Please provide your MySQL database configuration:');
    const host = await question('MySQL Host (default: localhost): ') || '127.0.0.1';
    const port = await question('MySQL Port (default: 3306): ') || '3306';
    const user = await question('MySQL Username (default: root): ') || 'root';
    const password = await question('MySQL Password: ')|| 1234;
    const database = await question('Database Name (default: tuya_dashboard): ') || 'tuya_db';
    
    console.log('\n🔗 Connecting to MySQL...');
    
    // Create connection without database first
    const connection = await mysql.createConnection({
      host,
      port: parseInt(port),
      user,
      password
    });
    
    console.log('✅ Connected to MySQL successfully!');
    
    // Create database if it doesn't exist
    console.log(`🗃️  Creating database '${database}' if it doesn't exist...`);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\``);
    console.log('✅ Database created/verified successfully!');
    
    // Switch to the database
    await connection.query(`USE \`${database}\``);
    
    // Create tables
    console.log('📋 Creating tables...');
    
    // Users table
    await connection.query(`
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
    console.log('✅ Users table created!');
    
    // Devices table
    await connection.query(`
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
    console.log('✅ Devices table created!');
    
    // Energy consumption logs table
    await connection.query(`
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
    console.log('✅ Energy logs table created!');
    
    await connection.end();
    
    // Update app.js with database configuration
    console.log('\n⚙️  Updating database configuration...');
    updateDatabaseConfig(host, port, user, password, database);
    
    console.log('\n🎉 Setup completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Make sure you have your Tuya Developer credentials ready');
    console.log('2. Start the application: npm start');
    console.log('3. Open http://localhost:3000 in your browser');
    console.log('4. Create an account with your Tuya credentials');
    console.log('\n📚 For Tuya Developer credentials:');
    console.log('- Visit: https://iot.tuya.com/');
    console.log('- Create a project and get Client ID & Client Secret');
    console.log('\n✨ Happy monitoring!');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

function updateDatabaseConfig(host, port, user, password, database) {
  const fs = require('fs');
  
  try {
    let appContent = fs.readFileSync('app.js', 'utf8');
    
    // Replace database configuration
    const newConfig = `const dbConfig = {
  host: '${host}',
  user: '${user}',
  password: '${password}',
  database: '${database}',
  port: ${port}
};`;
    
    appContent = appContent.replace(
      /const dbConfig = {[\s\S]*?};/,
      newConfig
    );
    
    fs.writeFileSync('app.js', appContent);
    console.log('✅ Database configuration updated in app.js');
  } catch (error) {
    console.warn('⚠️  Could not update app.js automatically. Please update the database configuration manually.');
  }
}

// Start setup if this script is run directly
if (require.main === module) {
  setupDatabase();
}

module.exports = { setupDatabase };