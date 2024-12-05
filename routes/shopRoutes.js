const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/items', async (req, res) => {
  db.query('SELECT * FROM shop_items', (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    res.json(results);
  });
});


module.exports = router