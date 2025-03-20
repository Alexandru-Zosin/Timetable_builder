const mysql = require('mysql');
require("dotenv").config();

connectionConfig = {
    connectionLimit: 10,
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: "uaicusers"
}
const pool = mysql.createPool(connectionConfig);

connectionConfig2 = {
    connectionLimit: 10,
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: "uaic"
}
const pool2 = mysql.createPool(connectionConfig2);

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

async function getHashedPasswordForUserId(userId) {
    const connection = await getConnectionFromPool(pool);
    const query = `SELECT password FROM users where id = ?`
    const password = await new Promise((res, rej) => {
        connection.query(query, [userId], (err, result) => {
            if (err)
                rej(err);
            else 
                res(result[0]);
        })
    })
    connection.release();
    return password;
}

async function findUserByEmail(email) {
    const connection = await getConnectionFromPool(pool);
    const statement = `SELECT * FROM users WHERE email = ?`;
    const user = await new Promise((res, rej) => {
        connection.query(statement, [email], (err, result) => {
            if (err) {
                rej(err);
            } else {
                res(result[0]); // 1. even if a single result, an array will be used
            }
        });
    });
    connection.release();
    return user;
}

async function registerUser(userData) {
    const user = await findUserByEmail(userData.email); // ^
    
    if (user != null) { // if there's an user with this email, we return false (new reg. not possible)
        return false;
    }
    
    const connection = await getConnectionFromPool(pool);
    const query = 'INSERT INTO users (email, password, grouptag) VALUES (?, ?, ?)';
    const isRegisterSuccessful = await new Promise((res) => {
        connection.query(query, [userData.email, userData.password, userData.grouptag], (err, results) => {
        if (err)
            res(false);
        else
            res(true);
        });
    });
    connection.release();
    return isRegisterSuccessful;
}

async function getGroups() {
    const connection = await getConnectionFromPool(pool2);
    const query = 'SELECT name FROM groups WHERE LENGTH(name) = 2';
    const groups = await new Promise((res, rej) => {
        connection.query(query, (err, results) => {
            if (err) {
                rej(err);
            } else {
                res(results);
            }
        });
    });
    connection.release();
    return groups;
}

module.exports = { findUserByEmail, registerUser, getHashedPasswordForUserId, getGroups };