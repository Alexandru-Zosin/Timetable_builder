const mysql = require('mysql');
require("dotenv").config();

connectionConfig = {
    connectionLimit: 10,
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: "uaic"
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

async function getTeachersList() {
    const connection = await getConnectionFromPool(pool);
    const query = `SELECT name FROM teachers`;
    const teachers = await new Promise((res, rej) => {
        connection.query(query, (err, result) => {
            if (err) {
                rej(err);
            } else {
                res(result);
            }
        });
    });
    connection.release;
    return teachers;
}

async function getGroupsList() {
    const connection = await getConnectionFromPool(pool);
    const query = `SELECT name FROM groups`;
    const groups = await new Promise((res, rej) => {
        connection.query(query, (err, result) => {
            if (err) {
                rej(err);
            } else {
                res(result);
            }
        });
    });
    connection.release();
    return groups;
}

module.exports = { getGroupsList, getTeachersList };