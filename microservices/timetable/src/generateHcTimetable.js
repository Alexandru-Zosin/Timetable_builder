const { getDatabaseAsJson } = require('../utils/downloadDatabases');

let startTime;
let loaded_data;

/*
Restrictions (HARD_1 - unmarked & HARD_2 - marked):
#  R1) Mandatory subjects are assigned to each group.
#  R2) A course can be taught only by an elligible teacher.
#  R3) A professor cannot exceed max teaching hours. (HARD_2)
#  R4) A teacher does not teach two classes at the same time.                 
#  R5) A room cannot have two classes at the same time.                       
#  R6) A room must be available to the university at the given time.          
#  R6.1) A course must be taught in a room that supports courses.               
#  R7) No overlapping classes for the same group at the same time.            
#  R8) A subgroup cannot have classes when its maingroup(s) have classes (*MIX of HARD_1 and HARD_2)              
        
Extra restrictions (SOFT):                                                
#  E1) A professor can have a number of maximum daily teaching hours
#  E2) A professor can have unpreferred timeslots       
*/

/*
Assignment = (TEACHER_code, TIME_code, ROOM_code)
Class_list = (class_type, subject_code, group_code, year_code)
*/

const simpleHillClimbing = true;
// groups[301] gives all info about group 301 (name, language...) etc.
let groups, rooms, teachers, subjects, timeslots, extra_restrictions;

let class_list = [];      // every class we must place
let best_timetable = null;    // best_timetable[teacher][time] = [...]
let teacherHoursCount = {};      // total classes assigned / teacher (R3)
const teachersForSubj = {}, courseTeachersForSubj = {}; // teacher eligibility precomputing for R2
const mainToSubs = {}, subToMain = {}; // mainToSubs & subToMain maps (shared across years)

function initializeData(old_class_list) {
    groups = Object.fromEntries(loaded_data.groups.map(g => [g.code, g]));
    rooms = Object.fromEntries(loaded_data.rooms.map(r => [r.code, r]));
    teachers = Object.fromEntries(loaded_data.teachers.map(t => [t.code, t]));
    subjects = Object.fromEntries(loaded_data.subjects.map(s => [s.code, s]));
    timeslots = Object.fromEntries(loaded_data.timeslots.map(ts => [ts.code, ts]));
    extra_restrictions = loaded_data.extra_restrictions;

    for (const t of Object.values(teachers)) {
        for (const subj of t.subjects_taught) {
            if (!teachersForSubj[subj]) {
                teachersForSubj[subj] = [];
                courseTeachersForSubj[subj] = [];
            }
            teachersForSubj[subj].push(t.code);
            if (t.can_teach_course)
                courseTeachersForSubj[subj].push(t.code);
        }
    }

    for (const mainGroup of Object.values(groups).filter(g => g.name.length === 1)) // A, B, E init.
        mainToSubs[mainGroup.code] = [];

    for (const subGroup of Object.values(groups).filter(g => g.name.length > 1 && g.code !== 0)) {
        const mainGroupCode = Number((String(subGroup.code))[0]);   // subgroup's first digit
        mainToSubs[mainGroupCode].push(subGroup.code);
        subToMain[subGroup.code] = mainGroupCode;
    }

    class_list = [];
    if (old_class_list != null) {
        class_list = old_class_list;
    } 
    else { // building new class_list
        const classListsByYear = { 1: [], 2: [], 3: [] };

        for (const subject of Object.values(subjects)) {
            if (subject.is_optional === 0) { // MANDATORY
                for (const group of Object.values(groups)) {
                    if (group.name.length === 1) {   // course group (all subgroups altogether)
                        if (!subject.name.includes('ngl')) // English CAN HAVE NO courses
                            classListsByYear[subject.year].push({
                                class_type: 'course',
                                subject_code: subject.code,
                                group_code: group.code,
                                year_code: subject.year
                            });
                    } else if (group.code !== 0) {  // seminar group (each individual group)
                        classListsByYear[subject.year].push({
                            class_type: 'seminar',
                            subject_code: subject.code,
                            group_code: group.code,
                            year_code: subject.year
                        });
                    }
                }
            } else { // OPTIONAL
                classListsByYear[subject.year].push({
                    class_type: 'course',
                    subject_code: subject.code,
                    group_code: 0, // EVERYONE of that year
                    year_code: subject.year
                });
                const main_groups = Object.values(groups).filter(g => g.name.length === 1);
                for (const g of main_groups) { // seminar is for all main groups altogether
                    classListsByYear[subject.year].push({
                        class_type: 'seminar',
                        subject_code: subject.code,
                        group_code: g.code,
                        year_code: subject.year
                    });
                }
            }
        }

        class_list = [].concat(...classListsByYear[3], ...classListsByYear[1], ...classListsByYear[2]);
        // fisheryates shuffle
        for (let i = class_list.length - 1; i > 0; --i) {
            const j = Math.floor(Math.random() * (i + 1));
            [class_list[i], class_list[j]] = [class_list[j], class_list[i]];
        }
    }
}

