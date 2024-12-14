require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db'); // Подключение к базе данных
const crypto = require('crypto');
const bodyParser = require('body-parser');
const axios = require('axios')
const cron = require('node-cron');
const { Telegraf } = require("telegraf");
const authRoutes = require('./routes/authRoutes');
const usersRoutes = require('./routes/usersRoutes');
const taskRoutes = require('./routes/taskRoutes');
const levelRoutes = require('./routes/levelRoutes');
const shopRoutes = require('./routes/shopRoutes');
const wheelRoutes = require('./routes/wheelRoutes');
const apiRoutes = require('./routes/apiRoutes');
const blockRoutes = require('./routes/blockRoutes');
const giftRoutes = require('./routes/giftRoutes');


const app = express();
app.use(cors({
    origin: 'https://new-app-santa-quest.netlify.app', 
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'))

app.use('/auth', authRoutes);
app.use('/users', usersRoutes);
app.use('/tasks', taskRoutes);
app.use('/levels', levelRoutes);
app.use('/shop', shopRoutes);
app.use('/blocks', blockRoutes);
app.use('/wheel_prizes', wheelRoutes);
app.use('/api',apiRoutes)
app.use('/gifts',giftRoutes)






let bot = new Telegraf(process.env.BOT_TOKEN)

bot.command('start',async (ctx) => {
  await ctx.replyWithPhoto({ url: 'https://i.ibb.co/SBgmpWB/2.png' }, {
    caption: 'Welcome to our game! Here you can find exciting adventures and quests. Ready to play?',
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Start', url: 'https://t.me/santaquest_bot/santaquest' }],
        [{ text: 'Join Community', url: 'https://t.me/santaquest' }]
      ]
    }
  });
});



bot.on('pre_checkout_query', (ctx) => {
    ctx.answerPreCheckoutQuery(true)
})

bot.on('message', (ctx) => {
    if (ctx.update.message.successful_payment != undefined) {
        ctx.reply('Thanks for the purchase!')
    } else {
        // Handle other message types, subtypes
    }
})

bot.launch()
  .then(() => console.log('Бот запущен!'))
  .catch((error) => console.error('Ошибка при запуске бота:', error));


cron.schedule('0 * * * *', () => {
    const now = new Date();
    console.log('Task is running every hour');
    db.query('SELECT id, owner, reward, last_reward_time FROM blocks WHERE owner IS NOT NULL', (err, blocks) => {
        if (err) {
            return console.error('Error fetching blocks:', err);
        }

        blocks.forEach((block) => {
            const { id, owner, reward, last_reward_time } = block;
// 
//             const elapsedHours = Math.floor((now - new Date(last_reward_time)) / (1000 * 60 * 60));
//             if (elapsedHours > 0) {
                const newPoints = reward;

                
                db.query(
                    'UPDATE users SET points = points + ? WHERE telegram_id = ?',
                    [newPoints, owner],
                    (err) => {
                        if (err) {
                            return console.error(`Error updating points for user ${owner}:`, err);
                        }

                       
                        db.query(
                            'UPDATE blocks SET last_reward_time = ? WHERE id = ?',
                            [now, id],
                            (err) => {
                                if (err) {
                                    return console.error(`Error updating block ${id}:`, err);
                                }
                                console.log(`Rewards updated for block ${id} and user ${owner}`);
                            }
                        );
                    }
                );
            // }
        });
    });
});





const PORT = process.env.PORT ;
app.listen(PORT,'0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);

});