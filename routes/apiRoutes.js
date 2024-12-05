const express = require('express');
const db = require('../db');
const axios = require('axios')

const router = express.Router();

router.post('/getReferralUsers', (req, res) => {
  const { telegram_id } = req.body;

  // Получаем список referral_id для пользователя
  db.query('SELECT referral_id FROM users WHERE telegram_id = ?', [telegram_id], (err, results) => {
    if (err) {
      console.error('Error fetching referral_ids:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (results.length > 0) {
      const referralIds = JSON.parse(results[0].referral_id); // Парсим строку JSON в массив

      // Ищем пользователей, чьи telegram_id находятся в referral_id
      db.query('SELECT first_name,last_name FROM users WHERE telegram_id IN (?)', [referralIds], (err, referralUsers) => {
        if (err) {
          console.error('Error fetching referral users:', err);
          return res.status(500).json({ error: 'Database error' });
        }

        res.json(referralUsers); // Отправляем найденных пользователей
      });
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  });
});


router.post("/update-wallet", (req, res) => {
    const { telegramId, walletAddress } = req.body;

    if (!telegramId || !walletAddress) {
        return res.status(400).json({ success: false, message: "Недостаточно данных" });
    }

    // Проверяем, существует ли пользователь
    const queryCheck = "SELECT wallet_address FROM users WHERE telegram_id = ?";
    db.query(queryCheck, [telegramId], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: "Ошибка запроса" });

        if (results.length > 0) {
            const existingWallet = results[0].wallet_address;

            // Если адрес кошелька совпадает, ничего не делаем
            if (existingWallet === walletAddress) {
                return res.status(200).json({ success: true, message: "Кошелек совпадает" });
            }

            // Если адрес кошелька отличается, обновляем
            const queryUpdate = "UPDATE users SET wallet_address = ? WHERE telegram_id = ?";
            db.query(queryUpdate, [walletAddress, telegramId], (err) => {
                if (err) return res.status(500).json({ success: false, message: "Ошибка обновления" });

                return res.status(200).json({ success: true, message: "Кошелек обновлен" });
            });
        } else {
            // Если пользователь не найден
            return res.status(404).json({ success: false, message: "Пользователь не найден" });
        }
    });
});

router.post('/create-invoice', async (req, res) => {
  const { keys, price } = req.body;

  if (!price) {
    return res.status(400).json({ error: 'Не переданы обязательные параметры: keys, price' });
  }

  try {
    const invoiceData = {
      title: keys ? `${keys} Keys` : "Skip Level",
      description: `Покупка ${keys} ключей для вашей игры`,
      payload: JSON.stringify({ keys }), 
      provider_token: '', 
      currency: 'XTR', 
      prices: [{ label: `${keys} Keys`, amount: price }], 
    };

    // Запрос к Telegram API
    const response = await axios.post(
      `https://api.telegram.org/bot${process.env.BOT_TOKEN}/createInvoiceLink`,
      invoiceData
    );

    if (response.data.ok) {
      const invoiceLink = response.data.result;
      return res.json({ invoiceLink });
    } else {
      console.error('Ошибка от Telegram API:', response.data);
      return res.status(500).json({ error: 'Не удалось создать счет-фактуру' });
    }
  } catch (error) {
    console.error('Ошибка при создании счета:', error.response?.data || error.message);
    res.status(500).json({ error: 'Ошибка при создании счета' });
  }
});




