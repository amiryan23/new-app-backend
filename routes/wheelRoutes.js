const express = require('express');
const db = require('../db');

const router = express.Router();


router.get('/', (req, res) => {
  const query = 'SELECT `option`, `type`, `reward`, `weight`, `style`  FROM wheel_prizes';

  db.query(query, (err, results) => {
    if (err) {
      console.error('Ошибка выполнения запроса:', err);
      res.status(500).json({ error: 'Ошибка на сервере' });
    } else {
      // Преобразуем поле `style` из JSON-строки в объект
      const data = results.map((row) => ({
        ...row,
        style: JSON.parse(row.style),
        
      }));
      res.json(data); // Отправляем данные на клиент
    }
  });
});


module.exports = router