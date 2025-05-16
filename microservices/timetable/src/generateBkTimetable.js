const { getDatabaseAsJson } = require('../utils/downloadDatabases');

/*
Restrictions (HARD):
#  R1) Mandatory subjects are assigned to each group.    
#  R2) A course can be taught only by an elligible teacher.
#  R3) A professor cannot exceed max teaching hours.
#  R4) A teacher does not teach two classes at the same time.                 
#  R5) A room cannot have two classes at the same time.                       
#  R6) A room must be available to the university at the given time.          
#  R6.1) A course must be taught in a room that supports courses.               
#  R7) No overlapping classes for the same group at the same time.            
#  R8) A subgroup cannot have classes when its maingroup(s) have classes (* do we include 0?)              
                   
Extra restrictions (SOFT):                                                
#  E1) A professor can have a number of maximum daily teaching hours          
#  E2) A professor can have unpreferred timeslots                             
*/

/** main aspects
// builds the list of classes to schedule (courses & seminars)
// iterates through all subjects and adds one course and one seminar after iterating all corresp. groups
// there needs to be a difference between mandatory and optional subjects
// a class is (GROUP_code + SUBJECT_code + class_TYPE(course/seminar))
// group_code == 0 means EVERYONE
*/

let class_list = [];
let best_timetable;
let current_timetable;  // current_timetable[teacher_code][time_code] = (group_code, room_code, subj_code, class_type, year_code)
let teacher_hours_count;  // hours count for each teacher
let group_schedule; // group_schedule[year][group_code] = Set of times
let room_schedule;  // which time slots are occupied by each room
let daily_teacher_hours;  // daily hours for each teacher per day
let max_daily_hours; // from extra_restrictions (fallbacks to teacher.max_hours)
let unpreferred_slots; // from extra restrictions (fallbacks to none)
let main_to_subs = {}, sub_to_main = {}; // main_to_subs & sub_to_main maps (shared across years)

let loaded_data;
// lookup dictionaries for entities, e.g.: groups[301] gives all info about group 301 
let groups, rooms, teachers, subjects, timeslots, extra_restrictions;

function initializeData(old_class_list) {
    groups = Object.fromEntries(loaded_data.groups.map(group => [group.code, group]));
    rooms = Object.fromEntries(loaded_data.rooms.map(room => [room.code, room]));
    teachers = Object.fromEntries(loaded_data.teachers.map(teacher => [teacher.code, teacher]));
    subjects = Object.fromEntries(loaded_data.subjects.map(subject => [subject.code, subject]));
    timeslots = Object.fromEntries(loaded_data.timeslots.map(time => [time.code, time]));
    extra_restrictions = loaded_data.extra_restrictions;

    //let shuffle = true;
    if (old_class_list != null) {
        class_list = old_class_list;
        //shuffle = false;
    }
    else {
        const class_list_by_year = { 1: [], 2: [], 3: [] };
        for (const subject of Object.values(subjects)) {
            if (subject.is_optional === 0) {  // MANDATORY
                for (const group of Object.values(groups)) {
                    if (group.name.length === 1) {  // course group (all subgroups altogether)
                        if (!subject.name.includes('ngl')) // English CAN HAVE NO courses
                            class_list_by_year[subject.year].push({
                                class_type: 'course',
                                subject_code: subject.code,
                                group_code: group.code,
                                year_code: subject.year
                            });
                    } else if (group.code !== 0) {  // seminar group (each individual group)
                        class_list_by_year[subject.year].push({
                            class_type: 'seminar',
                            subject_code: subject.code,
                            group_code: group.code,
                            year_code: subject.year
                        });
                    }
                }
            } else {  // OPTIONAL
                class_list_by_year[subject.year].push({
                    class_type: 'course',
                    subject_code: subject.code,
                    group_code: 0,
                    year_code: subject.year
                });
                const main_groups = Object.values(groups).filter(group => group.name.length === 1);
                for (const group of main_groups) { // seminar is for all main groups altogether
                    class_list_by_year[subject.year].push({
                        class_type: 'seminar',
                        subject_code: subject.code,
                        group_code: group.code,
                        year_code: subject.year
                    });
                }
            }
        }

        class_list = [].concat(
            ...class_list_by_year[3],
            ...class_list_by_year[1],
            ...class_list_by_year[2]
        );
        for (let i = class_list.length - 1; i > 0; --i) {
            const j = Math.floor(Math.random() * (i + 1));
            [class_list[i], class_list[j]] = [class_list[j], class_list[i]];
        }  // fisheryates shuffle
    }

    best_timetable = null;
    current_timetable = {};
    room_schedule = {};
    for (const room_code in rooms)
        room_schedule[room_code] = new Set();
    daily_teacher_hours = {};
    max_daily_hours = {};
    teacher_hours_count = {};
    unpreferred_slots = {};
    for (const teacher_code in teachers) {
        current_timetable[teacher_code] = {};
        daily_teacher_hours[teacher_code] = {};
        teacher_hours_count[teacher_code] = 0;
        max_daily_hours[teacher_code] = extra_restrictions.max_daily_hours?.[teacher_code] ??
            teachers[teacher_code].max_hours; // if ^ null
        unpreferred_slots[teacher_code] = extra_restrictions.unpreferred_timeslots?.[teacher_code] ?? [];
    }
    group_schedule = { 1: {}, 2: {}, 3: {} };
    for (const year of [1, 2, 3])
        for (const group of Object.values(groups))
            group_schedule[year][group.code] = new Set();

    for (const main_group of Object.values(groups).filter(g => g.name.length === 1)) // A, B, E init.
        main_to_subs[main_group.code] = [];
    for (const subGroup of Object.values(groups).filter(g => g.name.length > 1 && g.code !== 0)) {
        const main_groupCode = Number((String(subGroup.code))[0]);   // subgroup's first digit
        main_to_subs[main_groupCode].push(subGroup.code);
        sub_to_main[subGroup.code] = main_groupCode;
    }
}

