const mysql = require("mysql");
const fs = require("fs");
require("dotenv").config();

function connectToDatabase(config) {
    return new Promise((res, rej) => {
        const connection = mysql.createConnection(config);
        connection.connect(err => err ? rej(err) : res(connection));
    });
}

function queryDatabase(connection, statement, values = []) {
    return new Promise((res, rej) => {
        connection.query(statement, values, (err, result) => err ? rej(err) : res(result));
    });
}

function closeConnection(connection) {
    return new Promise((res, rej) => {
        connection.end(err => err ? rej(err) : res());
    });
}

async function getDatabaseAsJson() {
    try {
        const connectionConfig = {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: "uaic"
        };

        const connection = await connectToDatabase(connectionConfig);

        console.log("Connected to database. Retrieving data...");

        // retrieve timeslots
        const timeslots = await queryDatabase(connection, `
            SELECT id AS code, day, TIME_FORMAT(hour, '%H:%i') AS hour FROM timeslots
        `);

        // retrieve teachers
        const teachersRaw = await queryDatabase(connection, `
            SELECT id AS code, name, max_hours, can_teach_course FROM teachers
        `);

        // retrieve subjects
        const subjectsRaw = await queryDatabase(connection, `
            SELECT id AS code, name, is_optional FROM subjects
        `);

        // retrieve teacher-subject relationships
        const teacherSubjectsRaw = await queryDatabase(connection, `
            SELECT teacher_id, subject_id FROM teacher_subjects
        `);
        const teacherSubjectsMap = {};
        teacherSubjectsRaw.forEach(({ teacher_id, subject_id }) => {
            if (!teacherSubjectsMap[teacher_id]) {
                teacherSubjectsMap[teacher_id] = [];
            }
            teacherSubjectsMap[teacher_id].push(subject_id);
        });

        // format teachers with subjects taught
        const teachers = teachersRaw.map(teacher => ({
            ...teacher,
            subjects_taught: teacherSubjectsMap[teacher.code] || []
        }));

        // retrieve rooms
        const roomsRaw = await queryDatabase(connection, `
            SELECT id AS code, name, course_possible FROM rooms
        `);

        // retrieve room-timeslot availability
        const roomTimesRaw = await queryDatabase(connection, `
            SELECT room_id, timeslot_id FROM room_times
        `);
        const roomTimesMap = {};
        roomTimesRaw.forEach(({ room_id, timeslot_id }) => {
            if (!roomTimesMap[room_id]) {
                roomTimesMap[room_id] = [];
            }
            roomTimesMap[room_id].push(timeslot_id);
        });

        // format rooms with possible times
        const rooms = roomsRaw.map(room => ({
            ...room,
            possible_times: roomTimesMap[room.code] || []
        }));

        // retrieve groups
        const groups = await queryDatabase(connection, `
            SELECT id AS code, name, language FROM groups
        `);

        // retrieve extra restrictions
        const restrictionsRaw = await queryDatabase(connection, `
            SELECT teacher_id, restriction_type, timeslot_id, value FROM extra_restrictions
        `);

        const extraRestrictions = {
            unpreferred_timeslots: {},
            max_daily_hours: {}
        };

        restrictionsRaw.forEach(({ teacher_id, restriction_type, timeslot_id, value }) => {
            if (restriction_type === 'unpreferred_timeslots') {
                if (!extraRestrictions.unpreferred_timeslots[teacher_id]) {
                    extraRestrictions.unpreferred_timeslots[teacher_id] = [];
                }
                extraRestrictions.unpreferred_timeslots[teacher_id].push(timeslot_id);
            } else if (restriction_type === 'max_daily_hours') {
                extraRestrictions.max_daily_hours[teacher_id] = value;
            }
        });

        // close connection
        await closeConnection(connection);
        console.log("Data retrieval complete. Connection closed.");

        const finalJson = {
            timeslots,
            teachers,
            subjects: subjectsRaw,
            rooms,
            groups,
            extra_restrictions: extraRestrictions
        };

        // Write to file
        fs.writeFileSync("database_dump.json", JSON.stringify(finalJson, null, 4), "utf8");
        console.log("JSON saved to database_dump.json");

        return finalJson;

    } catch (err) {
        console.error("Error retrieving data:", err);
    }
}

// Call function to get JSON
getDatabaseAsJson().then(jsonData => {
    console.log("Database JSON:", JSON.stringify(jsonData, null, 4));
});