router.post('/process-payment', async (req, res) => {
  const { invoiceLink, telegram_id, type , keys, levelId , price, status } = req.body;


  if (!invoiceLink || !telegram_id || !price || !status) {
    return res.status(400).json({ error: 'Не все данные переданы' });
  }

  try {

    if(status === "paid"){
   
    // Получаем текущую дату и время для полей created_at и updated_at
    const currentDate = new Date().toISOString();

    // Записываем данные в таблицу payments с использованием db.query
    const query = `
      INSERT INTO payments (telegram_id , type , keys_purchased, price, created_at)
      VALUES (?, ?, ? , ?, ?)
    `;
    db.query(query, [telegram_id, type , keys, price, currentDate], (err, result) => {
      if (err) {
        console.error('Ошибка при записи в таблицу payments:', err);
        return res.status(500).json({ error: 'Ошибка при записи данных' });
      }

      // Обработка статуса платёжной операции
      if (status === 'paid') {
        // Если платёж успешен, обновляем количество ключей у пользователя
       if (type === 'Skip_Level') {

          db.query('SELECT is_completed,reward FROM levels WHERE level = ?', [levelId], (err, result) => {
            if (err) {
              console.error('Ошибка при получении уровня:', err);
              return res.status(500).json({ error: 'Ошибка при получении уровня' });
            }

            if (result.length === 0) {
              console.error('Уровень не найден:', levelId);
              return res.status(404).json({ error: 'Уровень не найден' });
            }

            const levelData = result[0];
            const isCompleted = JSON.parse(levelData.is_completed);
            const reward = result[0].reward

            // Проверяем, если telegram_id еще нет в is_completed, добавляем его
            if (!isCompleted.includes(telegram_id)) {
              isCompleted.push(telegram_id);

              // Обновляем данные в таблице levels
              db.query(
                'UPDATE levels SET is_completed = ? WHERE level = ?',
                [JSON.stringify(isCompleted), levelId],
                (updateErr) => {
                  if (updateErr) {
                    console.error('Ошибка при обновлении уровня:', updateErr);
                    return res.status(500).json({ error: 'Ошибка при обновлении уровня' });
                  }

                  // Обновляем очки пользователя
                  db.query('UPDATE users SET points = points + ? WHERE telegram_id = ?', [reward, telegram_id], (err, result) => {
                    if (err) {
                      console.error('Ошибка при обновлении очков пользователя:', err);
                      return res.status(500).json({ error: 'Ошибка при обновлении очков' });
                    }

                    return res.json({
                      success: true,
                      message: `Уровень успешно пропущен, добавлено ${reward} очков.`,
                    });
                  });
                }
              );
            } else {
              return res.json({
                success: true,
                message: 'Этот пользователь уже завершил уровень.',
              });
            }
          });
        } else if(type === "Keys") {
        const updateKeysQuery = `
          UPDATE users
          SET keysForCode = keysForCode + ?
          WHERE telegram_id = ?
        `;
        db.query(updateKeysQuery, [keys, telegram_id], (err, updateResult) => {
          if (err) {
            console.error('Ошибка при обновлении ключей пользователя:', err);
            return res.status(500).json({ error: 'Ошибка при обновлении ключей' });
          }

          return res.json({ success: true, message: 'Платёж успешно обработан, ключи добавлены.' });
        });
      }} else if (status === 'pending') {
        // Если платёж не завершён, сохраняем данные
        return res.json({ success: false, message: 'Платёж не завершён, данные сохранены.' });
      } else if (status === 'cancelled') {
        // Если платёж отменён
        return res.json({ success: false, message: 'Платёж отменён, данные сохранены.' });
      } else {
        return res.status(400).json({ error: 'Неизвестный статус платежа' });
      }
    });
  }
  } catch (error) {
    console.error('Ошибка при обработке платежа:', error);
    return res.status(500).json({ error: 'Ошибка сервера.' });
  }
});


router.post('/spin', (req, res) => {
  const { telegramId } = req.body;

  // Проверяем, есть ли у пользователя ключи
  const checkKeysQuery = 'SELECT keysForCode, points FROM users WHERE telegram_id = ?';
  db.query(checkKeysQuery, [telegramId], (err, results) => {
    if (err) {
      console.error('Ошибка получения данных пользователя:', err);
      return res.status(500).json({ error: 'Ошибка на сервере' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const user = results[0];
    if (user.keysForCode <= 0) {
      return res.status(400).json({ error: 'Недостаточно ключей для спина!' });
    }

    // Получаем данные колеса
    const wheelQuery = 'SELECT `option`, `type`, `reward`, `weight` FROM wheel_prizes';
    db.query(wheelQuery, (err, wheelResults) => {
      if (err) {
        console.error('Ошибка получения данных колеса:', err);
        return res.status(500).json({ error: 'Ошибка на сервере' });
      }

      // Вычисляем случайный приз с учетом весов
      const totalWeight = wheelResults.reduce((sum, item) => sum + item.weight, 0);
      const randomValue = Math.random() * totalWeight;
      let cumulativeWeight = 0;
      let prizeIndex = 0;

      for (let i = 0; i < wheelResults.length; i++) {
        cumulativeWeight += wheelResults[i].weight;
        if (randomValue <= cumulativeWeight) {
          prizeIndex = i;
          break;
        }
      }

      const prize = wheelResults[prizeIndex];

      // Обновляем ключи и награду пользователя
      const newKeys = user.keysForCode - 1 + (prize.type === 'keys' ? prize.reward : 0);
      const newPoints = user.points + (prize.type === 'points' ? prize.reward : 0);

      const updateQuery = 'UPDATE users SET keysForCode = ?, points = ? WHERE telegram_id = ?';
      db.query(updateQuery, [newKeys, newPoints, telegramId], (err) => {
        if (err) {
          console.error('Ошибка обновления данных пользователя:', err);
          return res.status(500).json({ error: 'Ошибка на сервере' });
        }

        res.json({
          prizeNumber: prizeIndex,
          updatedKeys: newKeys,
          updatedPoints: newPoints,
          rewardPoints:prize.reward,
          typePrize:prize.type
        });
      });
    });
  });
});

module.exports = router