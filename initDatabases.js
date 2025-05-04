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

        let statement = `DROP DATABASE IF EXISTS uaicusers`;
        await queryDatabase(connection, statement);
        console.log("uaicusers database dropped.");
        statement = `CREATE DATABASE uaicusers`;
        await queryDatabase(connection, statement);
        console.log("uaicusers database created.");

        statement = `DROP DATABASE IF EXISTS uaic`;
        await queryDatabase(connection, statement);
        console.log("uaic database dropped.");
        statement = `CREATE DATABASE uaic`;
        await queryDatabase(connection, statement);
        console.log("uaic database created.");
        
        statement = `DROP DATABASE IF EXISTS uaictimetables`;
        await queryDatabase(connection, statement);
        console.log("uaictimetables dropped.");
        statement = `CREATE DATABASE uaictimetables`;
        await queryDatabase(connection, statement);
        console.log("uaictimetables created.");

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
            tag VARCHAR(4) NULL DEFAULT NULL,
            requested BOOLEAN NOT NULL DEFAULT TRUE
        );`; // alter table required if not good: alter table users modify column role ...
        // select role from users where id = 1 =-> student
        // fixed data size is better/faster for lookups 
        await queryDatabase(usersConnection, statement);
        console.log("users table has been created in uaicusersDB.")

        // const insAdmStatement = `INSERT INTO users (email, password, role, requested) VALUES(
        //     'admin@uaic.info.ro',
        //     '771dccfd999072a8fdbe127be9154f0bb1522fc047cd61aa4c10348190cd947e',
        //     'admin',
        //     FALSE)`;

        // // insert request table and timetable required stuff
        // await queryDatabase(usersConnection, insAdmStatement);

        

        // console.log("Admin was successfully inserted.");
        await closeConnection(usersConnection);
        console.log("uaicusers connection was successfully ended.");
        
        // connect to uaic database
        connectionConfig.database = "uaic";
        const uaicConnection = await connectToDatabase(connectionConfig);

        await queryDatabase(uaicConnection, `
            CREATE TABLE timeslots (
                id INT PRIMARY KEY AUTO_INCREMENT,
                day ENUM('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday') NOT NULL,
                hour TIME NOT NULL
            );
        `);
        console.log("timeslots table created.");
        
        await queryDatabase(uaicConnection, `
            CREATE TABLE teachers (
                id INT PRIMARY KEY AUTO_INCREMENT,
                name VARCHAR(255) NOT NULL,
                max_hours INT NOT NULL,
                can_teach_course BOOLEAN NOT NULL
            );
        `);
        console.log("teachers table created.");

        await queryDatabase(uaicConnection, `
            CREATE TABLE subjects (
                id INT PRIMARY KEY AUTO_INCREMENT,
                name VARCHAR(255) NOT NULL,
                is_optional BOOLEAN NOT NULL
            );
        `);
        console.log("subjects table created.");

        await queryDatabase(uaicConnection, `
            CREATE TABLE teacher_subjects (
                teacher_id INT,
                subject_id INT,
                PRIMARY KEY (teacher_id, subject_id),
                FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
                FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
            );
        `);
        console.log("teacher_subjects table created.");

        await queryDatabase(uaicConnection, `
            CREATE TABLE rooms (
                id INT PRIMARY KEY AUTO_INCREMENT,
                name VARCHAR(255) NOT NULL,
                course_possible BOOLEAN NOT NULL
            );
        `);
        console.log("rooms table created.");

        await queryDatabase(uaicConnection, `
            CREATE TABLE room_times (
                room_id INT,
                timeslot_id INT,
                PRIMARY KEY (room_id, timeslot_id),
                FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
                FOREIGN KEY (timeslot_id) REFERENCES timeslots(id) ON DELETE CASCADE
            );
        `);
        console.log("room_times table created.");

        await queryDatabase(uaicConnection, `
            CREATE TABLE groups (
                id INT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                language VARCHAR(50) NOT NULL
            );
        `);
        console.log("groups table created.");

        // await queryDatabase(uaicConnection, `
        //     CREATE TABLE extra_restrictions (
        //         id INT PRIMARY KEY AUTO_INCREMENT,
        //         teacher_id INT NOT NULL,
        //         restriction_type ENUM('unpreferred_timeslots', 'max_daily_hours') NOT NULL,
        //         timeslot_id INT NULL,
        //         value INT NULL,
        //         FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
        //         FOREIGN KEY (timeslot_id) REFERENCES timeslots(id) ON DELETE CASCADE
        //     );
        // `);
        // console.log("extra_restrictions table created.");
        await closeConnection(uaicConnection);
        console.log("uaic connection closed.");

        connectionConfig.database = "uaictimetables";
        const timetablesConnection = await connectToDatabase(connectionConfig);

        await queryDatabase(timetablesConnection, 
            `CREATE TABLE timetables (
                id INT PRIMARY KEY AUTO_INCREMENT,
                data json DEFAULT NULL,
                class_list json DEFAULT NULL,
                extra_restrictions json DEFAULT NULL,
                active BOOLEAN DEFAULT FALSE
            );`
        );
        console.log("timetables table created.");

        await queryDatabase(timetablesConnection, 
            `CREATE TABLE requests (
                id INT PRIMARY KEY,
                name VARCHAR(255),
                request VARCHAR(255) NOT NULL
            );`
        );
        console.log("timetables table created.");

        await closeConnection(timetablesConnection);
        console.log("uaictimetables connection closed.")
    } catch (err) {
        console.log(err);
    }
    populateDatabase();
}

