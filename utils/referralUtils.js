const db = require('../db');

function handleReferral(referrer_id, telegram_id, res, userData) {
  db.query('SELECT referral_id, points , keysForCode FROM users WHERE telegram_id = ?', [referrer_id], (err, results) => {
    if (err) {
      console.error('Error fetching referrer:', err);
      return res.status(500).json({ error: 'Database error while fetching referrer' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Referrer not found' });
    }

    const referrer = results[0];
    const referralArray = JSON.parse(referrer.referral_id || '[]');

    // Проверяем, есть ли уже пользователь в массиве
    if (!referralArray.includes(telegram_id)) {
      referralArray.push(telegram_id);

      // Обновляем массив referral_id и добавляем 250 points пригласившему пользователю
      db.query(
        'UPDATE users SET referral_id = ?, points = points + 250 , keysForCode = keysForCode + 1 WHERE telegram_id = ?',
        [JSON.stringify(referralArray), referrer_id],
        (updateErr) => {
          if (updateErr) {
            console.error('Error updating referrer:', updateErr);
            return res.status(500).json({ error: 'Failed to update referrer data' });
          }

          res.json({
            ...userData,
            message: 'Referral successfully added! Referrer awarded 250 points.',
          });
        }
      );
    } else {
      res.json({
        ...userData,
        message: 'User is already in referral list!',
      });
    }
  });
}

module.exports = {
  handleReferral,
};