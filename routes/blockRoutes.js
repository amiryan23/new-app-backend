const express = require('express');
const db = require('../db');

const router = express.Router();


router.get('/', (req, res) => {
    db.query('SELECT * FROM blocks', (err, blocks) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        // Получаем информацию о владельцах блоков
        const ownerIds = blocks.map(block => block.owner);

        // Получаем данные пользователей (владельцев)
        db.query(
            'SELECT telegram_id, photo_url, first_name FROM users WHERE telegram_id IN (?)',
            [ownerIds],
            (err, users) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ error: 'Database error' });
                }

                // Создаем объект с данными владельцев
                const owners = users.reduce((acc, user) => {
                    acc[user.telegram_id] = user;
                    return acc;
                }, {});

                // Обновляем блоки, добавляя информацию о владельцах
                const updatedBlocks = blocks.map(block => ({
                    ...block,
                    owner_photo_url: owners[block.owner]?.photo_url || null,
                    owner_first_name: owners[block.owner]?.first_name || null,
                }));

                res.json(updatedBlocks);
            }
        );
    });
});


router.post('/buy', (req, res) => {
    const { telegram_id, block_id } = req.body;

    // Проверяем блок
    db.query(
        'SELECT owner, price, is_selling FROM blocks WHERE id = ?',
        [block_id],
        (err, block) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Database error' });
            }

            if (block.length === 0) {
                return res.status(404).send({ error: 'Block not found.' });
            }

            const { owner, price, is_selling } = block[0];

            if (!is_selling) {
                return res.status(400).send({ error: 'Block is not for sale.' });
            }

            if (owner === telegram_id) {
                return res.status(400).send({ error: 'You already own this block.' });
            }

            // Проверяем баланс пользователя
            db.query(
                'SELECT keysForCode FROM users WHERE telegram_id = ?',
                [telegram_id],
                (err, user) => {
                    if (err) {
                        console.error('Database error:', err);
                        return res.status(500).json({ error: 'Database error' });
                    }

                    if (user.length === 0 || user[0].keysForCode < price) {
                        return res.status(400).send({ error: 'Insufficient keys.' });
                    }

                    // Списываем ключи с покупателя
                    db.query(
                        'UPDATE users SET keysForCode = keysForCode - ? WHERE telegram_id = ?',
                        [price, telegram_id],
                        (err) => {
                            if (err) {
                                console.error('Database error:', err);
                                return res.status(500).json({ error: 'Database error' });
                            }

                            // Если блок уже имеет владельца, добавляем цену к его балансу
                            if (owner) {
                                db.query(
                                    'UPDATE users SET keysForCode = keysForCode + ? WHERE telegram_id = ?',
                                    [price, owner],
                                    (err) => {
                                        if (err) {
                                            console.error('Database error:', err);
                                            return res.status(500).json({ error: 'Database error' });
                                        }
                                    }
                                );
                            }

                            // Обновляем владельца блока
                            db.query(
                                'UPDATE blocks SET owner = ?, is_selling = FALSE WHERE id = ?',
                                [telegram_id, block_id],
                                (err) => {
                                    if (err) {
                                        console.error('Database error:', err);
                                        return res.status(500).json({ error: 'Database error' });
                                    }

                                    // Записываем транзакцию
                                    db.query(
                                        'INSERT INTO block_transactions (block_id, new_owner, old_owner, price) VALUES (?, ?, ?, ?)',
                                        [block_id, telegram_id, owner, price],
                                        (err) => {
                                            if (err) {
                                                console.error('Database error:', err);
                                                return res.status(500).json({ error: 'Database error' });
                                            }

                                            res.status(200).send({ message: 'Block purchased successfully.' });
                                        }
                                    );
                                }
                            );
                        }
                    );
                }
            );
        }
    );
});


router.post('/sell', (req, res) => {
    const { user_id, block_id, new_price } = req.body;

    if (new_price < 50 || new_price > 999) {
        return res.status(400).send({ error: 'Price must be between 50 and 999 keys.' });
    }

   
    db.query('SELECT owner FROM blocks WHERE id = ?', [block_id], (err, blocks) => {
        if (err) {
            console.error('Error fetching block:', err);
            return res.status(500).send({ error: 'Failed to fetch block.' });
        }

        if (blocks.length === 0) {
            return res.status(404).send({ error: 'Block not found.' });
        }

        if (blocks[0].owner !== user_id) {
            return res.status(403).send({ error: 'You do not own this block.' });
        }

        
        db.query(
            'UPDATE blocks SET price = ?, is_selling = TRUE WHERE id = ?',
            [new_price, block_id],
            (err) => {
                if (err) {
                    console.error('Error updating block:', err);
                    return res.status(500).send({ error: 'Failed to update block sale status.' });
                }

                res.status(200).send({ message: 'Block is now for sale.' });
            }
        );
    });
});



module.exports = router