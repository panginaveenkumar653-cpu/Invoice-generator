require('dotenv').config();

if (process.env.NODE_ENV !== 'production') {
  if (!process.env.MONGODB_URI) process.env.STORAGE_MODE = 'local-json';
  if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'local-development-only-change-me';
}

const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const clientRoutes = require('./routes/clientRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const connectDB = require('./config/db');

const app = express();

const normalizeOrigin = (origin) => origin.trim().replace(/\/+$/, '');
const allowedOrigins = (process.env.ALLOWED_ORIGIN || '')
  .split(',')
  .map(normalizeOrigin)
  .filter(Boolean);
const allowAllInDevelopment = process.env.NODE_ENV !== 'production' && allowedOrigins.length === 0;

app.use(cors({
  origin(origin, callback) {
    // Requests without an Origin header (for example, health checks) are not
    // browser cross-origin requests and can proceed normally.
    if (!origin || allowAllInDevelopment || allowedOrigins.includes(normalizeOrigin(origin))) {
      return callback(null, true);
    }
    console.warn(`Blocked browser origin by CORS: ${origin}`);
    return callback(null, false);
  },
}));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/invoices', invoiceRoutes);

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    storage: process.env.STORAGE_MODE === 'local-json' ? 'local-json' : 'mongodb',
  });
});

const port = process.env.PORT || 5000;
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('Server startup failed: JWT_SECRET is not set');
  process.exit(1);
}

connectDB()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server listening on port ${port}`);
    });
  })
  .catch((error) => {
    console.error(`Server startup failed: ${error.message}`);
    process.exit(1);
  });
