require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db'); // Подключение к базе данных
const crypto = require('crypto');
const bodyParser = require('body-parser');
const axios = require('axios')
const { Telegraf } = require("telegraf");
const authRoutes = require('./routes/authRoutes');
const usersRoutes = require('./routes/usersRoutes');
const taskRoutes = require('./routes/taskRoutes');
const levelRoutes = require('./routes/levelRoutes');
const shopRoutes = require('./routes/shopRoutes');
const wheelRoutes = require('./routes/wheelRoutes');
const apiRoutes = require('./routes/apiRoutes');


const app = express();
app.use(cors({
    origin: '*', 
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
app.use('/wheel_prizes', wheelRoutes);
app.use('/api',apiRoutes)




let bot = new Telegraf(process.env.BOT_TOKEN)

bot.start((ctx) => ctx.reply('Привет! Бот работает.'));



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



const PORT = process.env.PORT ;
app.listen(PORT,'0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);

});