const db = require('../db'); // Подключение к базе данных
const { getRandomPoints } = require('../utils/getRandomPoints'); // Утилита для получения случайных очков

exports.claimChest = (req, res) => {
  const { telegram_id } = req.body;

  if (!telegram_id) {
    return res.status(400).json({ error: 'Telegram ID is required' });
  }

  // Получаем данные пользователя
  db.query(
    'SELECT points, points_from_chest, last_claim_time FROM users WHERE telegram_id = ?',
    [telegram_id],
    (err, results) => {
      if (err) {
        return res.status(500).json({ error: 'Database error', details: err });
      }

      if (results.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const user = results[0];
      const currentTime = new Date();
      const lastClaimTime = user.last_claim_time ? new Date(user.last_claim_time) : null; // Проверяем, пустое ли значение
      const eightHours = 8 * 60 * 60 * 1000;

      // Если last_claim_time пустое или прошло 8 часов, разрешаем награду
      if (!lastClaimTime || currentTime - lastClaimTime >= eightHours) {
        const pointsFromChest = getRandomPoints(100, 1000);

        // Обновляем данные пользователя
        db.query(
          'UPDATE users SET points = points + ?, points_from_chest = ?, last_claim_time = ? WHERE telegram_id = ?',
          [pointsFromChest, pointsFromChest, currentTime, telegram_id],
          (updateErr) => {
            if (updateErr) {
              return res.status(500).json({ error: 'Error updating user data', details: updateErr });
            }

            const nextClaimTime = new Date(currentTime.getTime() + eightHours).toISOString();

            res.json({
              message: `You received ${pointsFromChest} points!`,
              points_from_chest: pointsFromChest,
              next_claim_time: nextClaimTime,
            });
          }
        );
      } else {
        // Если не прошло 8 часов, возвращаем ошибку
        const remainingTime = eightHours - (currentTime - lastClaimTime);
        const hours = Math.floor(remainingTime / (1000 * 60 * 60));
        const minutes = Math.floor((remainingTime % (1000 * 60 * 60)) / (1000 * 60));
        return res.status(400).json({
          error: `You can claim again in ${hours} hours and ${minutes} minutes.`,
          remainingTime,
        });
      }
    }
  );
};