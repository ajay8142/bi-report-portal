// backend/server.js
require('dotenv').config();
require('express-async-errors');
const express  = require('express');
const cors     = require('cors');
const helmet   = require('helmet');
const morgan   = require('morgan');
const db       = require('./config/db');

const authRoutes          = require('./routes/authRoutes');
const adminRoutes         = require('./routes/adminRoutes');
const clientRoutes        = require('./routes/clientRoutes');
const accessControlRoutes = require('./routes/accessControlRoutes');

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(morgan('dev'));

app.use('/api/auth',                  authRoutes);
app.use('/api/admin',                 adminRoutes);
app.use('/api/client',                clientRoutes);
app.use('/api/admin/access-control',  accessControlRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ success: false, message: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 5000;
db.initialize().then(() => {
  app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
}).catch(err => { console.error('❌ DB init failed:', err); process.exit(1); });
