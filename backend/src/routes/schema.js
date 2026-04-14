const express = require('express');
const { getSchema } = require('../services/schema-service');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/:industry', requireAuth, (req, res) => {
  const schema = getSchema(req.params.industry);
  res.json(schema);
});

module.exports = router;
