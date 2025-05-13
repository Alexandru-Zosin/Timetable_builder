const { reverse } = require("dns");
const fs = require("fs");
const { getDatabaseAsJson } = require('../utils/downloadDatabases');

const timeOut = 120000;
let startTime;
let loaded_data;
//const db = await getDatabaseAsJson();
//const loaded_data = JSON.parse(db);

/*
--- can be searched in code with "E1", "R3", ... ---
Restrictions (MANDATORY):
#  R1) Mandatory subjects are assigned to each group.                          ###DONE
#  R2) No overlapping classes for the same group at the same time.             ###DONE
#  R3) A teacher does not teach two classes at the same time.                  ###DONE
#  R4) A room must be available to the university at the given time.           ###DONE
#R4.1) A room cannot have two classes at the same time.                        ###DONE
#  R5) A course must be taught in a room that supports courses.                ###DONE
#  R6) A professor cannot exceed max teaching hours.                           ###DONE
#  R7) A course can be taught only by an elligible teacher.                    ###DONE
Extra restrictions (POSSIBLE):                                                 #-----#
#  E1) A professor can have a number of maximum daily teaching hours           ###DONE
#  E2) A professor can have unpreferred timeslots                              ###DONE

#  --- Added support for multiple years (1, 2, 3)
#  --- The original single `class_list` is now internally created as three shuffled
#      sub‑lists (year 1 year 2 year 3) and then concatenated
#  --- group_schedule is now filtered by year so identical group codes from
#      different years do not collide.
#  --- All timetable entries now carry a year_code so they can be filtered later when rendering
*/

// lookup dictionaries for entities accessed by codes(group['code'])
// example: groups[301] gives all info about group 301 (name, language, code)
let groups;// = Object.fromEntries(loaded_data.groups.map(group => [group.code, group]));
let rooms;// = Object.fromEntries(loaded_data.rooms.map(room => [room.code, room]));
let teachers;// = Object.fromEntries(loaded_data.teachers.map(teacher => [teacher.code, teacher]));
let subjects; // = Object.fromEntries(loaded_data.subjects.map(subject => [subject.code, subject]));
let time_slots;// = Object.fromEntries(loaded_data.timeslots.map(time => [time.code, time]));
let extra_restrictions;// = loaded_data.extra_restrictions;

// builds the list of classes to schedule (courses & seminars)
// iterates through all subjects and adds one course and one seminar after iterating all corresp. groups
// there needs to be a difference between mandatory and optional subjects
// a class is (GROUP_code + SUBJECT_code + class_TYPE(course/seminar))
// group_code == 0 means EVERYONE

let shuffle = true;
let class_list = [];
let best_timetable = null;
let current_timetable = {};  // current_timetable[teacher_code][time_code] = (group_code, room_code, subject_code, class_type, year_code)
let teacher_schedule = {};  // which timeslots are occupied by each teacher
/*
   group_schedule is now two‑level: group_schedule[year][group_code] = Set(times)
   This completely decouples identical group codes across different academic years.
*/
let group_schedule = {};
let room_schedule = {};  // which time slots are occupied by each room
let daily_teacher_hours = {};  // daily hours for each teacher per day

