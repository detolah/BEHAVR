const express = require('express');
const { getSchema } = require('../services/schema-service');

const router = express.Router();

router.get('/:industry', (req, res) => {
  const schema = getSchema(req.params.industry);
  res.json(schema);
});

module.exports = router;
