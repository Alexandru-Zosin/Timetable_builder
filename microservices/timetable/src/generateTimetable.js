const fs = require("fs");
const { getDatabaseAsJson } = require('../utils/downloadDatabases');

let loaded_data;
//const db = await getDatabaseAsJson();
//const loaded_data = JSON.parse(db);

// lookup dictionaries for entities accessed by codes(group['code'])
// example: groups[301] gives all info about group 301 (name, language, code)
let groups;// = Object.fromEntries(loaded_data.groups.map(group => [group.code, group]));
let rooms;// = Object.fromEntries(loaded_data.rooms.map(room => [room.code, room]));
let teachers;// = Object.fromEntries(loaded_data.teachers.map(teacher => [teacher.code, teacher]));
let subjects;// = Object.fromEntries(loaded_data.subjects.map(subject => [subject.code, subject]));
let time_slots;// = Object.fromEntries(loaded_data.timeslots.map(time => [time.code, time]));
let extra_restrictions;// = loaded_data.extra_restrictions;

// builds the list of classes to schedule (courses & seminars)
// iterates through all subjects and adds one course and one seminar after iterating all corresp. groups
// there needs to be a difference between mandatory and optional subjects
// a class is (GROUP_code + SUBJECT_code + class_TYPE(course/seminar))
// group_code == 0 means EVERYONE

let shuffle = true;
let class_list = [];
/*
if ('class_list' in loaded_data) {
    class_list = loaded_data.class_list;
    shuffle = false;
}

if (shuffle) {
    for (const subject of loaded_data.subjects) {
        if (subject.is_optional === 0) {  // mandatory subject
            for (const group of loaded_data.groups) {
                const group_name = group.name;
                if (group_name.length === 1) {  // course group(all subgroups altogether)
                    class_list.push({
                        type: 'course',
                        subject_code: subject.code,
                        group_code: group.code
                    });
                } else if (group.code !== 0) {  // seminar group (each individual group) --- avoids EVERYONE
                    class_list.push({
                        type: 'seminar',
                        subject_code: subject.code,
                        group_code: group.code
                    });
                }
            }
        } else {  // optional subject
            const main_groups = loaded_data.groups.filter(group => group.name.length === 1);
            class_list.push({
                type: 'course',
                subject_code: subject.code,
                group_code: 0 // course is for EVERYONE at the same time
            });
            for (const group of main_groups) { // seminar is for all respective(A or B or ...) subgroups altogether
                class_list.push({
                    type: 'seminar',
                    subject_code: subject.code,
                    group_code: group.code
                });
            }
        }
    }

    class_list.sort(() => Math.random() - 0.5);

    //for (let i = class_list.length - 1; i > 0; i--) {
     //   const j = Math.floor(Math.random() * (i + 1));
      //  [class_list[i], class_list[j]] = [class_list[j], class_list[i]];
    //}
}
*/

let best_timetable = null;
let current_timetable = {};  // current_timetable[teacher_code][time_code] = (group_code, room_code, subject_code, class_type)
let teacher_schedule = {};  // which timeslots are occupied by each teacher
let group_schedule = {};  // which timeslots are occupied by each group -> detect overlapping classes
//for (const group of Object.values(groups)) {
//    group_schedule[group.code] = new Set();
//}
//if group['code'] not in group_schedule:
//DELETE    group_schedule[group['code']] = set()
let room_schedule = {};  // which time slots are occupied by each room
let daily_teacher_hours = {};  // daily hours for each teacher per day


