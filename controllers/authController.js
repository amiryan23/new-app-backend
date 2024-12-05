const db = require('../db');
const validateTelegramData = require('../middlewares/validateTelegram');
const { handleReferral } = require('../utils/referralUtils');

exports.authMiniApp = (req, res) => {
  const { telegram_id, username, first_name, last_name, team, photo_url, referrer_id, initData } = req.body;

  const isValid = validateTelegramData(initData, process.env.BOT_TOKEN);
  if (!isValid) {
    return res.status(403).send('Unauthorized');
  }

  db.query('SELECT * FROM users WHERE telegram_id = ?', [telegram_id], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });

    if (results.length > 0) {
      const existingUser = results[0];
      const updatedUser = {
        username: username || existingUser.username,
        first_name: first_name || existingUser.first_name,
        last_name: last_name || existingUser.last_name,
        team: team || existingUser.team,
        photo_url: photo_url || existingUser.photo_url,
      };

      db.query(
        'UPDATE users SET username = ?, first_name = ?, last_name = ?, team = ?, photo_url = ? WHERE telegram_id = ?',
        [updatedUser.username, updatedUser.first_name, updatedUser.last_name, updatedUser.team, updatedUser.photo_url, telegram_id],
        (err) => {
          console.log(err)
          if (err) return res.status(500).json({ error: 'Error updating user'});
          res.json({ ...existingUser, ...updatedUser });
        }
      );
    } else {
      const newUser = {
        telegram_id,
        username: username || null,
        first_name: first_name || null,
        last_name: last_name || null,
        team: team || null,
        photo_url: photo_url || null,
        points: 0,
        referral_code: `https://t.me/testtest23bot/testing?startapp=${telegram_id}`,
        referral_id: JSON.stringify([]),
        referrer_id: referrer_id || null,
      };

      db.query(
        'INSERT INTO users (telegram_id, username, first_name, last_name, team, photo_url, points, referral_code, referral_id, referrer_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ? , ?)',
        [newUser.telegram_id, newUser.username, newUser.first_name, newUser.last_name, newUser.team, newUser.photo_url, newUser.points, newUser.referral_code, newUser.referral_id, newUser.referrer_id],
        (err) => {
          console.log(err)
          if (err) return res.status(500).json({ error: 'Error saving user' });

          if (referrer_id) {
            handleReferral(referrer_id, telegram_id, res, newUser);
          } else {
            res.json(newUser);
          }
        }
      );
    }
  });
};