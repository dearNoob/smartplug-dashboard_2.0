const mysql = require('mysql2/promise');

// আপনার দেওয়া ডাটাবেসের তথ্য এখানে যুক্ত করা হয়েছে
const dbConfig = {
  host: 'sql12.freesqldatabase.com',
  port: 3306,
  user: 'sql12794911',
  password: 'wTgxajmg5T',
  database: 'sql12794911'
};

async function setupDatabase() {
  console.log('🚀 Starting Tuya IoT Dashboard Setup with provided credentials...\n');
  
  try {
    console.log(`🔗 Connecting to MySQL at ${dbConfig.host}...`);
    
    // ডাটাবেস ছাড়া কানেকশন তৈরি করা হচ্ছে
    const connection = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password
    });
    
    console.log('✅ Connected to MySQL successfully!');
    
    // ডাটাবেস তৈরি করা হচ্ছে (যদি না থাকে)
    console.log(`🗃️  Creating database '${dbConfig.database}' if it doesn't exist...`);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\``);
    console.log('✅ Database created/verified successfully!');
    
    // নির্দিষ্ট ডাটাবেস ব্যবহার করা হচ্ছে
    await connection.query(`USE \`${dbConfig.database}\``);
    
    // টেবিল তৈরি করা হচ্ছে
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
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY uniq_user_device (user_id, device_id)
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
        INDEX idx_user_date (user_id, day),
        UNIQUE KEY uniq_device_day_hour (device_id, day, hour, user_id)
      )
    `);
    console.log('✅ Energy logs table created!');
    
    await connection.end();
    
    console.log('\n🎉 Setup completed successfully!');
    console.log('Database and tables are ready.');
    console.log('\n📋 Next step: Start the application with `npm start` or `node app.js`');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

// এই স্ক্রিপ্টটি সরাসরি চালালে সেটআপ শুরু হবে
if (require.main === module) {
  setupDatabase();
}

module.exports = { setupDatabase };
