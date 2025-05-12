const { getDatabaseAsJson } = require('../utils/downloadDatabases');

const timeOut = 15000;
let startTime;
let loaded_data;

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
#  R7) No overlapping courses with seminars for a subject at the same time.    ###DONE
#  R8) A course can be taught only by an eligible teacher.                     ###DONE
Extra restrictions (POSSIBLE):
#-----#
#  E1) A professor can have a number of maximum daily teaching hours           ###DONE
#  E2) A professor can have unpreferred timeslots                              ###DONE
*/

// lookup dictionaries for entities accessed by codes (group['code'])
// example: groups[301] gives all info about group 301 (name, language, code)
let groups;
let rooms;
let teachers;
let subjects;
let time_slots;
let extra_restrictions;

let shuffle = true;
let class_list = [];
let best_timetable = null;
let current_timetable = {};  // current_timetable[teacher_code][time_code] = (group_code, room_code, subject_code, class_type)
let teacher_schedule = {};   // total classes assigned to each teacher (for R6)
let group_schedule = {};     // timeslots occupied by each group (to detect overlaps, R2/R7)
let room_schedule = {};      // timeslots occupied by each room (R4.1)
let daily_teacher_hours = {}; // daily hours for each teacher per day (for E1)

function initializeData(old_class_list) {
    groups = Object.fromEntries(loaded_data.groups.map(group => [group.code, group]));
    rooms = Object.fromEntries(loaded_data.rooms.map(room => [room.code, room]));
    teachers = Object.fromEntries(loaded_data.teachers.map(teacher => [teacher.code, teacher]));
    subjects = Object.fromEntries(loaded_data.subjects.map(subject => [subject.code, subject]));
    time_slots = Object.fromEntries(loaded_data.timeslots.map(time => [time.code, time]));
    extra_restrictions = loaded_data.extra_restrictions;

    // builds the list of classes to schedule (courses & seminars)
    // iterates through all subjects and adds one course and one seminar for each group (or subgroup) as needed
    // group_code == 0 means EVERYONE (the whole cohort, used for courses of optional subjects)
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
                    if (group_name.length === 1) {  // course group (all subgroups together)
                        class_list.push({
                            type: 'course',
                            subject_code: subject.code,
                            group_code: group.code
                        });
                    } else if (group.code !== 0) {  // seminar group (each individual subgroup, excluding the "everyone" group)
                        class_list.push({
                            type: 'seminar',
                            subject_code: subject.code,
                            group_code: group.code
                        });
                    }
                }
            } else {  // optional subject
                // For optional subjects, one course for everyone and seminars for each main group (A, B, C, ...)
                const main_groups = loaded_data.groups.filter(group => group.name.length === 1);
                class_list.push({
                    type: 'course',
                    subject_code: subject.code,
                    group_code: 0  // course is for EVERYONE at the same time
                });
                for (const group of main_groups) {
                    class_list.push({
                        type: 'seminar',
                        subject_code: subject.code,
                        group_code: group.code
                    });
                }
            }
        }
        // Randomize class order for initial assignment
        class_list.sort(() => Math.random() - 0.5);
    }
    best_timetable = null;
    current_timetable = {};
    teacher_schedule = {};
    group_schedule = {};
    for (const group of Object.values(groups)) {
        group_schedule[group.code] = new Set();
    }
    room_schedule = {};
    daily_teacher_hours = {};
}

