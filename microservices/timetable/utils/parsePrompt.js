const { OpenAI } = require("openai");
const { getDatabaseAsJson } = require('./downloadDatabases');
require("dotenv").config();

function mergeRestrictions(existing, newRestrictions) {
    const merged = existing;

    function mergeUnpreferredTimeslots(oldValue, newValue) {
        // single values get transformed into an array
        const oldValues = Array.isArray(oldValue) ? oldValue : [oldValue];
        const newValues = Array.isArray(newValue) ? newValue : [newValue];
        return Array.from(new Set([...oldValues, ...newValues]));
    }
    
    function mergeTeacherRestriction(key, merged, newRestrictions, subkey) {
        const newVal = newRestrictions[key][subkey];
        const oldVal = merged[key][subkey];
    
        if (key === "unpreferred_timeslots") {
            merged[key][subkey] = mergeUnpreferredTimeslots(oldVal, newVal);
        } else if (key === "max_daily_hours" && newVal !== null) {
            merged[key][subkey] = newVal;
        }
    }
    
    function handleObjectRestriction(key, merged, newRestrictions) {
        for (const subkey in newRestrictions[key]) { // each teacherCode in newRestrictions
            if (merged[key].hasOwnProperty(subkey)) { // if teacher was present
                mergeTeacherRestriction(key, merged, newRestrictions, subkey);
            } else { // otherwise, we 'inherit' it
                merged[key][subkey] = newRestrictions[key][subkey];
            }
        }
    }
    
    for (const key in newRestrictions) { // unpreferred_timeslots and max_daily_hours 
        const newVal = newRestrictions[key];
        const hasKey = merged.hasOwnProperty(key); //(1)if oldRstr has unpref_tms/max_daily_hours

        if (hasKey && typeof merged[key] === "object" && !Array.isArray(merged[key])) {
            handleObjectRestriction(key, merged, newRestrictions);
        } else { // (1) if it doesn't, we assign it to it
            merged[key] = newVal;
        }
    }

    return merged;
}

async function parsePrompt(constraint, teacher_id, extraRestrictions) {
    const openai = new OpenAI({
        apiKey: process.env.GPT_KEY,
    });

    let db = await getDatabaseAsJson();
    db = JSON.parse(db);
    const teachers = db.teachers;
    const timeslots = db.timeslots;
    const subjects = db.subjects;
    extraRestrictions = (extraRestrictions === null) ? {
        unpreferred_timeslots: {},
        max_daily_hours: {}
    } : extraRestrictions;

    if (!teachers.some(t => t.code === teacher_id))
        return extraRestrictions; // we don't allow adding constraints to other teachers than himself
        
    const prompt = `
    Return only valid JSON. Do not include explanations or text before or after the JSON.

    You are a helpful assistant that based on a user input has to generate a JSON file matching the requirements.
    I run a timetable generative app and you are tasked with understanding what extra restrictions are described 
    by the user input and generating a JSON to match that.
    DO NOT remove or overwrite existing restrictions unless explicitly told to. Always merge new restrictions with old ones.

    You have to select from two kinds of restrictions, but the number of restrictions generated is not limited.
    The types of restrictions are:
    1. Unpreferred time slots: this maps the professor code id's to the timeslots ids that are not to be used for that professor 
    2. Max daily hours: this maps a professor id to the maximum number of daily hours 

    Here is an example: (i.e. teacher with id=2 doesn't want to teach during timeslot id=1 or id=12)
    {
        "unpreferred_timeslots": {
            "2": [1, 12], // these are corresponding timeslots for actual real hours (e.g. 1 is Monday, 08:00)
            "3": [1, 2]
        },
        "max_daily_hours": {
            "2": 2, // teacher with id=2 doesnt want to teach more than 2 courses/hours
            "3": 3
        }
    }

    Here is all the data for you to be able to understand the context: the professors, the time slots and the subjects for the professors
    Professors data:
    ${JSON.stringify(teachers)}

    Time slots data: 
    ${JSON.stringify(timeslots)}

    Subjects data: 
    ${JSON.stringify(subjects)}

    Here are the current ad hoc restrictions that are in place for you to have a starting point for the changes that you have to do (if empty, just add accordingly):
    ${JSON.stringify(extraRestrictions)}
    
    Here is the teacher's id (the one who is making the request: You can ONLY add a restriction for this ID, if the prompt is not about the teacher himself (as in written first-person, you do not add anything, just return the restrictions as before))
    ${teacher_id}

    Your task is to modify the given ad hoc restrictions (do not erase existing ones!) in order to get a result wanted by the user.
    Return in JSON format only and without any additional comments.
    Remember that when someone says that he doesn't want to have hours scheduled from 08, for example,
    it means he doesn't want to teach only the first timeslot beginning at 08 (it doesn't include the 10 timeslot, nor does it mean from 08 until the end of the day).
    When he means a whole day, he will say: "No hours monday at all". 
    Also, if he says he doesn't want hours scheduled from "02" or "two", it means 14:00 (02 PM) - try to map meanings reasonably well for 08-18:00 interval.
    Here is what the user wants to achieve as a prompt from the user:
    ${constraint}
    `;

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            response_format: {
                type: "json_object"
            },
            messages: [
                { role: "system", content: "You are a helpful assistant that only replies with JSON." },
                { role: "user", content: prompt }
            ]
        });
        const result = JSON.parse(response.choices[0].message.content);
        return mergeRestrictions(extraRestrictions, result);
    } catch (error) {
        console.error("Error fetching from OpenAI:", error);
        return extraRestrictions;
    }
}

module.exports = { parsePrompt };