function initializeData(old_class_list) {
    groups = Object.fromEntries(loaded_data.groups.map(group => [group.code, group]));
    rooms = Object.fromEntries(loaded_data.rooms.map(room => [room.code, room]));
    teachers = Object.fromEntries(loaded_data.teachers.map(teacher => [teacher.code, teacher]));
    subjects = Object.fromEntries(loaded_data.subjects.map(subject => [subject.code, subject]));
    time_slots = Object.fromEntries(loaded_data.timeslots.map(time => [time.code, time]));
    extra_restrictions = loaded_data.extra_restrictions;

    shuffle = true;
    class_list = [];
    if (old_class_list != null) {
        class_list = old_class_list;
        shuffle = false;
    }

    if (shuffle) {
        const listsByYear = { 1: [], 2: [], 3: [] };

        for (const subject of loaded_data.subjects) {
            const yr = subject.year || 1; // default fallback just in case
            const pushTarget = listsByYear[yr];
            if (!pushTarget) continue; // ignore unexpected years silently

            if (subject.is_optional === 0) {  // mandatory subject
                for (const group of loaded_data.groups) {
                    const group_name = group.name;
                    if (group_name.length === 1) {  // course group(all subgroups altogether)
                        if (!subject.name.includes('ngl')) // FIX, english has NO courses
                            pushTarget.push({
                                type: 'course',
                                subject_code: subject.code,
                                group_code: group.code,
                                year_code: yr
                            });
                    } else if (group.code !== 0) {  // seminar group (each individual group) --- avoids EVERYONE
                        pushTarget.push({
                            type: 'seminar',
                            subject_code: subject.code,
                            group_code: group.code,
                            year_code: yr
                        });
                    }
                }
            } else {  // optional subject
                const main_groups = loaded_data.groups.filter(group => group.name.length === 1);
                pushTarget.push({
                    type: 'course',
                    subject_code: subject.code,
                    group_code: 0, // course is for EVERYONE at the same time
                    year_code: yr
                });
                for (const group of main_groups) { // seminar is for all respective(A or B or ...) subgroups altogether
                    pushTarget.push({
                        type: 'seminar',
                        subject_code: subject.code,
                        group_code: group.code,
                        year_code: yr
                    });
                }
            }
        }

        function shuffle(array) {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
            return array;
        }
        
        class_list = [].concat(
            ...listsByYear[3],
            ...listsByYear[1],
            ...listsByYear[2]
        );
        shuffle(class_list);
    }

    best_timetable = null;
    current_timetable = {};  // current_timetable[teacher_code][time_code] = (group_code, room_code, subject_code, class_type, year_code)
    teacher_schedule = {};  // which timeslots are occupied by each teacher

    group_schedule = { 1: {}, 2: {}, 3: {} };
    for (const year of [1, 2, 3]) {
        for (const group of Object.values(groups)) {
            group_schedule[year][group.code] = new Set();
        }
    }

    room_schedule = {};  // which time slots are occupied by each room
    daily_teacher_hours = {};  // daily hours for each teacher per day
}

function add_to_timetable(teacher_code, time_code, group_code, room_code, subject_code, class_type, year_code) {
    /*
     * attempts to add a class (group_code, room_code, subject_code, class_type, year_code)
     * to current_timetable[teacher_code][time_code]. 
     * 1) verifies the group is not already in group_schedule at that time
     * 2) verifies the room is free at the given timeslot
     * 3) increments teacher_schedule[teacher_code]
     */

    // initialize teacher in timetable if needed
    if (!(teacher_code in current_timetable))
        current_timetable[teacher_code] = {};

    // convenience accessor for this year
    const yearGroups = group_schedule[year_code];

    // if it's a main group (A, B, C...), ensure no sub-group conflicts
    if (groups[group_code].name.length === 1) {
        for (const group of Object.values(groups)) {
            if (String(group.code).startsWith(String(group_code)) && String(group.code) !== String(group_code)) {
                if (yearGroups[group.code].has(time_code))
                    return false; // if subgroup(B1) already has something in schedule, return False for B
            }
        } // if (someone from) EVERYONE is already busy
        if (yearGroups[0] && yearGroups[0].has(time_code))
            return false;
    }

    if (group_code === 0) { // EVERYONE
        for (const group of Object.values(groups).filter(group => group.name.length === 1)) {
            //if (group.code === 0) 
            //   continue; // we don't compare it against itself
            if (yearGroups[group.code].has(time_code))
                return false; // if MAIN GROUPS are busy, we can't schedule an EVERYONE course/seminar
        }
    }

    // to add a seminary for a sub-group, its main group must be available at that timeslot 
    const main_groups_codes = Object.values(groups).filter(g => String(g.code).length === 1).map(g => g.code);
    if (groups[group_code].name.length > 1) { // we try to add a subgroup class
        for (const main_group_code of main_groups_codes) {
            if (String(group_code).startsWith(String(main_group_code))) { // || main_group_code === 0) {
                if (yearGroups[main_group_code].has(time_code))
                    return false; // if main group is busy, we can't have a seminar for its subgroup
            }   // ...however, if there is an optional at that time, it's fine
        }
    }

    // checks room schedule (R4.1)
    if (!(room_code in room_schedule))
        room_schedule[room_code] = new Set();

    if (room_schedule[room_code].has(time_code))
        return false;

    // handling extra restrictions (E1, E2)
    const day = time_slots[time_code].day;
    if (!(teacher_code in daily_teacher_hours))
        daily_teacher_hours[teacher_code] = {};
    if (!(day in daily_teacher_hours[teacher_code]))
        daily_teacher_hours[teacher_code][day] = 0;

    // max_daily_hours becomes TOTAL max_hours if no daily is specified in extra_restrictions
    const max_daily_hours = extra_restrictions.max_daily_hours?.[String(teacher_code)] ?? teachers[teacher_code].max_hours;
    if (daily_teacher_hours[teacher_code][day] + 1 > max_daily_hours)  // E1
        return false;

    const unpreferred_slots = extra_restrictions.unpreferred_timeslots?.[String(teacher_code)] ?? [];
    if (unpreferred_slots.includes(time_code))  // E2
        return false;

    // assigns class to timetable
    current_timetable[teacher_code][time_code] = [group_code, room_code, subject_code, class_type, year_code];
    teacher_schedule[teacher_code] += 1;
    yearGroups[group_code].add(time_code);
    room_schedule[room_code].add(time_code);
    daily_teacher_hours[teacher_code][day] += 1;
    return true;
}

