const mysql2 = require('mysql2');


const urlDB = `mysql://${process.env.MYSQLUSER}:${process.env.MYSQLPASSWORD}@${process.env.MYSQLHOST}:${process.env.MYSQLPORT}/${process.env.MYSQLDATABASE}`

const connection = mysql2.createConnection(urlDB);

connection.connect((err) => {
  if (err) {
    console.error('Ошибка подключения к базе данных:', err.message);
  } else {
    console.log('Успешно подключено к базе данных');
  }
});

module.exports = connection;