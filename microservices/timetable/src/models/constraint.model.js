const mysql = require('mysql');
require("dotenv").config();

connectionConfig = {
    connectionLimit: 10,
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: "uaictimetables"
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

async function getAllRequests() {
    const connection = await getConnectionFromPool(pool);
    const query = 'SELECT * FROM requests';
    const requests = await new Promise((res, rej) => {
        connection.query(query, (err, results) => {
            if (err)
                rej(err);
            else
                res(results);
        })
    });
    connection.release();
    return requests;
}

async function userMadeRequest(userId) {
    const connection = await getConnectionFromPool(pool);
    const query = `SELECT * FROM requests WHERE id = ?`;
    const requestExists = await new Promise((res, rej) => {
        connection.query(query, [userId], (err, result) => {
            if (err)
                rej(err);
            else
                res(result.length === 0? false : true);
        });
    });
    connection.release();
    return requestExists;
}

async function uploadRequest(userId, data) {
    const connection = await getConnectionFromPool(pool);
    const query = `INSERT INTO requests (id, request) VALUES (?)`;
    const isSuccessfullyInserted = await new Promise((res, rej) => {
        connection.query(query, [userId, data], (err, res) => {
            if (err)
                rej(false);
            else
                res(true);
        });
    });
    connection.release();
    return isSuccessfullyInserted;
}

module.exports = { userMadeRequest, uploadRequest, getAllRequests };