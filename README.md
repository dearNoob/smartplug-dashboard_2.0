# Tuya IoT Dashboard

একটি সম্পূর্ণ Tuya IoT ডিভাইস ম্যানেজমেন্ট ড্যাশবোর্ড যা আপনার সমস্ত স্মার্ট ডিভাইস নিয়ন্ত্রণ এবং পর্যবেক্ষণ করার জন্য।

## 🌟 বৈশিষ্ট্যসমূহ

### 🔐 Authentication System
- **Sign Up**: Tuya Client ID এবং Client Secret দিয়ে অ্যাকাউন্ট তৈরি
- **Login**: Username এবং Password দিয়ে লগইন
- **Session Management**: নিরাপদ সেশন ব্যবস্থাপনা

### 🏠 Universal Dashboard
- **Device Overview**: সমস্ত connected devices এর তালিকা
- **Real-time Status**: On/Off/Offline status দেখান
- **Device Control**: ওয়ান-ক্লিকে device on/off করুন
- **Auto-refresh**: প্রতি ৩০ সেকেন্ডে স্বয়ংক্রিয় আপডেট

### ⚡ Energy Monitoring
- **Real-time Consumption**: বর্তমান energy consumption
- **Cost Calculation**: বাংলাদেশের electricity rate অনুযায়ী cost
- **Charts**: দৈনিক এবং সাপ্তাহিক consumption chart
- **Historical Data**: Hourly basis এ data সংরক্ষণ

### 📱 Individual Device Dashboard
- **Device Details**: প্রতিটি device এর আলাদা dashboard
- **Specific Controls**: Individual device control
- **Device Analytics**: Device-specific energy data
- **Device Information**: Status, type, last updated time

### 🎨 Modern UI/UX
- **Glass Morphism Design**: আধুনিক UI design
- **Responsive Layout**: সমস্ত device এ perfectly কাজ করে
- **Dark Theme**: চোখের জন্য আরামদায়ক
- **Smooth Animations**: Interactive animations এবং transitions

## 🛠️ Technology Stack

### Backend
- **Node.js** - Server runtime
- **Express.js** - Web framework
- **MySQL** - Database
- **Axios** - HTTP client for Tuya API calls
- **bcryptjs** - Password hashing
- **express-session** - Session management

### Frontend
- **HTML5** - Structure
- **CSS3** - Styling with custom glass morphism
- **Tailwind CSS** - Utility-first CSS framework
- **Bootstrap 5** - UI components
- **Chart.js** - Data visualization
- **Vanilla JavaScript** - Frontend logic

## 📦 Installation

### Prerequisites
- Node.js (v14 or higher)
- MySQL Database
- Tuya Developer Account

### Step 1: Clone and Install
```bash
git clone <repository-url>
cd tuya-iot-dashboard
npm install
```

### Step 2: Database Setup
```bash
npm run setup
```
এই command টি চালানোর পর আপনার MySQL credentials দিন।

