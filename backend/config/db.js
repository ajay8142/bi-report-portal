// backend/config/db.js
const oracledb = require('oracledb');

// Uncomment for thick mode (required if not using thin mode):
// oracledb.initOracleClient({ libDir: 'C:/oracle/instantclient_21_x' }); // Windows
// oracledb.initOracleClient({ libDir: '/opt/oracle/instantclient_21_x' }); // Linux

let pool;

async function initialize() {
  pool = await oracledb.createPool({
    user:          process.env.DB_USER,
    password:      process.env.DB_PASSWORD,
    connectString: process.env.DB_CONNECT_STRING,
    poolMin:       2,
    poolMax:       10,
    poolIncrement: 1,
  });
  console.log('✅ Oracle DB connection pool created');
}

async function close() {
  await pool.close(10);
}

async function execute(sql, binds = [], opts = {}) {
  const options = { outFormat: oracledb.OUT_FORMAT_OBJECT, autoCommit: true, ...opts };
  const connection = await pool.getConnection();
  try {
    return await connection.execute(sql, binds, options);
  } finally {
    await connection.close();
  }
}

module.exports = { initialize, close, execute };
