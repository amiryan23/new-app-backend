const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  db.query('SELECT id, level, imgUrl , is_completed, reward, is_closed, is_ended FROM levels', (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    res.json(results); // Возвращаем данные без поля code
  });
});

router.post('/verify-code', (req, res) => {
  const { id, userCode, telegram_id } = req.body;

  db.query('SELECT code, is_completed, reward FROM levels WHERE level = ?', [id], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Level not found' });
    }

    const levelCode = results[0].code;
    const isCompleted = JSON.parse(results[0].is_completed || '[]'); // Парсим массив пользователей
    const reward = results[0].reward || 1000; // Получаем вознаграждение для этого уровня

    if (levelCode === userCode) {
      // Проверяем, добавлен ли уже telegram_id
      if (!isCompleted.includes(telegram_id)) {
        isCompleted.push(telegram_id); // Добавляем telegram_id

        // Обновляем массив is_completed в базе данных
        db.query(
          'UPDATE levels SET is_completed = ? WHERE level = ?',
          [JSON.stringify(isCompleted), id],
          (updateErr) => {
            if (updateErr) {
              console.error('Error updating level:', updateErr);
              return res.status(500).json({ error: 'Failed to update level data' });
            }

            // Теперь обновляем очки пользователя
            db.query('UPDATE users SET points = points + ? WHERE telegram_id = ?', [reward, telegram_id], (err, result) => {
              if (err) {
                console.error('Error updating points:', err);
                return res.status(500).json({ error: 'Failed to update points' });
              }

              return res.json({
                success: true,
                message: `Code verified and user added to completion list! +${reward} points added.`,
              });
            });
          }
        );
      } else {
        return res.json({ success: true, message: 'Code verified but user is already in completion list!' });
      }
    } else {
      return res.status(400).json({ success: false, message: 'Invalid code' });
    }
  });
});


module.exports = router