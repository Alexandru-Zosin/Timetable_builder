const { getTimetable, uploadTimetable } = require('../models/timetable.model');
const { generateBkTimetableAndClasslist } = require('../generateBkTimetable');
const { generateHcTimetableAndClasslist } = require('../generateHcTimetable');
const { parsePrompt } = require('../../utils/parsePrompt');
const { getDatabaseAsJson } = require('../../utils/downloadDatabases');

async function getCurrentTimetable(req, res) {
    try {
        const timetable = await getTimetable();

        if (!timetable) {
            return res.status(404).json({ error: "Not found" });
        }

        const info = await getDatabaseAsJson();
        const replyMessage = {
            data: timetable.data,
            info: JSON.parse(info)
        };
        return res.status(200).json(replyMessage);
    } catch (err) {
        return res.status(500).json({ error: "Internal server error" });
    }
}

async function generateNewTimetable(req, res) {
    try {
        const oldTimetable = await getTimetable();
        const { prompt, teacher_id, algorithm, timeout } = req.body;

        if (!['bk', 'hc'].includes(algorithm))
            return res.status(404).json({ error: "Not found." });

        let newTimetable;
        if (prompt !== '' && teacher_id != null) {
            const extra = oldTimetable?.extra_restrictions ?? null;
            const new_extra_restrictions = await parsePrompt(prompt, teacher_id, extra);
            newTimetable = (algorithm == 'bk') ? 
            await generateBkTimetableAndClasslist(new_extra_restrictions, teacher_id, oldTimetable) :
            await generateHcTimetableAndClasslist(new_extra_restrictions, oldTimetable, timeout)
        } else {
            newTimetable = (algorithm == 'bk') ? 
            await generateBkTimetableAndClasslist(null, null, null) :
            await generateHcTimetableAndClasslist(null, null, timeout);
        }

        if (!newTimetable) {
            return res.status(404).json({ error: "Not found" });
        }

        await uploadTimetable(newTimetable);
        return res.status(200).json(newTimetable);
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: "Internal server error" });
    }
}

module.exports = { getCurrentTimetable, generateNewTimetable };