function initializeData(old_class_list) {
    groups = Object.fromEntries(loaded_data.groups.map(group => [group.code, group]));
    rooms = Object.fromEntries(loaded_data.rooms.map(room => [room.code, room]));
    teachers = Object.fromEntries(loaded_data.teachers.map(teacher => [teacher.code, teacher]));
    subjects = Object.fromEntries(loaded_data.subjects.map(subject => [subject.code, subject]));
    time_slots = Object.fromEntries(loaded_data.timeslots.map(time => [time.code, time]));
    extra_restrictions = loaded_data.extra_restrictions;

    // builds the list of classes to schedule (courses & seminars)
    // iterates through all subjects and adds one course and one seminar after iterating all corresp. groups
    // there needs to be a difference between mandatory and optional subjects
    // a class is (GROUP_code + SUBJECT_code + class_TYPE(course/seminar))
    // group_code == 0 means EVERYONE

    shuffle = true;
    class_list = [];
    if (old_class_list != null) {
        class_list = old_class_list;
        shuffle = false;
    }

    if (shuffle) {
        for (const subject of loaded_data.subjects) {
            if (subject.is_optional === 0) {  // mandatory subject
                for (const group of loaded_data.groups) {
                    const group_name = group.name;
                    if (group_name.length === 1) {  // course group(all subgroups altogether)
                        class_list.push({
                            type: 'course',
                            subject_code: subject.code,
                            group_code: group.code
                        });
                    } else if (group.code !== 0) {  // seminar group (each individual group) --- avoids EVERYONE
                        class_list.push({
                            type: 'seminar',
                            subject_code: subject.code,
                            group_code: group.code
                        });
                    }
                }
            } else {  // optional subject
                const main_groups = loaded_data.groups.filter(group => group.name.length === 1);
                class_list.push({
                    type: 'course',
                    subject_code: subject.code,
                    group_code: 0 // course is for EVERYONE at the same time
                });
                for (const group of main_groups) { // seminar is for all respective(A or B or ...) subgroups altogether
                    class_list.push({
                        type: 'seminar',
                        subject_code: subject.code,
                        group_code: group.code
                    });
                }
            }
        }

        class_list.sort(() => Math.random() - 0.5);

        //for (let i = class_list.length - 1; i > 0; i--) {
        //   const j = Math.floor(Math.random() * (i + 1));
        //  [class_list[i], class_list[j]] = [class_list[j], class_list[i]];
        //}
    }

    best_timetable = null;
    current_timetable = {};  // current_timetable[teacher_code][time_code] = (group_code, room_code, subject_code, class_type)
    teacher_schedule = {};  // which timeslots are occupied by each teacher
    group_schedule = {};  // which timeslots are occupied by each group -> detect overlapping classes
    for (const group of Object.values(groups)) {
        group_schedule[group.code] = new Set();
    }
    //if group['code'] not in group_schedule:
    //DELETE    group_schedule[group['code']] = set()
    room_schedule = {};  // which time slots are occupied by each room
    daily_teacher_hours = {};  // daily hours for each teacher per day
}


function add_to_timetable(teacher_code, time_code, group_code, room_code, subject_code, class_type) {
    /**
     * Attempts to add a class (group_code, room_code, subject_code, class_type)
     * to current_timetable[teacher_code][time_code]. 
     * True if successful
     * 1) verifies the group is not already in group_schedule at that time
     * 2) verifies the room is free at the given timeslot
     * 3) increments teacher_schedule[teacher_code]
     */

    // initialize teacher in timetable if needed
    if (!(teacher_code in current_timetable)) {
        current_timetable[teacher_code] = {};
    }

    // if it's a main group (A, B, C...), ensure no sub-group conflicts
    if (groups[group_code].name.length === 1) {
        for (const group of Object.values(groups)) {
            if (String(group.code).startsWith(String(group_code)) && String(group.code) !== String(group_code)) {
                if (group_schedule[group.code].has(time_code)) {
                    return false; // if subgroup(B1) already has something in schedule, return False for B
                }
            }
        }
        if (group_schedule[0] && group_schedule[0].has(time_code)) { // if (someone from) EVERYONE is already busy
            return false;
        }
    }

    if (group_code === 0) { // EVERYONE
        for (const group of Object.values(groups)) {
            if (group.code === 0) continue; // we don't compare it against itself
            if (group_schedule[group.code].has(time_code)) {
                return false; // if ANYONE is busy, we can't schedule an EVERYONE course/seminar
            }
        }
    }

    // to add a seminary for a sub-group, its main group must be available at that timeslot 
    const main_groups_codes = Object.values(groups).filter(g => String(g.code).length === 1).map(g => g.code);
    if (groups[group_code].name.length > 1) { // we try to add a subgroup class
        for (const main_group_code of main_groups_codes) {
            if (String(group_code).startsWith(String(main_group_code)) || main_group_code === 0) {
                if (group_schedule[main_group_code].has(time_code)) {
                    return false; // if main group is busy, we can't have a seminar for its subgroup
                }
            }
        }
    }

    // checks room schedule (R4.1)
    if (!(room_code in room_schedule)) {
        room_schedule[room_code] = new Set();
    }
    if (room_schedule[room_code].has(time_code)) {
        return false;
    }

    // handling extra restrictions (E1, E2)
    const day = time_slots[time_code].day;
    if (!(teacher_code in daily_teacher_hours)) daily_teacher_hours[teacher_code] = {};
    if (!(day in daily_teacher_hours[teacher_code])) daily_teacher_hours[teacher_code][day] = 0;

    // max_daily_hours becomes TOTAL max_hours if no daily is specified in extra_restrictions
    const max_daily_hours = extra_restrictions.max_daily_hours?.[String(teacher_code)] ?? teachers[teacher_code].max_hours;
    if (daily_teacher_hours[teacher_code][day] + 1 > max_daily_hours) {  // E1
        return false;
    }

    const unpreferred_slots = extra_restrictions.unpreferred_timeslots?.[String(teacher_code)] ?? [];
    if (unpreferred_slots.includes(time_code)) {  // E2
        return false;
    }

    // assigns class to timetable
    current_timetable[teacher_code][time_code] = [group_code, room_code, subject_code, class_type];
    teacher_schedule[teacher_code] += 1;
    group_schedule[group_code].add(time_code);
    room_schedule[room_code].add(time_code);
    daily_teacher_hours[teacher_code][day] += 1;
    return true;
}

