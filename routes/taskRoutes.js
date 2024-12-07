const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/' ,(req,res) => {
  db.query('SELECT * FROM tasks',(err,results) => {
    if(err) {
      console.error("Database error:",err);
      return res.status(500).json({error: 'Database error'})
    }

    res.json(results)
  })
});

router.post('/claim', (req, res) => {
  const { taskId, telegram_id } = req.body;

  // Получаем задачу по id
  db.query('SELECT is_completed, reward FROM tasks WHERE id = ?', [taskId], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const isCompleted = JSON.parse(results[0].is_completed || '[]'); // Парсим массив выполненных пользователей
    const reward = results[0].reward || 0; // Вознаграждение за выполнение задачи

    // Проверяем, добавлен ли telegram_id в массив
    if (isCompleted.includes(telegram_id)) {
      return res.status(400).json({ success: false, message: 'Task already claimed by this user.' });
    }

    // Добавляем telegram_id в массив
    isCompleted.push(telegram_id);

    // Обновляем массив is_completed в базе данных
    db.query(
      'UPDATE tasks SET is_completed = ? WHERE id = ?',
      [JSON.stringify(isCompleted), taskId],
      (updateErr) => {
        if (updateErr) {
          console.error('Error updating task:', updateErr);
          return res.status(500).json({ error: 'Failed to update task data' });
        }

        // Добавляем награду пользователю
        db.query('UPDATE users SET points = points + ? WHERE telegram_id = ?', [reward, telegram_id], (err) => {
          if (err) {
            console.error('Error updating points:', err);
            return res.status(500).json({ error: 'Failed to update points' });
          }

          return res.json({
            success: true,
            message: `Task claimed successfully! +${reward} points added.`,
          });
        });
      }
    );
  });
});

router.post('/claimKey', (req, res) => {
  const { taskId, telegram_id } = req.body;

  // Получаем задачу по ID
  db.query('SELECT is_completed, reward FROM tasks WHERE id = ?', [taskId], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const isCompleted = JSON.parse(results[0].is_completed || '[]'); // Парсим массив выполненных пользователей
    const keysReward = results[0].reward || 0; // Вознаграждение ключами за выполнение задачи

    // Проверяем, добавлен ли telegram_id в массив
    if (isCompleted.includes(telegram_id)) {
      return res.status(400).json({ success: false, message: 'Task already claimed by this user.' });
    }

    // Добавляем telegram_id в массив
    isCompleted.push(telegram_id);

    // Обновляем массив is_completed в базе данных
    db.query(
      'UPDATE tasks SET is_completed = ? WHERE id = ?',
      [JSON.stringify(isCompleted), taskId],
      (updateErr) => {
        if (updateErr) {
          console.error('Error updating task:', updateErr);
          return res.status(500).json({ error: 'Failed to update task data' });
        }

        // Добавляем ключи пользователю
        db.query(
          'UPDATE users SET keysForCode = keysForCode + ? WHERE telegram_id = ?',
          [keysReward, telegram_id],
          (err) => {
            if (err) {
              console.error('Error updating keys:', err);
              return res.status(500).json({ error: 'Failed to update keys' });
            }

            return res.json({
              success: true,
              message: `Task claimed successfully! +${keysReward} keys added.`,
            });
          }
        );
      }
    );
  });
});

router.post('/claim-with-points', (req, res) => {
  const { taskId, telegram_id } = req.body;

  // Получаем задачу и информацию о минимальных очках
  db.query('SELECT is_completed, reward, earnedPoints FROM tasks WHERE id = ?', [taskId], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = results[0];
    const isCompleted = JSON.parse(task.is_completed || '[]'); // Массив пользователей, выполнивших задачу
    const reward = task.reward || 0;
    const earnedPoints = task.earnedPoints || 0;

    // Проверяем, добавлен ли telegram_id
    if (isCompleted.includes(telegram_id)) {
      return res.status(400).json({ success: false, message: 'Task already claimed by this user.' });
    }

    // Получаем данные пользователя
    db.query('SELECT points FROM users WHERE telegram_id = ?', [telegram_id], (userErr, userResults) => {
      if (userErr) {
        console.error('Error fetching user:', userErr);
        return res.status(500).json({ error: 'Failed to fetch user data' });
      }

      if (userResults.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const userPoints = userResults[0].points;

      // Проверяем, достаточно ли очков
      if (userPoints >= earnedPoints) {
        // Добавляем telegram_id в массив
        isCompleted.push(telegram_id);

        // Обновляем задачу
        db.query(
          'UPDATE tasks SET is_completed = ? WHERE id = ?',
          [JSON.stringify(isCompleted), taskId],
          (updateErr) => {
            if (updateErr) {
              console.error('Error updating task:', updateErr);
              return res.status(500).json({ error: 'Failed to update task data' });
            }

            // Начисляем награду
            db.query('UPDATE users SET points = points + ? WHERE telegram_id = ?', [reward, telegram_id], (rewardErr) => {
              if (rewardErr) {
                console.error('Error updating points:', rewardErr);
                return res.status(500).json({ error: 'Failed to update user points' });
              }

              return res.json({
                success: true,
                message: `Task claimed successfully! +${reward} points added.`,
              });
            });
          }
        );
      } else {
        // Если недостаточно очков
        return res.status(400).json({
          success: false,
          message: `Insufficient points. You need at least ${earnedPoints} points to claim this task.`,
        });
      }
    });
  });
});


module.exports = router;
