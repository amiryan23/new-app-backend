const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  db.query('SELECT first_name, last_name, points, team, photo_url FROM users', (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(results);
  });
});

router.post('/select-team', async (req, res) => {
  const { telegram_id, team } = req.body;

  if (!telegram_id || !team) {
    return res.status(400).json({ error: 'Не все данные переданы' });
  }

  try {
    const query = 'UPDATE users SET team = ? WHERE telegram_id = ?';
    db.query(query, [team, telegram_id], (err, result) => {
      if (err) {
        console.error('Ошибка при обновлении команды:', err);
        return res.status(500).json({ error: 'Ошибка при обновлении команды' });
      }

      return res.json({ success: true, message: 'Команда успешно обновлена' });
    });
  } catch (error) {
    console.error('Ошибка при обработке запроса:', error);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/decrease-key', (req, res) => {
  const { telegram_id } = req.body;

  console.log('Получен запрос на /users/decrease-key с telegram_id:', telegram_id);

  // Проверка наличия telegram_id
  if (!telegram_id) {
    console.error('Ошибка: Telegram ID отсутствует');
    return res.status(400).json({ message: 'Telegram ID is missing.' });
  }

  // Получаем пользователя
  db.query('SELECT keysForCode FROM users WHERE telegram_id = ?', [telegram_id], (err, userResult) => {
    if (err) {
      console.error('Ошибка при получении пользователя из базы данных:', err);
      return res.status(500).json({ message: 'Database error' });
    }

    // Проверяем, если результат пустой
    if (userResult.length === 0) {
      console.error('Ошибка: Пользователь не найден для telegram_id:', telegram_id);
      return res.status(404).json({ message: 'User not found' });
    }

    const user = userResult[0];

    // Проверяем наличие ключей
    if (!user.keysForCode || user.keysForCode <= 0) {
      console.error('Ошибка: Нет ключей у пользователя с telegram_id:', telegram_id);
      return res.status(400).json({ message: 'No keys left' });
    }

    // Уменьшаем количество ключей
    db.query('UPDATE users SET keysForCode = keysForCode - 1 WHERE telegram_id = ?', [telegram_id], (err, updateResult) => {
      if (err) {
        console.error('Ошибка при обновлении ключей пользователя:', err);
        return res.status(500).json({ message: 'Database error' });
      }

      // Если обновление прошло успешно
      if (updateResult.affectedRows > 0) {
        console.log('Ключ успешно уменьшен для telegram_id:', telegram_id);
        return res.status(200).json({ message: 'Key decreased successfully' });
      } else {
        console.error('Ошибка: Не удалось обновить ключи для telegram_id:', telegram_id);
        return res.status(500).json({ message: 'Failed to decrease keys' });
      }
    });
  });
});

module.exports = router;