function generateTimetableHillClimbing() {
    /**
     * Generates a timetable using a random-restart hill climbing algorithm.
     * It repeatedly attempts randomized initial schedules and then iteratively improves them by local changes.
     * Hard constraints R2-R8 are enforced or penalized (no overlapping classes for the same group or related groups (R2, R7),
     * no teacher teaching two classes at the same time (R3), room availability and one class per room (R4, R4.1),
     * room suitability for courses (R5), teacher max weekly hours (R6), and teacher eligibility (R8)).
     * Once a schedule satisfies all hard constraints, the algorithm tries to improve soft constraints:
     * limiting daily hours (E1) and avoiding unpreferred timeslots (E2).
     * Note: The `constr_teacher` parameter (teacher_id) is not explicitly used in this algorithm.
     */
    const HARD_VIOLATION_WEIGHT = 1000;
    const classCount = class_list.length;
    const roomsArray = loaded_data.rooms;  // array of room objects for convenience

    // Precompute teacher eligibility for subjects (R8)
    const teachersForSubject = {};
    const courseTeachersForSubject = {};
    for (const teacher of loaded_data.teachers) {
        for (const subj of teacher.subjects_taught) {
            if (!(subj in teachersForSubject)) {
                teachersForSubject[subj] = [];
                courseTeachersForSubject[subj] = [];
            }
            teachersForSubject[subj].push(teacher.code);
            if (teacher.can_teach_course) {
                courseTeachersForSubject[subj].push(teacher.code);
            }
        }
    }

    // Precompute group relationships for conflict checking (R7)
    const mainCodeByName = {};
    const mainToSubs = {};
    const subToMain = {};
    for (const grp of loaded_data.groups) {
        if (grp.name.length === 1 && grp.code !== 0) {
            mainCodeByName[grp.name[0]] = grp.code;
            mainToSubs[grp.code] = [];
        }
    }
    for (const grp of loaded_data.groups) {
        if (grp.name.length > 1 && grp.code !== 0) {
            const mainName = grp.name[0];
            const mainCode = mainCodeByName[mainName];
            if (mainCode != null) {
                mainToSubs[mainCode].push(grp.code);
                subToMain[grp.code] = mainCode;
            }
        }
    }

    // Function to calculate the "cost" (violations) of a given assignment
    function calculateCost(assign) {
        let hardViolations = 0;
        let softViolations = 0;
        // Tracking structures for conflicts and usage
        const teacherTimeCount = {};
        const groupTimeCount = {};
        const roomTimeCount = {};
        const classesPerTeacher = {};
        const dailyCount = {};
        for (const tCode in teachers) {
            teacherTimeCount[tCode] = {};
            classesPerTeacher[tCode] = 0;
            dailyCount[tCode] = {};
        }
        for (const gCode in groups) {
            groupTimeCount[gCode] = {};
        }
        for (const rCode in rooms) {
            roomTimeCount[rCode] = {};
        }
        // Iterate through all class assignments to count usage and direct violations
        for (let i = 0; i < classCount; i++) {
            const cls = class_list[i];
            const { teacher: t, time: time_code, room: r } = assign[i];
            classesPerTeacher[t] += 1;
            // Count teacher, group, room usage for conflict checks
            teacherTimeCount[t][time_code] = (teacherTimeCount[t][time_code] || 0) + 1;
            groupTimeCount[cls.group_code][time_code] = (groupTimeCount[cls.group_code][time_code] || 0) + 1;
            roomTimeCount[r][time_code] = (roomTimeCount[r][time_code] || 0) + 1;
            // Track daily hours per teacher (for E1)
            const day = time_slots[time_code].day;
            dailyCount[t][day] = (dailyCount[t][day] || 0) + 1;
            // Soft constraint: unpreferred timeslot for teacher (E2)
            const unpreferredSlots = extra_restrictions.unpreferred_timeslots?.[String(t)] || [];
            if (unpreferredSlots.includes(time_code)) {
                softViolations += 1;  // teacher is assigned to an unpreferred timeslot (E2)
            }
            // Hard constraint: teacher eligibility (R8)
            if (!teachers[t].subjects_taught.includes(cls.subject_code) || (cls.type === 'course' && !teachers[t].can_teach_course)) {
                hardViolations += 1;  // teacher not eligible to teach this subject/type (R8)
            }
            // Hard constraint: room suitability for course (R5)
            if (cls.type === 'course' && !rooms[r].course_possible) {
                hardViolations += 1;  // course scheduled in a room that cannot host courses (R5)
            }
            // Hard constraint: room availability (R4)
            if (!rooms[r].possible_times.includes(time_code)) {
                hardViolations += 1;  // class scheduled in a room at a time it's unavailable (R4)
            }
        }
        // Hard constraint: teacher overlapping classes (R3)
        for (const t in teacherTimeCount) {
            for (const time in teacherTimeCount[t]) {
                const count = teacherTimeCount[t][time];
                if (count > 1) {
                    // If a teacher has multiple classes at the same time, count each extra class as a violation (R3)
                    hardViolations += (count - 1);
                }
            }
        }
        // Hard constraint: overlapping classes for groups or related groups (R2, R7)
        // We check each pair of classes that occur at the same time for group conflicts
        for (let i = 0; i < classCount; i++) {
            for (let j = i + 1; j < classCount; j++) {
                const cls1 = class_list[i];
                const cls2 = class_list[j];
                const a1 = assign[i];
                const a2 = assign[j];
                if (a1.time !== a2.time) continue;  // only consider classes at the same time
                const g1 = cls1.group_code;
                const g2 = cls2.group_code;
                if (g1 === g2) {
                    // Same group (including group 0 if it appears twice) has two classes at the same time (R2)
                    hardViolations += 1;
                }
                if ((g1 === 0 && g2 !== 0) || (g2 === 0 && g1 !== 0)) {
                    // "Everyone" group overlaps with any other group at the same time (R7 - conflict involving group 0)
                    hardViolations += 1;
                }
                // Check main group vs sub-group conflicts (R7)
                if (groups[g1].name.length === 1 && groups[g2].name.length > 1 && String(g2).startsWith(String(g1))) {
                    hardViolations += 1;
                }
                if (groups[g2].name.length === 1 && groups[g1].name.length > 1 && String(g1).startsWith(String(g2))) {
                    hardViolations += 1;
                }
            }
        }
        // Hard constraint: room overlapping classes (R4.1)
        for (const r in roomTimeCount) {
            for (const time in roomTimeCount[r]) {
                const count = roomTimeCount[r][time];
                if (count > 1) {
                    // If a room has multiple classes at the same time, count each extra class as a violation (R4.1)
                    hardViolations += (count - 1);
                }
            }
        }
        // Hard constraint: teacher exceeding weekly hours (R6)
        for (const t in classesPerTeacher) {
            if (classesPerTeacher[t] > teachers[t].max_hours) {
                hardViolations += (classesPerTeacher[t] - teachers[t].max_hours);
            }
        }
        // Soft constraint: teacher exceeding daily hour limit (E1)
        for (const t in dailyCount) {
            const maxDaily = extra_restrictions.max_daily_hours?.[String(t)] ?? teachers[t].max_hours;
            for (const day in dailyCount[t]) {
                if (dailyCount[t][day] > maxDaily) {
                    softViolations += (dailyCount[t][day] - maxDaily);
                }
            }
        }
        // Total cost = weighted hard violations + soft violations
        return hardViolations * HARD_VIOLATION_WEIGHT + softViolations;
    }

    // Variables to keep track of the best solution found
    let globalBestCost = Infinity;
    let globalBestAssignment = null;

    // Perform random-restart hill climbing until time runs out
    while (Date.now() - startTime < timeOut) {
        // Randomized initial assignment for all classes
        const assignment = new Array(classCount);
        // Reset tracking structures for initial assignment
        teacher_schedule = {};
        const teacherTimeCount = {};
        const groupTimeCount = {};
        const roomTimeCount = {};
        for (const t in teachers) {
            teacher_schedule[t] = 0;
            teacherTimeCount[t] = {};
        }
        for (const g in groups) {
            groupTimeCount[g] = {};
        }
        for (const r in rooms) {
            roomTimeCount[r] = {};
        }

        // Assign each class in a random way (satisfying most hard constraints)
        for (let idx = 0; idx < classCount; idx++) {
            const cls = class_list[idx];
            const subject_code = cls.subject_code;
            const group_code = cls.group_code;
            const class_type = cls.type;
            // Determine eligible teachers for this class (R8), include all if none eligible
            let possibleTeachers;
            if (class_type === 'course') {
                possibleTeachers = (courseTeachersForSubject[subject_code] && courseTeachersForSubject[subject_code].length > 0)
                    ? courseTeachersForSubject[subject_code]
                    : Object.keys(teachers).map(code => Number(code));
            } else {
                possibleTeachers = (teachersForSubject[subject_code] && teachersForSubject[subject_code].length > 0)
                    ? teachersForSubject[subject_code]
                    : Object.keys(teachers).map(code => Number(code));
            }
            // Avoid teachers who have reached max hours (R6) if others are available
            const availableTeachers = possibleTeachers.filter(t => teacher_schedule[t] < teachers[t].max_hours);
            const teacher_choice_list = (availableTeachers.length > 0 ? availableTeachers : possibleTeachers);
            const teacher_code = teacher_choice_list[Math.floor(Math.random() * teacher_choice_list.length)];
            // Shuffle timeslot options for random selection
            const timeslotsShuffled = [...loaded_data.timeslots];
            for (let i = timeslotsShuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [timeslotsShuffled[i], timeslotsShuffled[j]] = [timeslotsShuffled[j], timeslotsShuffled[i]];
            }
            let time_code = null;
            let room_code = null;
            // Find a time and room for this class that does not break hard constraints R2, R3, R4, R4.1, R5, R7
            for (const timeObj of timeslotsShuffled) {
                const t_code = timeObj.code;
                // Check teacher availability (R3)
                if (teacherTimeCount[teacher_code][t_code] >= 1) continue;  // teacher already has a class at this time (R3)
                // Check group availability (R2)
                if (groupTimeCount[group_code][t_code] >= 1) continue;     // this group already has a class at this time (R2)
                // Check subgroup/supergroup conflicts (R7)
                if (group_code === 0) {
                    // Everyone group: if ANY other group has a class at this time, skip (R7)
                    let conflict = false;
                    for (const g in groupTimeCount) {
                        if (g === '0') continue;
                        if (groupTimeCount[g][t_code] >= 1) { conflict = true; break; }
                    }
                    if (conflict) continue;
                } else if (groups[group_code].name.length === 1) {
                    // Main group: ensure none of its subgroups and group 0 are busy at this time (R7)
                    let conflict = false;
                    if (groupTimeCount['0'][t_code] >= 1) conflict = true;
                    if (!conflict && mainToSubs[group_code]) {
                        for (const sub of mainToSubs[group_code]) {
                            if (groupTimeCount[sub][t_code] >= 1) { conflict = true; break; }
                        }
                    }
                    if (conflict) continue;
                } else if (groups[group_code].name.length > 1) {
                    // Sub-group: ensure its main group and group 0 are free at this time (R7)
                    const mainGroup = subToMain[group_code];
                    if (mainGroup && groupTimeCount[mainGroup][t_code] >= 1) continue;
                    if (groupTimeCount['0'][t_code] >= 1) continue;
                }
                // Check for an available room at this time that fits the class (R4, R4.1, R5)
                const availableRooms = roomsArray.filter(room =>
                    (roomTimeCount[room.code][t_code] || 0) < 1 &&            // room is free at this time (R4.1)
                    room.possible_times.includes(t_code) &&                  // room is available for use at this time (R4)
                    (class_type !== 'course' || room.course_possible));      // if course, the room supports courses (R5)
                if (availableRooms.length === 0) {
                    // No free room for this timeslot, try next time
                    continue;
                }
                const chosenRoom = availableRooms[Math.floor(Math.random() * availableRooms.length)];
                room_code = chosenRoom.code;
                time_code = t_code;
                break;
            }
            if (time_code === null || room_code === null) {
                // If no valid slot found (due to extreme constraints), assign to a random slot and room (violating some constraint if necessary)
                const randomTimeObj = loaded_data.timeslots[Math.floor(Math.random() * loaded_data.timeslots.length)];
                time_code = randomTimeObj.code;
                // Choose a room that supports the class (if course) even if it's occupied
                let candidateRooms = class_type === 'course'
                    ? roomsArray.filter(room => room.course_possible && room.possible_times.includes(time_code))
                    : roomsArray.filter(room => room.possible_times.includes(time_code));
                if (candidateRooms.length === 0) {
                    candidateRooms = roomsArray; // as a last resort, allow any room
                }
                const chosenRoom = candidateRooms[Math.floor(Math.random() * candidateRooms.length)];
                room_code = chosenRoom.code;
            }
            // Assign the class to the chosen teacher, time, and room
            assignment[idx] = { teacher: teacher_code, time: time_code, room: room_code };
            // Update tracking for this assignment
            teacher_schedule[teacher_code] += 1;  // count class for teacher (for R6)
            teacherTimeCount[teacher_code][time_code] = (teacherTimeCount[teacher_code][time_code] || 0) + 1;
            groupTimeCount[group_code][time_code] = (groupTimeCount[group_code][time_code] || 0) + 1;
            if (!(room_code in roomTimeCount)) roomTimeCount[room_code] = {};
            roomTimeCount[room_code][time_code] = (roomTimeCount[room_code][time_code] || 0) + 1;
        }

        // Calculate the cost of the initial assignment (number of weighted violations)
        let currentCost = calculateCost(assignment);
        // If this assignment is better than the global best so far, remember it
        if (currentCost < globalBestCost) {
            globalBestCost = currentCost;
            globalBestAssignment = JSON.parse(JSON.stringify(assignment));
        }

        // Hill Climbing: iteratively improve the assignment by local changes
        let improved = true;
        while (improved && (Date.now() - startTime < timeOut)) {
            improved = false;
            for (let i = 0; i < classCount; i++) {
                if (Date.now() - startTime > timeOut) break;
                const cls = class_list[i];
                const oldAssign = assignment[i];
                const oldTeacher = oldAssign.teacher;
                const oldTime = oldAssign.time;
                const oldRoom = oldAssign.room;
                let bestNeighbor = null;
                let bestNeighborCost = currentCost;
                // 1. Try changing the teacher for class i (R3, R6, R8)
                let possibleTeachers;
                if (cls.type === 'course') {
                    possibleTeachers = (courseTeachersForSubject[cls.subject_code] && courseTeachersForSubject[cls.subject_code].length > 0)
                        ? courseTeachersForSubject[cls.subject_code]
                        : Object.keys(teachers).map(code => Number(code));
                } else {
                    possibleTeachers = (teachersForSubject[cls.subject_code] && teachersForSubject[cls.subject_code].length > 0)
                        ? teachersForSubject[cls.subject_code]
                        : Object.keys(teachers).map(code => Number(code));
                }
                for (const newTeacher of possibleTeachers) {
                    if (newTeacher === oldTeacher) continue;
                    // Skip if new teacher already has a class at this time (R3)
                    let teacherBusy = false;
                    for (let j = 0; j < classCount; j++) {
                        if (j !== i && assignment[j].teacher === newTeacher && assignment[j].time === oldTime) {
                            teacherBusy = true;
                            break;
                        }
                    }
                    if (teacherBusy) continue;
                    // Create neighbor assignment with new teacher
                    const neighbor = assignment.map(a => ({ teacher: a.teacher, time: a.time, room: a.room }));
                    neighbor[i].teacher = newTeacher;
                    const neighborCost = calculateCost(neighbor);
                    if (neighborCost < bestNeighborCost) {
                        bestNeighborCost = neighborCost;
                        bestNeighbor = neighbor;
                    }
                }
                // 2. Try changing the time (and room) for class i (R2, R3, R4, R4.1, R7)
                for (const timeObj of loaded_data.timeslots) {
                    const newTime = timeObj.code;
                    if (newTime === oldTime) continue;
                    // Check if class i's teacher or group would have a conflict at newTime
                    let teacherBusy = false;
                    let groupBusy = false;
                    for (let j = 0; j < classCount; j++) {
                        if (j === i) continue;
                        if (assignment[j].time === newTime) {
                            if (assignment[j].teacher === oldTeacher) teacherBusy = true;
                            const otherGroup = class_list[j].group_code;
                            // Same group or overlapping group busy at newTime?
                            if (otherGroup === cls.group_code) groupBusy = true;
                            // If class i's group is a main group and a subgroup is busy, or vice versa (R7)
                            if (groups[cls.group_code].name.length === 1 && subToMain[otherGroup] && subToMain[otherGroup] === cls.group_code) groupBusy = true;
                            if (groups[cls.group_code].name.length > 1 && (otherGroup === subToMain[cls.group_code] || otherGroup === 0)) groupBusy = true;
                            // Everyone group conflict
                            if (cls.group_code === 0 && otherGroup !== 0) groupBusy = true;
                        }
                        if (teacherBusy || groupBusy) break;
                    }
                    if (teacherBusy || groupBusy) continue;  // skip if newTime causes teacher (R3) or group conflict (R2/R7)
                    // Find a room for newTime
                    const freeRooms = roomsArray.filter(room =>
                        (room.possible_times.includes(newTime)) &&
                        (assignment.filter(a => a.time === newTime && a.room === room.code).length === 0) &&
                        (cls.type !== 'course' || room.course_possible));
                    if (freeRooms.length === 0) continue;  // no room available at newTime (R4.1/R4)
                    // Prefer to keep the same room if it's free, otherwise pick a random available room
                    let newRoom = oldRoom;
                    if (!freeRooms.find(room => room.code === oldRoom)) {
                        newRoom = freeRooms[0].code;
                    }
                    // Create neighbor assignment with new time (and possibly new room)
                    const neighbor = assignment.map(a => ({ teacher: a.teacher, time: a.time, room: a.room }));
                    neighbor[i].time = newTime;
                    neighbor[i].room = newRoom;
                    const neighborCost = calculateCost(neighbor);
                    if (neighborCost < bestNeighborCost) {
                        bestNeighborCost = neighborCost;
                        bestNeighbor = neighbor;
                    }
                }
                // 3. Try changing the room for class i (R4, R4.1, R5)
                for (const room of loaded_data.rooms) {
                    const newRoom = room.code;
                    if (newRoom === oldRoom) continue;
                    // Check if newRoom is free at the current time (R4.1)
                    let roomBusy = false;
                    for (let j = 0; j < classCount; j++) {
                        if (j !== i && assignment[j].time === oldTime && assignment[j].room === newRoom) {
                            roomBusy = true;
                            break;
                        }
                    }
                    if (roomBusy) continue;
                    // Check room constraints for class i
                    if (cls.type === 'course' && !room.course_possible) continue;          // newRoom cannot host courses (R5)
                    if (!rooms[newRoom].possible_times.includes(oldTime)) continue;       // newRoom not available at oldTime (R4)
                    const neighbor = assignment.map(a => ({ teacher: a.teacher, time: a.time, room: a.room }));
                    neighbor[i].room = newRoom;
                    const neighborCost = calculateCost(neighbor);
                    if (neighborCost < bestNeighborCost) {
                        bestNeighborCost = neighborCost;
                        bestNeighbor = neighbor;
                    }
                }
                // If a better neighbor was found, apply it and restart search
                if (bestNeighbor && bestNeighborCost < currentCost) {
                    assignment.splice(0, classCount, ...bestNeighbor);
                    currentCost = bestNeighborCost;
                    improved = true;
                    // Update tracking structures to maintain consistency after the move
                    teacher_schedule = {};
                    for (const t in teachers) teacher_schedule[t] = 0;
                    for (const t in teacherTimeCount) teacherTimeCount[t] = {};
                    for (const g in groupTimeCount) groupTimeCount[g] = {};
                    for (const r in roomTimeCount) roomTimeCount[r] = {};
                    for (let k = 0; k < classCount; k++) {
                        const { teacher: t, time: tm, room: r } = assignment[k];
                        const grp = class_list[k].group_code;
                        teacher_schedule[t] += 1;
                        teacherTimeCount[t][tm] = (teacherTimeCount[t][tm] || 0) + 1;
                        groupTimeCount[grp][tm] = (groupTimeCount[grp][tm] || 0) + 1;
                        if (!(r in roomTimeCount)) roomTimeCount[r] = {};
                        roomTimeCount[r][tm] = (roomTimeCount[r][tm] || 0) + 1;
                    }
                    break;  // break out to restart checking classes from beginning
                }
            }
        }

        // If the result of this restart is better than the global best, update global best
        if (currentCost < globalBestCost) {
            console.log(currentCost);
            globalBestCost = currentCost;
            globalBestAssignment = JSON.parse(JSON.stringify(assignment));
        }
        // Continue with another restart until time runs out
    }

    // Construct the best timetable found in the required format
    current_timetable = {};
    if (globalBestAssignment) {
        for (let i = 0; i < classCount; i++) {
            const cls = class_list[i];
            const { teacher: t, time: time_code, room: r } = globalBestAssignment[i];
            if (!(t in current_timetable)) {
                current_timetable[t] = {};
            }
            current_timetable[t][time_code] = [cls.group_code, r, cls.subject_code, cls.type];
        }
    }
    best_timetable = JSON.parse(JSON.stringify(current_timetable));
    return true;
}

async function generateTimetableAndClasslist(new_extra_restrictions, teacher_id, oldTimetable) {
    const db = await getDatabaseAsJson();
    loaded_data = JSON.parse(db);
    if (new_extra_restrictions != null) {
        loaded_data.extra_restrictions = new_extra_restrictions;
    } else {
        loaded_data.extra_restrictions = {
            unpreferred_timeslots: {},
            max_daily_hours: {}
        };
    }
    if (oldTimetable != null) {
        initializeData(oldTimetable.class_list);
    } else {
        initializeData(null);
    }
    startTime = Date.now();
    const success = generateTimetableHillClimbing();
    return success ? {
        data: best_timetable,
        class_list: class_list,
        extra_restrictions: extra_restrictions
    } : null;
}

module.exports = { generateTimetableAndClasslist };