// builds year1-group2 etc. keys
const yearGroupKey = (year, gCode) => `${year}_${gCode}`;

function generateTimetableHillClimbing(timeOut = 10000) {
    const HARD1_VIOLATION_WEIGHT = 30;
    const HARD2_VIOLATION_WEIGHT = 5;
    const SOFT_VIOLATION_WEIGHT = 1;
    function calculateCost(assignment) {
        let hard1 = 0, hard2 = 0, soft = 0;

        const teacherSchedule = {};
        const groupSchedule = {};
        const roomSchedule = {};
        const teacherHoursCount = {};
        const dailyHoursCount = {};

        for (const t in teachers) {
            teacherSchedule[t] = {};
            teacherHoursCount[t] = 0;
            dailyHoursCount[t] = {};
        }

        for (let i = 0; i < class_list.length; ++i) {
            const cls = class_list[i];
            const { teacher: T, time: tm, room: R } = assignment[i];
            const gK = yearGroupKey(cls.year_code, cls.group_code);

            // We track again the usage
            teacherSchedule[T][tm] = (teacherSchedule[T][tm] || 0) + 1;
            teacherHoursCount[T] += 1;
            const day = timeslots[tm].day;
            dailyHoursCount[T][day] = (dailyHoursCount[T][day] || 0) + 1;

            if (!groupSchedule[gK])
                groupSchedule[gK] = {};
            groupSchedule[gK][tm] = (groupSchedule[gK][tm] || 0) + 1;

            if (!roomSchedule[R])
                roomSchedule[R] = {};
            roomSchedule[R][tm] = (roomSchedule[R][tm] || 0) + 1;

            // E2 - unpreferred slot
            const unpref = extra_restrictions.unpreferred_timeslots?.[String(T)] ?? [];
            if (unpref.includes(tm))
                soft += 1;

            // R2 - eligible teacher
            if (!teachers[T].subjects_taught.includes(cls.subject_code) ||
                (cls.class_type === 'course' && !teachers[T].can_teach_course))
                hard1 += 1;

            // R6 - room availability at university
            if (!rooms[R].possible_times.includes(tm))
                hard1 += 1;

            // R6.1 - if room hosts courses
            if (cls.class_type === 'course' && !rooms[R].course_possible)
                hard1 += 1;
        }

        // R4 - teacher should not teach two things at the same time
        for (const t in teacherSchedule)
            for (const tm in teacherSchedule[t])
                if (teacherSchedule[t][tm] > 1)
                    hard1 += teacherSchedule[t][tm] - 1;

        // R5 - room overlap 
        for (const r in roomSchedule)
            for (const tm in roomSchedule[r])
                if (roomSchedule[r][tm] > 1)
                    hard1 += roomSchedule[r][tm] - 1;

        // R3 - max weekly hours 
        for (const t in teacherHoursCount)
            if (teacherHoursCount[t] > teachers[t].max_hours)
                hard2 += teacherHoursCount[t] - teachers[t].max_hours;

        // E1 - max daily hrs 
        for (const t in dailyHoursCount) {
            const maxDaily = extra_restrictions.max_daily_hours?.[String(t)] ?? teachers[t].max_hours;
            for (const d in dailyHoursCount[t])
                if (dailyHoursCount[t][d] > maxDaily)
                    soft += dailyHoursCount[t][d] - maxDaily;
        }

        // R7 & R8 - group conflicts (year‑local)
        // calculateCost is where 'punish' every type of conflict that could've been relaxed previously
        for (let i = 0; i < class_list.length; ++i) {
            for (let j = i + 1; j < class_list.length; ++j) {
                const cls1 = class_list[i];
                const cls2 = class_list[j];

                if (cls1.year_code !== cls2.year_code)
                    continue;
                if (assignment[i].time !== assignment[j].time)
                    continue;

                const g1 = cls1.group_code;
                const g2 = cls2.group_code;

                // Same Everyone/Main Group/Subgroup (R7) 
                if (g1 === g2) {
                    hard1 += 1;
                    continue;
                }

                if (g1 === 0) { // Everyone
                    if (groups[g2].name.length === 1) {
                        hard1 += 1; // mainGroup conflict
                        continue;
                    }
                    if (g2 > 100) { // subgroup conflict
                        hard2 += 1;
                        continue;
                    }
                }

                else if (groups[g1].name.length === 1) { // Main group
                    if (g2 === 0) {
                        hard1 += 1; // everyone conflict
                        continue;
                    }
                    if (mainToSubs[g1].includes(g2)) {
                        hard1 += 1;     // subgroup conflict
                        continue;
                    }
                }

                else {  // Subgroup
                    if (g2 === 0) { // everyone conflict
                        hard2 += 1;
                        continue;
                    }
                    if (subToMain[g1] == g2) { // maingroup conflict
                        hard1 += 1;
                        continue;
                    }
                }
            } // end j loop
        } // end i loop
        return hard1 * HARD1_VIOLATION_WEIGHT + hard2 * HARD2_VIOLATION_WEIGHT + soft * SOFT_VIOLATION_WEIGHT;
    } // end calculateCost

    // Global best variables 
    let globalBestCost = Infinity;
    let globalBestAssignment = null;

    // Random-Restart Hillclimbing Algorithm
    while (Date.now() - startTime < timeOut) {
        // Initializations for each restart
        const assignment = [];
        const teacherSchedule = {}, groupSchedule = {}, roomSchedule = {};
        teacherHoursCount = {};
        for (const t in teachers) {
            teacherSchedule[t] = {};
            teacherHoursCount[t] = 0;
        }
        for (const r in rooms)
            roomSchedule[r] = {};

        /* PART 1: Random Initial Assignment (it does NOT have to score well) */
        for (let idx = 0; idx < class_list.length; ++idx) {  // (R1)
            const cls = class_list[idx];
            const { subject_code, group_code, class_type, year_code } = cls;

            // STEP 1: Assigning the teacher
            // if it's a course, we select elligible teachers (R2)
            const elligibleTeachers = (class_type === 'course' ?
                courseTeachersForSubj[subject_code] :
                teachersForSubj[subject_code]);

            // further refining with teachers under their maximum weekly hours (R3)
            let availableTeachers = elligibleTeachers.filter(t => teacherHoursCount[t] < teachers[t].max_hours);
            availableTeachers = availableTeachers.length ? availableTeachers : elligibleTeachers;
            const chosenTeacher = availableTeachers[Math.floor(Math.random() * availableTeachers.length)];

            // random shuffling the timeslots for random selection
            const times = [...Object.values(timeslots)];
            for (let i = times.length - 1; i > 0; --i) {
                const j = Math.floor(Math.random() * (i + 1));
                [times[i], times[j]] = [times[j], times[i]];
            }

            // STEP 2: Assigning the timeslot(room-pair)
            // TIME
            let chosenTime = null, chosenRoom = null;
            for (const ts of times) {
                const tm = ts.code;

                // teacher can not teach two classes at the same time (R4)
                if (teacherSchedule[chosenTeacher][tm])
                    continue;

                // same group can not have classes at the same moment (R7)
                if (groupSchedule[yearGroupKey(year_code, group_code)]?.[tm])
                    continue;

                // between (sub-main-everyone) conflicts (R8 relaxed)
                if (group_code === 0) { // Everyone
                    let conflict = false; // we check only against mainGroups
                    for (const maingr_code of Object.values(groups)
                                                    .filter(g => g.name.length === 1 && g.code !== 0)) {
                        if (groupSchedule[yearGroupKey(year_code, maingr_code.code)]?.[tm]) {
                            conflict = true;
                            break;
                        }
                    }
                    if (conflict)
                        continue;
                    // we allow subgroups conflicts and we'll use the Hillclimbing to improve
                }
                else if (groups[group_code].name.length === 1) { // MainGroup
                    if (groupSchedule[yearGroupKey(year_code, 0)]?.[tm]) // everyone(0) conflict
                        continue;

                    // for the initial assignment, we allow conflicts with subgroups
                    
                    // let conflict = false;
                    // for (const subgr_code of mainToSubs[group_code]) // its subgroups are busy
                    //     if (groupSchedule[yearGroupKey(year_code, subgr_code)]?.[tm]) {
                    //         conflict = true;
                    //         break;
                    //     }
                    // if (conflict)
                    //     continue;
                }        
                else { // SubGroup
                    if (groupSchedule[yearGroupKey(year_code, subToMain[group_code])]?.[tm])
                        continue;   // we only consider the conflict against its mainGroup
                }

                // ROOM
                // unbooked room (R5), available room to univ. (R6) and course possible, if needed (R6.1)
                const freeRooms = Object.values(rooms).filter(room =>
                    !roomSchedule[room.code]?.[tm] &&
                    room.possible_times.includes(tm) &&
                    (class_type !== 'course' || room.course_possible)
                );

                if (freeRooms.length === 0)
                    continue;

                chosenTime = tm;
                chosenRoom = freeRooms[Math.floor(Math.random() * freeRooms.length)].code;
                break;
            }

            // if there's no chosenTime, we choose at random (chosenRoom === null is as well)
            if (chosenTime === null) {
                chosenTime = Object.values(timeslots)[Math.floor(Math.random() * Object.values(timeslots).length)].code;

                let fallbackRooms = class_type === 'course'
                    ? Object.values(rooms).filter(r => r.course_possible && r.possible_times.includes(chosenTime))
                    : Object.values(rooms).filter(r => r.possible_times.includes(chosenTime));

                if (fallbackRooms.length === 0) // if still no room available, we consider all of them
                    fallbackRooms = Object.values(rooms);
                chosenRoom = fallbackRooms[Math.floor(Math.random() * fallbackRooms.length)].code;
            }

            assignment[idx] = { teacher: chosenTeacher, time: chosenTime, room: chosenRoom };

            // We track what we used
            teacherHoursCount[chosenTeacher] += 1;
            teacherSchedule[chosenTeacher][chosenTime] = (teacherSchedule[chosenTeacher][chosenTime] || 0) + 1;

            const gk = yearGroupKey(year_code, group_code);
            if (!groupSchedule[gk])
                groupSchedule[gk] = {};
            groupSchedule[gk][chosenTime] = (groupSchedule[gk][chosenTime] || 0) + 1;

            if (!roomSchedule[chosenRoom])
                roomSchedule[chosenRoom] = {};
            roomSchedule[chosenRoom][chosenTime] = (roomSchedule[chosenRoom][chosenTime] || 0) + 1;
        } // End of initial assignment

        let currentCost = calculateCost(assignment);
        if (currentCost < globalBestCost) {
            globalBestCost = currentCost;
            globalBestAssignment = structuredClone(assignment);
        } // Checking if it's the best assignment so far

        // Hillclimb neighbours local improvements until stuck (we reset initial assignment) or time‑out
        // Note: R1, R2, R4, R5, R6, R6.1, R7 MUST be met, otherwise timetable is 100% invalid
        //       R3, R8 can be relaxed; and E1, E2 completely ignored at this stage
        let improved = true;
        while (improved && (Date.now() - startTime < timeOut)) {
            improved = false;

            for (let i = 0; i < class_list.length; ++i) { // we improve one part at a time (R1)
                if (Date.now() - startTime > timeOut)
                    break;

                const cls = class_list[i];
                const old = assignment[i];
                const { teacher: tOld, time: tmOld, room: rOld } = old;
                const yr = cls.year_code;

                let bestNeighbour = null, bestNeighbourCost = currentCost;

                // neighbour OPT1: change teacher (we try all of them)
                // if it's a course, we still have to select elligible teachers (R2)
                const candidateTeachers = (cls.class_type === 'course' ?
                    courseTeachersForSubj[cls.subject_code] :
                    teachersForSubj[cls.subject_code]);

                for (const tNew of candidateTeachers) {
                    if (tNew === tOld)
                        continue;

                    // is tNew already teaching something at tmOld? (R4)
                    let busy = false;
                    for (let j = 0; j < class_list.length; ++j)
                        if (j !== i && assignment[j].teacher === tNew && assignment[j].time === tmOld) {
                            busy = true;
                            break;
                        }
                    if (busy)
                        continue;

                    // shallow top level cloning
                    const neigh = assignment.map(a => ({ ...a })); // shallow top-level cloning 
                    neigh[i].teacher = tNew;
                    const cost = calculateCost(neigh);
                    if (cost < bestNeighbourCost) {
                        bestNeighbourCost = cost;
                        bestNeighbour = neigh;
                    }
                }

                // neighbour OPT2: change time(+room) (we try all of them) *time affects the other neighs
                for (const ts of Object.values(timeslots)) {
                    const tmNew = ts.code;
                    if (tmNew === tmOld)
                        continue;

                    // teacher busy at this time? (R4)
                    let tBusy = false;
                    for (let j = 0; j < class_list.length; ++j)
                        if (j !== i && assignment[j].teacher === tOld && assignment[j].time === tmNew) {
                            tBusy = true;
                            break;
                        }
                    if (tBusy)
                        continue;

                    // group busy? (same‑year only) (R7 + R8 - can be relaxed)
                    let gBusy = false;
                    for (let j = 0; j < class_list.length; ++j) {
                        if (j === i)  // if it's the very same assignment
                            continue; // we continue (no purpose to check against itself)
                        if (class_list[j].year_code !== yr) // if not from same year, we continue
                            continue;
                        if (assignment[j].time !== tmNew) // if times differ, we continue
                            continue;

                        // now we have two assignments[i] and [j] for the same year
                        // at the *same* time
                        const gOther = class_list[j].group_code;
                        const gThis = cls.group_code;
                        if (gOther === gThis) {  // R7 (Everyone/MainGroup/Subgroup)
                            gBusy = true;
                            break;
                        }

                        // R8 - relaxed:
                        if (gThis === 0) { // Everyone
                            if (groups[gOther].name.length === 1) {
                                gBusy = true; // we don't allow mainGroups to have classes
                                break;
                            }
                        }

                        else if (groups[gThis].name.length === 1) { // Main group
                            if (gOther === 0) { // we don't allow everyone to have classes
                                gBusy = true;
                                break;
                            }
                        }

                        else { // Subgroups
                            if (subToMain[gThis] == gOther) {
                                gBusy = true;   // we don't allow mainGroup to have classes
                                break;
                            }
                        }
                    } // end group conflicts check
                    if (gBusy)
                        continue; // with another timeslot

                    // room search (at tmNew, rmOld could be occupied already, so we need to reassign)
                    const free = Object.values(rooms).filter(r =>
                        !assignment.find(a => a.time === tmNew && a.room === r.code) && // (R5)
                        r.possible_times.includes(tmNew) && // (R6)
                        (cls.class_type !== 'course' || r.course_possible) // (R6.1)
                    );
                    if (free.length === 0)
                        continue;
                    const rNew = free[0].code;
                    const neigh = assignment.map(a => ({ ...a }));
                    neigh[i].time = tmNew;
                    neigh[i].room = rNew;
                    const cost = calculateCost(neigh);
                    if (cost < bestNeighbourCost) {
                        bestNeighbourCost = cost;
                        bestNeighbour = neigh;
                    }
                }  // end OPT2

                // neighbour OPT3: change room (we try all of them)
                for (const r of Object.values(rooms)) {
                    if (r.code === rOld) // we only search neighbours, not the same state
                        continue;
                    if (!r.possible_times.includes(tmOld)) // (R6)
                        continue;
                    if (cls.class_type === 'course' && !r.course_possible) // (R6.1)
                        continue;

                    // room busy? (R5)
                    let busy = false;
                    for (let j = 0; j < class_list.length; ++j)
                        if (j !== i && assignment[j].time === tmOld && assignment[j].room === r.code) {
                            busy = true;
                            break;
                        }
                    if (busy)
                        continue;

                    const neigh = assignment.map(a => ({ ...a }));
                    neigh[i].room = r.code;
                    const cost = calculateCost(neigh);
                    if (cost < bestNeighbourCost) {
                        bestNeighbourCost = cost;
                        bestNeighbour = neigh;
                    }
                } // end OPT3

                // Checking the best OPT generated
                if (bestNeighbour && bestNeighbourCost < currentCost) {
                    assignment.splice(0, class_list.length, ...bestNeighbour);
                    currentCost = bestNeighbourCost;
                    improved = true;
                    if (simpleHillClimbing)
                        break; // else Steepest Ascent
                }
            } // end 1.(i+1).275 classList // restart scanning next cL/asgn, works with improved == false
        } // end Hillclimbing for this algorithm iteration (timedOut or improved == false)

        // Checking if it's the best assignment so far
        if (currentCost < globalBestCost) {
            globalBestCost = currentCost;
            globalBestAssignment = structuredClone(assignment);
            console.log(`Better timetable - cost ${globalBestCost}`);
        }
    } // end main_loop -> we restart the procedure with initial assignment, cost calculate, hillclimbing

    // build bestTimetable object to return
    best_timetable = {};
    if (globalBestAssignment) {
        for (let i = 0; i < class_list.length; ++i) {
            const cls = class_list[i];
            const { teacher: T, time: tm, room: R } = globalBestAssignment[i];
            if (!(T in best_timetable)) best_timetable[T] = {};
            best_timetable[T][tm] = [
                cls.group_code,
                R,
                cls.subject_code,
                cls.class_type,
                cls.year_code
            ];
        }
    }
    return true;
}

async function generateHcTimetableAndClasslist(new_extra_restrictions, oldTimetable, timeOut) {
    loaded_data = JSON.parse(await getDatabaseAsJson());

    loaded_data.extra_restrictions = new_extra_restrictions ?? {
        unpreferred_timeslots: {},
        max_daily_hours: {}
    };

    if (oldTimetable != null)
        initializeData(oldTimetable.class_list);
    else
        initializeData(null);

    startTime = Date.now();
    const ok = generateTimetableHillClimbing(timeOut * 1000);

    return ok ? {
        data: best_timetable,
        class_list: class_list,
        extra_restrictions
    } : null;
}

module.exports = { generateHcTimetableAndClasslist };