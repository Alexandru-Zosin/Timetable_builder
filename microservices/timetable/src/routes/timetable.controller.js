const { getTimetable, uploadTimetable } = require('../models/timetable.model');
const { generateTimetableAndClasslist } = require('../generateTimetable');
const { parsePrompt } = require('../../utils/parsePrompt');
const { getDatabaseAsJson } = require('../../utils/downloadDatabases');

async function getCurrentTimetable(req, res) {
    const timetable = await getTimetable();

    if (!timetable) {
        res.writeHead(404, {
            'Content-Type': 'application/json'
        });
        return res.end(JSON.stringify({
            error: "Not found"
        }));
    } else {
        res.writeHead(200, {
            'Content-Type': 'application/json'
        });
        const info = await getDatabaseAsJson();
        timetable.info = JSON.parse(info);
        let replyMessage = {data: timetable.data, info: JSON.parse(info)};
        return res.end(JSON.stringify(replyMessage));
    }
}

async function generateNewTimetable(req, res) {
    let oldTimetable = await getTimetable();
   
    let { prompt, teacher_id } = req.body;
    let new_extra_restrictions, newTimetable;
    if (prompt != '') {
        new_extra_restrictions = await parsePrompt(prompt, teacher_id, oldTimetable?.extra_restrictions ?? null);
        newTimetable = await generateTimetableAndClasslist(new_extra_restrictions, oldTimetable);
    } else {
        newTimetable = await generateTimetableAndClasslist(null, null);
    }

    if (!newTimetable) {
        res.writeHead(404, {
            'Content-Type': 'application/json'
        });
        return res.end(JSON.stringify({
            error: "Not found"
        }));
    } else {
        uploadTimetable(newTimetable);
        res.writeHead(200, {
            'Content-Type': 'application/json'
        });
        return res.end(JSON.stringify(newTimetable));
    }
}

module.exports = { getCurrentTimetable, generateNewTimetable };
