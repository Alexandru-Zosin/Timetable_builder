const mysql = require('mysql');
const fs = require("fs");
const path = require("path");
require("dotenv").config();

connectionConfig = {
    connectionLimit: 10,
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: "uaicusers"
}
const pool = mysql.createPool(connectionConfig);

function getConnectionFromPool(dbPool) {
    return new Promise((res, rej) => {
        dbPool.getConnection((err, conn) => {
            if (err) {
                rej(err);
            } else {
                res(conn);
            }
        });
    });
}

async function findUserByEmail(email) {
    const connection = await getConnectionFromPool(pool);
    const statement = `SELECT * FROM uaicusers WHERE email = ?`;
    const user = await new Promise((res, rej) => {
        connection.query(statement, [email], (err, result) => {
            if (err) {
                rej(err);
            } else {
                res(result[0]); // 1. even if a single result, an array will be used
            } // 2.  results need parsing to json
        });
    });
    connection.release();
    return user;
}

module.exports = { };

