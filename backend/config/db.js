// config/db.js
// MySQL connection pool — har request pe naya connection nahi banate
// Pool automatically manages connections

const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host:               process.env.DB_HOST,
    user:               process.env.DB_USER,
    password:           process.env.DB_PASSWORD,
    database:           process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit:    10,       // max 10 simultaneous connections
    queueLimit:         0
});

// Test connection on startup
pool.getConnection()
    .then(conn => {
        console.log('✅ MySQL connected successfully');
        conn.release();
    })
    .catch(err => {
        console.error('❌ MySQL connection failed:', err.message);
        process.exit(1);
    });

module.exports = pool;