function generate(class_index, constr_teacher, first_pass) {
    /**
     * We TRY to assign each class(group, subject, type, year) to a
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
    const year_code = cls.year_code;

    // Get max daily hours from extra_restrictions (fallback to teacher's max hours)
    const max_daily_hours = {};
    for (const teacher_code in teachers)
        max_daily_hours[teacher_code] = extra_restrictions.max_daily_hours?.[teacher_code] ?? teachers[teacher_code].max_hours;

    const possible_teachers = Object.entries(teachers)
        .filter(([code, teacher]) => teacher.subjects_taught.includes(subject_code))
        .map(([code]) => code);
    // sort teachers with LCV heuristic
    possible_teachers.sort((a, b) => {
        const ta = teachers[a], tb = teachers[b];
        return (
            (ta.can_teach_course === tb.can_teach_course ? 0 : ta.can_teach_course ? 1 : -1) ||
            (a === constr_teacher ? -1 : b === constr_teacher ? -1 : 0) ||
            (ta.subjects_taught.length - tb.subjects_taught.length) ||
            (max_daily_hours[b] - max_daily_hours[a]) ||
            ((tb.max_hours - (teacher_schedule[b] ?? 0)) - (ta.max_hours - (teacher_schedule[a] ?? 0)))
        );
    });

    // WE TRY to assign each TEACHER in turn
    for (const teacher_code of possible_teachers) {
        if (Date.now() - startTime > timeOut)
            return 0;

        // if it's a course, we need to check if teacher is elligible (R7)
        if (class_type === 'course' && !teachers[teacher_code].can_teach_course)
            continue;

        // we initialize teacher_schedule if it's not present
        if (!(teacher_code in teacher_schedule))
            teacher_schedule[teacher_code] = 0;

        // check that teacher is below his maximum weekly hours (R6)
        if (teacher_schedule[teacher_code] >= teachers[teacher_code].max_hours)
            continue;

        // WE TRY each possible TIMESLOT
        for (const time of loaded_data.timeslots) {
            const time_code = time.code;

            // if the group is already busy, skip (R2)
            if (group_schedule[year_code][group_code]?.has(time_code))
                continue;

            // if the teacher is already busy, skip (R3)
            if (time_code in (current_timetable[teacher_code] ?? {}))
                continue;

            // WE TRY each possible ROOM
            for (const room of loaded_data.rooms) {
                const room_code = room.code;
                const is_course = (class_type === 'course');

                // if the room doesn't allow courses, skip (R5)
                if (is_course && !room.course_possible)
                    continue;

                // if the room is not available at this timeslot, skip (R4)
                if (!room.possible_times.includes(time_code))
                    continue;

                // attempt to assign
                if (add_to_timetable(teacher_code, time_code, group_code, room_code, subject_code, class_type, year_code))
                    return generate(class_index + 1, constr_teacher, first_pass);
            }
        }
    }
    // swaps class_list items that can't be assigned (too constrained)
    // with the first ones so they have a larger space to choose from
    if (first_pass) {
        function swap_class_list(prev_index, curr_index) {
            let temp = class_list[prev_index];
            class_list[prev_index] = class_list[curr_index];
            class_list[curr_index] = temp;
        }

        currentSubjectCode = class_list[class_index].subject_code;
        for (let prev_index = class_index - 1; prev_index >= 0; --prev_index) {
            swap_class_list(prev_index, class_index);
            initializeData(class_list);
            if (generate(0, constr_teacher, false) == 1)
                return 1;
            swap_class_list(prev_index, class_index);
        }
        return 0;
    } else {
        return 0;
    }
} // end generate

async function generateTimetableAndClasslist(new_extra_restrictions, teacher_id, oldTimetable) {
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

    startTime = Date.now();
    return generate(0, teacher_id, true) ? ({
        data: best_timetable,
        class_list: class_list,
        extra_restrictions: extra_restrictions
    }) : null;
}

module.exports = { generateTimetableAndClasslist };