### Step 3: Tuya Developer Setup
1. [Tuya IoT Platform](https://iot.tuya.com/) এ যান
2. নতুন project তৈরি করুন
3. Client ID এবং Client Secret সংগ্রহ করুন
4. আপনার devices গুলো Tuya cloud এ add করুন

### Step 4: Start Application
```bash
npm start
```
অথবা development mode এর জন্য:
```bash
npm run dev
```

Application চালু হবে: http://localhost:3000

## 📝 Usage Guide

### প্রথম ব্যবহার

1. **Sign Up** করুন:
   - Username এবং Password দিন
   - আপনার Tuya Client ID এবং Client Secret দিন
   - "Create Account" এ ক্লিক করুন

2. **Login** করুন:
   - Username এবং Password দিয়ে login করুন
   - Automatically dashboard এ redirect হবে

3. **Dashboard** ব্যবহার করুন:
   - সমস্ত connected devices দেখুন
   - Device গুলো on/off করুন
   - Energy consumption monitor করুন
   - Individual device details দেখুন

### Device Control

- **Main Dashboard**: সমস্ত devices একসাথে control করুন
- **Device Buttons**: ক্লিক করে device on/off করুন
- **Status Indicator**: 
  - 🟢 Green = Device ON
  - 🔴 Red = Device OFF  
  - ⚫ Gray = Device OFFLINE
- **View Details**: প্রতিটি device এর আলাদা dashboard দেখুন

### Energy Monitoring

- **Total Overview**: সমস্ত devices এর total consumption
- **Cost Calculation**: বাংলাদেশের rate (10 Taka/kWh) অনুযায়ী
- **Charts**: 
  - "Today" button: আজকের hourly data
  - "This Week" button: সাপ্তাহিক daily data

## 🔧 Configuration

### Database Configuration
`app.js` file এ database configuration:
```javascript
const dbConfig = {
  host: 'localhost',
  user: 'root',  
  password: 'your_password',
  database: 'tuya_dashboard'
};
```

### Tuya API Configuration
Tuya API Base URL (US region):
```javascript
baseUrl: 'https://openapi.tuyaus.com'
```

অন্য region এর জন্য:
- EU: `https://openapi.tuyaeu.com`
- CN: `https://openapi.tuyacn.com`

## 📊 Database Schema

### Users Table
```sql
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  client_id VARCHAR(255) NOT NULL,
  client_secret VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Devices Table  
```sql
CREATE TABLE devices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  device_id VARCHAR(255) NOT NULL,
  device_name VARCHAR(255) NOT NULL,
  device_type VARCHAR(255),
  status VARCHAR(50) DEFAULT 'offline',
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Energy Logs Table
```sql
CREATE TABLE energy_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  device_id VARCHAR(255) NOT NULL,
  user_id INT,
  consumption DECIMAL(10,4) NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  hour INT,
  day DATE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

## 🚀 API Endpoints

### Authentication
- `POST /api/signup` - নতুন user registration
- `POST /api/login` - User login  
- `POST /api/logout` - User logout

### Devices
- `GET /api/devices` - সমস্ত user devices
- `POST /api/devices/:deviceId/control` - Device control

### Energy Data
- `GET /api/energy` - Total energy data
- `GET /api/energy/:deviceId` - Specific device energy data

## 🎨 UI Components

### Device Button States
```css
.device-button.online { /* Green gradient - Device ON */ }
.device-button.off { /* Red gradient - Device OFF */ }  
.device-button.offline { /* Gray gradient - Device OFFLINE */ }
```

### Power Button
```css
.power-button.on { /* Green with glow effect */ }
.power-button.off { /* Red with glow effect */ }
.power-button.offline { /* Gray with glow effect */ }
```

## 🔧 Troubleshooting

### Common Issues

1. **Database Connection Error**
   - MySQL server চালু আছে কিনা check করুন
   - Database credentials সঠিক আছে কিনা verify করুন

2. **Tuya API Error**  
   - Client ID এবং Client Secret সঠিক আছে কিনা check করুন
   - Tuya project এ devices properly linked আছে কিনা verify করুন

3. **Devices Not Showing**
   - Devices গুলো Tuya app এ online আছে কিনা check করুন
   - Internet connection stable আছে কিনা verify করুন

4. **Energy Data Not Loading**
   - Database এ energy_logs table properly created আছে কিনা check করুন
   - Simulation function চালু আছে কিনা verify করুন

### Debug Mode
Development mode এ চালানোর জন্য:
```bash
npm run dev
```

Console logs check করুন errors এর জন্য।

## 📱 Mobile Responsiveness

Dashboard সমস্ত devices এ responsive:
- **Desktop**: Full feature dashboard
- **Tablet**: Optimized layout  
- **Mobile**: Touch-friendly controls

## 🔮 Future Enhancements

- [ ] **Real-time Notifications** - Device status change alerts
- [ ] **Scheduling** - Device automation scheduling
- [ ] **Multi-user Support** - Family sharing features
- [ ] **Advanced Analytics** - More detailed energy reports
- [ ] **Mobile App** - React Native mobile application
- [ ] **Voice Control** - Integration with voice assistants

## 📄 License

MIT License - Free to use and modify

## 🤝 Support

Issues বা questions এর জন্য GitHub issues ব্যবহার করুন।

---

### Made with ❤️ for Bangladesh IoT Community

**Happy Smart Home Automation!** 🏠✨