function remove_from_timetable(teacher_code, time_code) {
    /**
     * Removes an assignment from the timetable and updates schedule structures
     * accordingly.
     */
    if (teacher_code in current_timetable && time_code in current_timetable[teacher_code]) {
        const [group_code, room_code, , ] = current_timetable[teacher_code][time_code];
        const day = time_slots[time_code].day;
        delete current_timetable[teacher_code][time_code];
        teacher_schedule[teacher_code] -= 1;
        group_schedule[group_code].delete(time_code);
        room_schedule[room_code].delete(time_code);
        daily_teacher_hours[teacher_code][day] -= 1;
    }
}

function generate(class_index) {
    /**
     * We TRY to assign each class(group, subject, type) to a
     * (TEACHER, TIMESLOT, ROOM) ensuring no overlapping constraints
     */

    // base case: if we've processed all classes, success (R1)
    if (class_index === class_list.length) {
        best_timetable = JSON.parse(JSON.stringify(current_timetable));
        return 1;
    }

    const cls = class_list[class_index];
    const subject_code = cls.subject_code;
    const group_code = cls.group_code;
    const class_type = cls.type;

    // Get max daily hours from extra_restrictions (fallback to teacher's max hours)
    const max_daily_hours = {};
    for (const teacher_code in teachers) {
        max_daily_hours[teacher_code] = extra_restrictions.max_daily_hours?.[teacher_code] ?? teachers[teacher_code].max_hours;
    }

    const possible_teachers = Object.entries(teachers)
        .filter(([code, teacher]) => teacher.subjects_taught.includes(subject_code))
        .map(([code]) => code);

    // sort teachers with LCV heuristic
    possible_teachers.sort((a, b) => {
        const ta = teachers[a], tb = teachers[b];
        return (
            (ta.can_teach_course === tb.can_teach_course ? 0 : ta.can_teach_course ? 1 : -1) ||
            (ta.subjects_taught.length - tb.subjects_taught.length) ||
            (max_daily_hours[b] - max_daily_hours[a]) ||
            ((tb.max_hours - (teacher_schedule[b] ?? 0)) - (ta.max_hours - (teacher_schedule[a] ?? 0)))
        );
    });

    // WE TRY to assign each TEACHER in turn
    for (const teacher_code of possible_teachers) {
        // if it's a course, we need to check if teacher is elligible (R8)
        if (class_type === 'course' && !teachers[teacher_code].can_teach_course) {
            continue;
        }

        // we initialize teacher_schedule if it's not present
        if (!(teacher_code in teacher_schedule)) {
            teacher_schedule[teacher_code] = 0;
        }

        // check that teacher is below his maximum weekly hours (R6)
        if (teacher_schedule[teacher_code] >= teachers[teacher_code].max_hours) {
            continue;
        }

        // WE TRY each possible TIMESLOT
        for (const time of loaded_data.timeslots) {
            const time_code = time.code;

            // if the group is already busy, skip (R2)
            if (group_schedule[group_code]?.has(time_code)) {
                continue;
            }

            // if the teacher is already busy, skip (R3)
            if (time_code in (current_timetable[teacher_code] ?? {})) {
                continue;
            }

            // WE TRY each possible ROOM
            for (const room of loaded_data.rooms) {
                const room_code = room.code;
                const is_course = (class_type === 'course');

                // if the room doesn't allow courses, skip (R5)
                if (is_course && !room.course_possible) {
                    continue;
                }

                // if the room is not available at this timeslot, skip (R4)
                if (!room.possible_times.includes(time_code)) {
                    continue;
                }

                // attempt to assign
                if (add_to_timetable(teacher_code, time_code, group_code, room_code, subject_code, class_type)) {
                    const return_value = generate(class_index + 1);
                    if (return_value === 1) {
                        return 1;
                    }
                    // if not successful, remove assignment
                    remove_from_timetable(teacher_code, time_code);
                }
            }
        }
    }

    return 0;
}

async function generateTimetableAndClasslist(new_extra_restrictions, oldTimetable) {
    const db = await getDatabaseAsJson();
    loaded_data = JSON.parse(db);
    if (new_extra_restrictions != null)
        loaded_data.extra_restrictions = new_extra_restrictions
    else
        loaded_data.extra_restrictions = {
            unpreferred_timeslots: {},
            max_daily_hours: {}
        }    

    if (oldTimetable != null)
        initializeData(oldTimetable.class_list)
    else
        initializeData(null);   

    generate(0);
    return ({
        data: best_timetable,
        class_list: class_list,
        extra_restrictions: extra_restrictions
    });
}

module.exports = { generateTimetableAndClasslist };