function addToTimetable(assignment_codes) {
    const {
        teacher_code,
        time_code,
        group_code,
        room_code,
        subject_code,
        class_type,
        year_code
    } = assignment_codes;

    // R8) a subgroup cannot have classes when its maingroup(s) have classes (*)              
    // Everyone group
    if (group_code === 0) {
        for (const main_group_code of Object.values(groups)
                                            .filter(g => g.name.length === 1)
                                            .map(g => g.code)) {
            if (group_schedule[year_code][main_group_code].has(time_code))
                return false; // if a main_group is busy, no everyone(optional)'s course/seminar
        }
        for (const sub_group_code of Object.values(groups).filter(g => g.code > 100).map(g => g.code))
            if (group_schedule[year_code][sub_group_code].has(time_code))
                return false; // if a sub_group is busy, no everyone(optional)'s course/seminar
    }
    // Main group
    if (groups[group_code].name.length === 1) {
        if (group_schedule[year_code][0].has(time_code))
            return false; // if everyone's busy, no course

        for (const sub_group_code of main_to_subs[group_code])
            if (group_schedule[year_code][sub_group_code].has(time_code))
                return false; // if it's subgroups are busy, no course
    }
    // Sub group
    if (group_code > 100) {
        if (group_schedule[year_code][0].has(time_code))
            return false; // if everyone's busy, no seminar

        if (group_schedule[year_code][sub_to_main[group_code]].has(time_code))
            return false; // if main_group is busy, no seminar
    }

    const day = timeslots[time_code].day;
    if (!(day in daily_teacher_hours[teacher_code]))
        daily_teacher_hours[teacher_code][day] = 0;
    // E1) a professor can have a number of maximum daily teaching hours
    if (daily_teacher_hours[teacher_code][day] + 1 > max_daily_hours[teacher_code])
        return false;

    // E2) a professor can have unpreferred timeslots
    if (unpreferred_slots[teacher_code].includes(time_code))
        return false;

    // Successful, it now assigns the class to timetable
    current_timetable[teacher_code][time_code] =
        [group_code, room_code, subject_code, class_type, year_code];
    teacher_hours_count[teacher_code] += 1;
    daily_teacher_hours[teacher_code][day] += 1;
    group_schedule[year_code][group_code].add(time_code);
    room_schedule[room_code].add(time_code);
    return true;
}

