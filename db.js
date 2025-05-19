const { Pool } = require('pg');
require('dotenv').config();
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
  user: "worksheet_ter9_user",
  host: "dpg-d0kv41d6ubrc73bl1qdg-a",
  database: "worksheet_ter9",
  password: "7QA2KEif36I5m2Va5agw2Ch2UBvxfMWE",
  port: "5432",
    ssl: {
      rejectUnauthorized: false
    }
});

module.exports = pool;