const mysql = require("mysql")
const fs = require("fs")
const path = require("path")
require("dotenv").config();

function readJsonFile(filePath) {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function connectToDatabase(config) {
    return new Promise((res, rej) => {
        const connection = mysql.createConnection(config);
        connection.connect(function(err) { // callback when conn. is ready
            if(err) {
                rej(err);
            } else {
                res(connection);
            }
        });
    });
}

function queryDatabase(connection, statement, values = []) {
    return new Promise((res, rej) => {
        connection.query(statement, values, (err, result) => { // where id = 1 or 1 = 1 vs id = " 1 or ..."
            if (err) {                              // used as raw data parameter
                rej(err);
            } else {
                res(result)
            }
        });
    })
}

function closeConnection(connection) {
    return new Promise((res, rej) => {
        connection.end((err) => err ? rej(err) : res());
    });
}

async function initializeDatabases() {
    try {
        connectionConfig = {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD
        }
        const connection = await connectToDatabase(connectionConfig);

        let statement = `DROP DATABASE IF EXISTS uaicusers`
        await queryDatabase(connection, statement);
        console.log("uaicusers database dropped.");
        statement = `CREATE DATABASE uaicusers`;
        await queryDatabase(connection, statement);
        console.log("uaicusers database created.");
        await closeConnection(connection);
        console.log("Initial connection ended.")

        connectionConfig = {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: "uaicusers"
        }
        const usersConnection = await connectToDatabase(connectionConfig);

        console.log("Connected to uaicusers!");

        statement = `CREATE TABLE IF NOT EXISTS users (
            id INT PRIMARY KEY AUTO_INCREMENT,
            email VARCHAR(255) NOT NULL UNIQUE,
            password CHAR(64) NOT NULL,
            role ENUM('student', 'teacher', 'admin') NOT NULL DEFAULT 'student',
            requested BOOLEAN NOT NULL DEFAULT TRUE
        );`; // alter table required if not good: alter table users modify column role ...
        // select role from users where id = 1 =-> student
        // fixed data size is better/faster for lookups 
        await queryDatabase(usersConnection, statement);
        console.log("users table has been created in uaicusersDB.")

        const insAdmStatement = `INSERT INTO users (email, password, role, requested) VALUES(
            'admin@uaic.info.ro',
            'hashedPass',
            'admin',
            FALSE)`;

        // insert request table and timetable required stuff
        await queryDatabase(usersConnection, insAdmStatement);
        console.log("Admin was successfully inserted.");
        await closeConnection(usersConnection);
        console.log("uaicusers connection was successfully ended.");

    } catch (err) {
        console.log(err);
    }
}

initializeDatabases();