// tries to assign each class_list item:(group, subject, type, year) to a
// current_timetable: (TEACHER, TIMESLOT, ROOM) ensuring no overlapping constraints
// using addToTimetable helper
function generate(class_index, constr_teacher, first_pass) {
    // base case: if we've processed all classes, success (R1)
    if (class_index === class_list.length) {
        best_timetable = structuredClone(current_timetable);
        return 1;
    }

    const cls = class_list[class_index];
    const subject_code = cls.subject_code;
    const group_code = cls.group_code;
    const class_type = cls.class_type;
    const year_code = cls.year_code;

    // STEP 1: Assigning the teacher
    // gets and sorts possible teachers with LCV heuristic
    const possible_teachers = Object.values(teachers)
        .filter(t => t.subjects_taught.includes(subject_code))
        .map(t => t.code)
        .sort((a, b) => {
            const ta = teachers[a], tb = teachers[b];
            return (
                (ta.can_teach_course === tb.can_teach_course ? 0 : ta.can_teach_course ? 1 : -1) ||
                (a === constr_teacher ? -1 : b === constr_teacher ? -1 : 0) ||
                (ta.subjects_taught.length - tb.subjects_taught.length) ||
                (max_daily_hours[b] - max_daily_hours[a]) ||
                ((tb.max_hours - (teacher_hours_count[b] ?? 0)) - (ta.max_hours - (teacher_hours_count[a] ?? 0)))
            );
        });

    for (const teacher_code of possible_teachers) {
        // if it's a course, we need to check if teacher is elligible (R2)
        if (class_type === 'course' && !teachers[teacher_code].can_teach_course)
            continue;

        // check that teacher is below his maximum weekly hours (R3)
        if (teacher_hours_count[teacher_code] >= teachers[teacher_code].max_hours)
            continue;

        // STEP 2: Assigning the timeslot 
        for (const time of Object.values(timeslots)) {
            const time_code = time.code;

            // if the teacher is already busy, skip (R4)
            if (time_code in (current_timetable[teacher_code] ?? {}))
                continue;

            // if the group is already busy, skip (R7)
            if (group_schedule[year_code][group_code]?.has(time_code))
                continue;

            // STEP 3: Assigning the room
            for (const room of Object.values(rooms)) {
                const room_code = room.code;

                // checks room schedule (R5)
                if (room_schedule[room_code].has(time_code))
                    continue;

                // if the room is not available at this timeslot, skip (R6)
                if (!room.possible_times.includes(time_code))
                    continue;

                // if the room doesn't allow courses, skip (R6.1)
                if (class_type === 'course' && !room.course_possible)
                    continue;

                // Attempt to assign (R8 + E1, E2)
                const assignment_codes = {
                    teacher_code,
                    time_code,
                    group_code,
                    room_code,
                    subject_code,
                    class_type,
                    year_code
                };
                if (addToTimetable(assignment_codes))
                    return generate(class_index + 1, constr_teacher, first_pass);
            }
        }
    }

    // Backjumping: swaps class_list items that can't be assigned (too constrained)
    // with the first ones so they have the largest available domain to choose from
    function swapClassList(prev_index, curr_index) {
        let temp = class_list[prev_index];
        class_list[prev_index] = class_list[curr_index];
        class_list[curr_index] = temp;
    }
    if (first_pass) {
        currentSubjectCode = class_list[class_index].subject_code;
        for (let prev_index = class_index - 1; prev_index >= 0; --prev_index) {
            swapClassList(prev_index, class_index);
            initializeData(class_list);
            if (generate(0, constr_teacher, false) == 1)
                return 1;
            swapClassList(prev_index, class_index);
        }
        return 0;
    } else {
        return 0;
    }
}

async function generateBkTimetableAndClasslist(new_extra_restrictions, teacher_id, oldTimetable) {
    loaded_data = JSON.parse(await getDatabaseAsJson());
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

    return generate(0, teacher_id, true) ? ({
        data: best_timetable,
        class_list: class_list,
        extra_restrictions: extra_restrictions
    }) : null;
}

module.exports = { generateBkTimetableAndClasslist };