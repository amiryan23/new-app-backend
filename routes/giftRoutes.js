const express = require('express');
const db = require('../db');

const router = express.Router();



router.get('/', (req, res) => {
    db.query('SELECT * FROM gifts', (err, gifts) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        const ownerIds = gifts.map(gift => gift.owner);

        db.query(
            'SELECT telegram_id, photo_url, first_name FROM users WHERE telegram_id IN (?)',
            [ownerIds],
            (err, users) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ error: 'Database error' });
                }

                const owners = users.reduce((acc, user) => {
                    acc[user.telegram_id] = user;
                    return acc;
                }, {});

                // Преобразуем строку is_claimed в массив, если она существует
                const updatedGifts = gifts.map(gift => {
                    const claimedUsers = JSON.parse(gift.is_claimed || '[]'); 
                    return {
                        ...gift,
                        owner_photo_url: owners[gift.owner]?.photo_url || null,
                        owner_first_name: owners[gift.owner]?.first_name || null,
                        is_claimed_users: claimedUsers, // Возвращаем массив пользователей
                    };
                });

                res.json(updatedGifts);
            }
        );
    });
});

router.post('/claim-gift', (req, res) => {
    const { giftId, TelegramId } = req.body; // Получаем ID подарка и Telegram ID пользователя

    // Получаем информацию о подарке из базы данных
    db.query('SELECT * FROM gifts WHERE id = ?', [giftId], (err, result) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        const gift = result[0];
        if (!gift) {
            return res.status(404).json({ error: 'Gift not found' });
        }

        // Проверяем, был ли уже забран подарок этим пользователем
        const isClaimed = JSON.parse(gift.is_claimed || '[]');
        if (isClaimed.includes(TelegramId)) {
            return res.status(400).json({ error: 'You have already claimed this gift' });
        }

        // Проверяем, не превышает ли лимит пользователей, которые могут забрать подарок
        if (isClaimed.length >= gift.limite) {
            return res.status(400).json({ error: 'Gift limit reached' });
        }

        // Если все проверки пройдены, добавляем пользователя в массив is_claimed
        isClaimed.push(TelegramId);

        // Проверяем, если лимит достигнут, обновляем статус подарка на "Ended"
        if (isClaimed.length >= gift.limite) {
            db.query(
                'UPDATE gifts SET status = ? WHERE id = ?',
                ['Ended', giftId],
                (err) => {
                    if (err) {
                        console.error('Database error:', err);
                        return res.status(500).json({ error: 'Failed to update gift status' });
                    }
                }
            );
        }

        // Обновляем запись о подарке в базе данных
        db.query(
            'UPDATE gifts SET is_claimed = ? WHERE id = ?',
            [JSON.stringify(isClaimed), giftId],
            (err) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ error: 'Failed to update gift claim' });
                }

                // Находим пользователя по Telegram ID
                db.query('SELECT points FROM users WHERE telegram_id = ?', [TelegramId], (err, userResult) => {
                    if (err) {
                        console.error('Error fetching user data:', err);
                        return res.status(500).json({ error: 'Database error' });
                    }

                    if (userResult.length === 0) {
                        return res.status(404).json({ error: 'User not found' });
                    }

                    const user = userResult[0];
                    const currentPoints = user.points || 0; // Получаем текущие баллы пользователя, если их нет, то 0

                    // Добавляем награду за подарок
                    const rewardPoints = gift.reward || 0; // Определяем количество баллов за подарок
                    const newPoints = currentPoints + rewardPoints;

                    // Обновляем баллы пользователя в базе данных
                    db.query(
                        'UPDATE users SET points = ? WHERE telegram_id = ?',
                        [newPoints, TelegramId],
                        (err) => {
                            if (err) {
                                console.error('Error updating user points:', err);
                                return res.status(500).json({ error: 'Failed to update user points' });
                            }

                            // Отправляем успешный ответ
                            return res.json({
                                success: true,
                                message: 'Gift claimed successfully and points added',
                                newPoints: newPoints, // Отправляем обновленные баллы
                            });
                        }
                    );
                });
            }
        );
    });
});


router.post('/create-gift', (req, res) => {
    const { telegram_id, limite, isPrivate, description, link } = req.body;

    // Проверка обязательных данных
    if (!telegram_id || !limite || !description) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // Расчет стоимости подарка
    const giftCost = limite * 500;

    // Проверяем, достаточно ли баллов у пользователя
    db.query('SELECT points FROM users WHERE telegram_id = ?', [telegram_id], (err, userResult) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to retrieve user points' });
        }

        if (userResult.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const userPoints = userResult[0].points || 0;

        if (userPoints < giftCost) {
            return res.status(400).json({ error: 'Not enough points to create gift' });
        }

        // Вычитаем стоимость подарка из баланса пользователя
        const newPoints = userPoints - giftCost;
        db.query(
            'UPDATE users SET points = ? WHERE telegram_id = ?',
            [newPoints, telegram_id],
            (err) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ error: 'Failed to update user points' });
                }

                // Формирование объекта нового подарка
                const newGift = {
                    owner: telegram_id,
                    is_claimed_users: JSON.stringify([]), // Пустой массив в виде строки JSON
                    limite: limite,
                    reward: 500, // Фиксированная награда
                    private: isPrivate ? 1 : 0, // Преобразование boolean в 0 или 1
                    description: description,
                    link: link || null, // Если пусто, сохраняем null
                    verified: 0, // По умолчанию подарок не верифицирован
                    status: 'active' // По умолчанию подарок активен
                };

                // Сохранение подарка в базе данных
                db.query(
                    `INSERT INTO gifts (owner, is_claimed, limite, reward, private, description, link, verified, status)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        newGift.owner,
                        newGift.is_claimed_users,
                        newGift.limite,
                        newGift.reward,
                        newGift.private,
                        newGift.description,
                        newGift.link,
                        newGift.verified,
                        newGift.status
                    ],
                    (err, result) => {
                        if (err) {
                            console.error('Database error:', err);
                            return res.status(500).json({ error: 'Failed to create gift' });
                        }

                        res.status(201).json({
                            success: true,
                            message: 'Gift created successfully',
                            gift: { id: result.insertId, ...newGift }, // Возвращаем созданный подарок с ID
                            remainingPoints: newPoints // Отправляем оставшиеся баллы пользователя
                        });
                    }
                );
            }
        );
    });
});

module.exports = router;