async function populateDatabase() {
    try {
        let connectionConfig = {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: "uaic"
        };

        const connection = await connectToDatabase(connectionConfig);
        console.log("Connected to uaic database. Starting data insertion...");

        const timeslots = readJsonFile(path.join("uaic_data","time_slots.json"));
        const teachers = readJsonFile(path.join("uaic_data","teachers.json"));
        const subjects = readJsonFile(path.join("uaic_data","subjects.json"));
        const rooms = readJsonFile(path.join("uaic_data","rooms.json"));
        const groups = readJsonFile(path.join("uaic_data","groups.json"));
        //const extraRestrictions = readJsonFile(path.join("uaic_data","extra_restrictions.json"));

        // insert timeslots
        for (ts of timeslots) {
            await queryDatabase(connection, `
                INSERT INTO timeslots (day, hour) VALUES (?, ?)`,
                [ts.day, ts.hour]
            );
        }
        console.log("Timeslots inserted.");

        // insert teachers
        for (teacher of teachers) {
            await queryDatabase(connection, `
                INSERT INTO teachers (id, name, max_hours, can_teach_course) 
                VALUES (?, ?, ?, ?)`,
                [teacher.code, teacher.name, teacher.max_hours, teacher.can_teach_course]
            );
        }
        console.log("Teachers inserted.");

        // insert subjects
        for (subject of subjects) {
            await queryDatabase(connection, `
                INSERT INTO subjects (id, name, is_optional) 
                VALUES (?, ?, ?)`,
                [subject.code, subject.name, subject.is_optional]
            );
        }
        console.log("Subjects inserted.");

        // insert teacher-subject relationships
        for (teacher of teachers) {
            for (subjectId of teacher.subjects_taught) {
                await queryDatabase(connection, `
                    INSERT INTO teacher_subjects (teacher_id, subject_id) 
                    VALUES (?, ?)`,
                    [teacher.code, subjectId]
                );
            }
        }
        console.log("Teacher-subject relationships inserted.");

        // insert rooms
        for (room of rooms) {
            await queryDatabase(connection, `
                INSERT INTO rooms (id, name, course_possible) 
                VALUES (?, ?, ?)`,
                [room.code, room.name, room.course_possible]
            );

            // insert room-timeslot availability
            for (timeId of room.possible_times) {
                await queryDatabase(connection, `
                    INSERT INTO room_times (room_id, timeslot_id) 
                    VALUES (?, ?)`,
                    [room.code, timeId]
                );
            }
        }
        console.log("Rooms and room-timeslot mappings inserted.");

        for (group of groups) {
            await queryDatabase(connection, `
                INSERT INTO groups (id, name, language) 
                VALUES (?, ?, ?)`,
                [group.code, group.name, group.language]
            );
        }
        console.log("Groups inserted.");

        await closeConnection(connection);
        connectionConfig.database = "uaicusers";
        const usersConnection = await connectToDatabase(connectionConfig);

        const insAdmStatement = `INSERT INTO users (email, password, role, requested) VALUES(
            'admin@uaic.info.ro',
            '771dccfd999072a8fdbe127be9154f0bb1522fc047cd61aa4c10348190cd947e',
            'admin',
            FALSE)`;
        await queryDatabase(usersConnection, insAdmStatement);
        console.log("Admin was successfully inserted.");
        
        const numOfTeachers = Object.keys(teachers).length;
        for (var id = 1; id <= numOfTeachers; id++) {
            const insTeacherStatement = `INSERT INTO users (email, password, role, tag, requested) VALUES(
                'teacher${id}@uaic.info.ro',
                '771dccfd999072a8fdbe127be9154f0bb1522fc047cd61aa4c10348190cd947e',
                'teacher',
                '${id}',
                FALSE)`;
            await queryDatabase(usersConnection, insTeacherStatement);
        }
        console.log("Teachers were successfully inserted.");

        await closeConnection(usersConnection);
        console.log("uaicusers connection was successfully ended.");
        
        // insert extra restrictions
        // for ([teacherId, restrictions] of Object.entries(extraRestrictions.unpreferred_timeslots)) {
        //     for (timeslotId of restrictions) {
        //         await queryDatabase(connection, `
        //             INSERT INTO extra_restrictions (teacher_id, restriction_type, timeslot_id) 
        //             VALUES (?, 'unpreferred_timeslots', ?)`,
        //             [teacherId, timeslotId]
        //         );
        //     }
        // }

        // for ([teacherId, maxHours] of Object.entries(extraRestrictions.max_daily_hours)) {
        //     await queryDatabase(connection, `
        //         INSERT INTO extra_restrictions (teacher_id, restriction_type, value) 
        //         VALUES (?, 'max_daily_hours', ?)`,
        //         [teacherId, maxHours]
        //     );
        // }
        // console.log("Extra restrictions inserted.");

        //await closeConnection(connection);
        console.log("Database population complete. Connection closed.");
    } catch (err) {
        console.error("Error inserting data:", err);
    }
}

initializeDatabases();