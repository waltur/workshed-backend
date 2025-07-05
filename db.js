const { Pool } = require('pg');
require('dotenv').config();
const { types } = require('pg');
types.setTypeParser(1114, (stringValue) => stringValue);
/*
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});
*/
const pool = new Pool({
   user: process.env.DB_USER,
   host: process.env.DB_HOST,
   database: process.env.DB_NAME,
   password: process.env.DB_PASSWORD,
   port: process.env.DB_PORT,

  //  ssl: {
  //    rejectUnauthorized: false
  //  }
});

module.exports = pool;