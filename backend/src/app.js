const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const companiesRoutes = require('./routes/companies');
const customersRoutes = require('./routes/customers');
const profilesRoutes = require('./routes/profiles');
const webhooksRoutes = require('./routes/webhooks');
const schemaRoutes = require('./routes/schema');

function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use('/api/auth', authRoutes);
  app.use('/api/companies', companiesRoutes);
  app.use('/api/customers', customersRoutes);
  app.use('/api/profiles', profilesRoutes);
  app.use('/api/webhooks', webhooksRoutes);
  app.use('/api/schema', schemaRoutes);

  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
  });

  return app;
}

module.exports = createApp;
