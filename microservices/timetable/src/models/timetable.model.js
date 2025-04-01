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

async function getTimetable() {
    const connection = await getConnectionFromPool(pool);
    const query = `SELECT data, class_list, extra_restrictions FROM timetables WHERE active = 1;`;
    const timetable = await new Promise((res, rej) => {
        connection.query(query, (err, result) => {
            if (err)
                rej(err);
            else {
                result.length === 0 ? res(null) : res({
                    data: JSON.parse(result[0].data),
                    class_list: JSON.parse(result[0].class_list),
                    extra_restrictions: JSON.parse(result[0].extra_restrictions)
                });
            }
        });
    });
    connection.release();
    return timetable;
}

async function uploadTimetable(newTimetable) {
    const connection = await getConnectionFromPool(pool);
    try {
        const deactivateQuery = `UPDATE timetables SET active = 0`;
        await new Promise((res, rej) => {
            connection.query(deactivateQuery, (err) => {
                if (err) 
                    rej(false);
                else
                    res(true);
            });
        });

        let { data, class_list, extra_restrictions } = newTimetable;

        const query = `INSERT INTO timetables (data, class_list, extra_restrictions, active) VALUES (?, ?, ?, 1)`;
        const isSuccessfullyInserted = await new Promise((res, rej) => {
            connection.query(query, [JSON.stringify(data), JSON.stringify(class_list), JSON.stringify(extra_restrictions)], (err, result) => {
                if (err)
                    rej(false);
                else
                    res(true);
            });
        });
        connection.release();
        return isSuccessfullyInserted;
    } catch (error) {
        console.error("Error uploading timetable:", error);
        return false;
    }
}

module.exports = { getTimetable, uploadTimetable };