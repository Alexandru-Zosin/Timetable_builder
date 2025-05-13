/**
 *  Random‑restart hill‑climbing timetable generator
 *  (multi‑year version – years 1, 2 and 3 supported)
 *
 *  NOTE – All commentaries kept IDENTICAL, except R7 description
 *  and a couple of tiny “--- Added support …” markers.
 */

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
#  R7) A subgroup cannot have classes when its MAIN‑group has classes          ###DONE
#  R8) A course can be taught only by an eligible teacher.                     ###DONE
Extra restrictions (POSSIBLE):
#-----#
#  E1) A professor can have a number of maximum daily teaching hours           ###DONE
#  E2) A professor can have unpreferred timeslots                              ###DONE
#  --- Added support for multiple academic years (1, 2, 3)
#  --- Identical group codes from different years are now completely isolated
*/

/* ======================================================================= */
/* ===  lookup dictionaries for entities accessed by codes (group.code) ===*/
/* ======================================================================= */
/* example: groups[301] gives all info about group 301 (name, language…)   */

let groups;
let rooms;
let teachers;
let subjects;
let time_slots;
let extra_restrictions;

/* ===  global working structures  ======================================= */

let shuffle = true;
let class_list           = [];      // every class we must place
let best_timetable       = null;    // best timetable found so far
let current_timetable    = {};      // current_timetable[teacher][time] = [...]
let teacher_schedule     = {};      // total classes assigned / teacher (R6)
let daily_teacher_hours  = {};      // hours / teacher / day  (E1)

/* helper – build “yearCode_groupCode” keys so year‑1 group 1 ≠ year‑2 group 1 */
const gKey = (year, gCode) => `${year}_${gCode}`;

/* ----------------------------------------------------------------------- */
/* ===  INITIALISATION ==================================================== */
/* ----------------------------------------------------------------------- */
function initializeData(old_class_list) {

    groups   = Object.fromEntries(loaded_data.groups.map(g => [g.code, g]));
    rooms    = Object.fromEntries(loaded_data.rooms.map(r => [r.code, r]));
    teachers = Object.fromEntries(loaded_data.teachers.map(t => [t.code, t]));
    subjects = Object.fromEntries(loaded_data.subjects.map(s => [s.code, s]));
    time_slots = Object.fromEntries(loaded_data.timeslots.map(ts => [ts.code, ts]));
    extra_restrictions = loaded_data.extra_restrictions;

    /* ------------------------------------------------------ */
    /* --- build the list of classes that must be scheduled --*/
    /* ------------------------------------------------------ */
    shuffle = true;
    class_list = [];

    if (old_class_list != null) {
        class_list = old_class_list;
        shuffle = false;

    } else {               // build brand new class_list
        const listsByYear = { 1: [], 2: [], 3: [] };

        for (const subject of loaded_data.subjects) {
            const yr = subject.year || 1;

            if (subject.is_optional === 0) {                  // mandatory
                for (const group of loaded_data.groups) {
                    if (group.name.length === 1) {            // course group
                        listsByYear[yr].push({
                            type: 'course',
                            subject_code: subject.code,
                            group_code: group.code,
                            year_code : yr
                        });
                    } else if (group.code !== 0) {            // seminar subgroup
                        listsByYear[yr].push({
                            type: 'seminar',
                            subject_code: subject.code,
                            group_code: group.code,
                            year_code : yr
                        });
                    }
                }
            } else {                                         // optional
                const main_groups = loaded_data.groups.filter(g => g.name.length === 1);
                listsByYear[yr].push({
                    type: 'course',
                    subject_code: subject.code,
                    group_code: 0,   // EVERYONE of that year
                    year_code : yr
                });
                for (const g of main_groups) {
                    listsByYear[yr].push({
                        type: 'seminar',
                        subject_code: subject.code,
                        group_code: g.code,
                        year_code : yr
                    });
                }
            }
        }

        /* concatenate *3‑year* lists in year‑3, year‑1, year‑2 order (heuristic) */
        class_list = [].concat(...listsByYear[3], ...listsByYear[1], ...listsByYear[2]);

        /* Fisher–Yates shuffle */
        for (let i = class_list.length - 1; i > 0; --i) {
            const j = Math.floor(Math.random() * (i + 1));
            [class_list[i], class_list[j]] = [class_list[j], class_list[i]];
        }
    }

    best_timetable      = null;
    current_timetable   = {};
    teacher_schedule    = {};
    daily_teacher_hours = {};
}

/* ----------------------------------------------------------------------- */
/* ===  HILL‑CLIMBING CORE ============================================== */
/* ----------------------------------------------------------------------- */
function generateTimetableHillClimbing() {

    /* ---- constants & helpers ----------------------------------------- */
    const HARD_VIOLATION_WEIGHT = 1000;
    const classCount = class_list.length;
    const roomsArr = loaded_data.rooms;

    /* teacher eligibility cache (R8) */
    const teachersForSubj = {};
    const courseTeachersForSubj = {};
    for (const t of loaded_data.teachers) {
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

    /* main‑→sub & sub‑→main maps (shared across years) */
    const mainToSubs = {}, subToMain = {};
    for (const g of loaded_data.groups) {
        if (g.name.length === 1 && g.code !== 0)
            mainToSubs[g.code] = [];
    }
    for (const g of loaded_data.groups) {
        if (g.name.length > 1 && g.code !== 0) {
            const mainCode = Number(String(g.code)[0]);   // first digit
            if (mainToSubs[mainCode])
                mainToSubs[mainCode].push(g.code);
            subToMain[g.code] = mainCode;
        }
    }

    /* ---- cost function ----------------------------------------------- */
    function calculateCost(assign) {

        let hard = 0, soft = 0;

        const teacherTime = {};
        const groupTime   = {};
        const roomTime    = {};
        const teacherWeekly = {};
        const dailyCount  = {};

        for (const t in teachers) {
            teacherTime[t]   = {};
            teacherWeekly[t] = 0;
            dailyCount[t]    = {};
        }

        /* iterate classes once */
        for (let i = 0; i < classCount; ++i) {
            const cls     = class_list[i];
            const { teacher: T, time: tm, room: R } = assign[i];
            const yr      = cls.year_code;
            const gCode   = cls.group_code;
            const gK      = gKey(yr, gCode);

            /* teacher / room / group usage bookkeeping */
            teacherTime[T][tm] = (teacherTime[T][tm] || 0) + 1;

            if (!groupTime[gK]) groupTime[gK] = {};
            groupTime[gK][tm]  = (groupTime[gK][tm] || 0) + 1;

            if (!roomTime[R]) roomTime[R] = {};
            roomTime[R][tm]   = (roomTime[R][tm] || 0) + 1;

            teacherWeekly[T] += 1;

            /* daily hrs */
            const day = time_slots[tm].day;
            dailyCount[T][day] = (dailyCount[T][day] || 0) + 1;

            /* E2 – unpreferred slot */
            const unpref = extra_restrictions.unpreferred_timeslots?.[String(T)] ?? [];
            if (unpref.includes(tm)) soft += 1;

            /* R8 – eligibility */
            if (!teachers[T].subjects_taught.includes(cls.subject_code) ||
                (cls.type === 'course' && !teachers[T].can_teach_course))
                hard += 1;

            /* R5 – room hosts courses */
            if (cls.type === 'course' && !rooms[R].course_possible) hard += 1;

            /* R4 – room availability */
            if (!rooms[R].possible_times.includes(tm)) hard += 1;
        }

        /* R3 – teacher overlap */
        for (const t in teacherTime)
            for (const tm in teacherTime[t])
                if (teacherTime[t][tm] > 1) hard += teacherTime[t][tm] - 1;

        /* R4.1 – room overlap */
        for (const r in roomTime)
            for (const tm in roomTime[r])
                if (roomTime[r][tm] > 1) hard += roomTime[r][tm] - 1;

        /* R6 – max weekly hours */
        for (const t in teacherWeekly)
            if (teacherWeekly[t] > teachers[t].max_hours)
                hard += teacherWeekly[t] - teachers[t].max_hours;

        /* E1 – max daily hrs */
        for (const t in dailyCount) {
            const maxDaily = extra_restrictions.max_daily_hours?.[String(t)] ?? teachers[t].max_hours;
            for (const d in dailyCount[t])
                if (dailyCount[t][d] > maxDaily)
                    soft += dailyCount[t][d] - maxDaily;
        }

        /* R2 & R7 – group conflicts (year‑local) */
        for (let i = 0; i < classCount; ++i) {
            for (let j = i + 1; j < classCount; ++j) {
                const cls1 = class_list[i];
                const cls2 = class_list[j];

                if (cls1.year_code !== cls2.year_code) continue;
                if (assign[i].time !== assign[j].time)   continue;

                const g1 = cls1.group_code, g2 = cls2.group_code;

                /* same group */
                if (g1 === g2) { hard += 1; continue; }

                /* Everyone vs others */
                if ((g1 === 0 && g2 !== 0) || (g2 === 0 && g1 !== 0)) { hard += 1; continue; }

                /* main vs sub (R7) – subgroup cannot overlap with its main */
                if (groups[g1].name.length === 1 && groups[g2].name.length > 1 && String(g2).startsWith(String(g1)))
                    hard += 1;
                if (groups[g2].name.length === 1 && groups[g1].name.length > 1 && String(g1).startsWith(String(g2)))
                    hard += 1;
            }
        }

        return hard * HARD_VIOLATION_WEIGHT + soft;
    }

    /* ---- global best trackers ----------------------------------------- */
    let globalBestCost = Infinity;
    let globalBestAsg  = null;

    /* ---- random‑restart loop ------------------------------------------ */
    while (Date.now() - startTime < timeOut) {

        /* TRACKERS FOR THIS RESTART */
        const assignment = new Array(classCount);
        const teacherTime = {}, groupTime = {}, roomTime = {};
        for (const t in teachers) teacherTime[t] = {};
        for (const r in rooms)    roomTime[r]    = {};

        /* STEP 1: random initial assignment --------------------------------*/
        teacher_schedule = {};
        for (const t in teachers) teacher_schedule[t] = 0;

        for (let idx = 0; idx < classCount; ++idx) {

            const cls = class_list[idx];
            const { subject_code, group_code, type, year_code } = cls;

            /* eligible teachers (R8) */
            const candidates = (type === 'course'
                ? (courseTeachersForSubj[subject_code]?.length
                    ? courseTeachersForSubj[subject_code]
                    : Object.keys(teachers).map(Number))
                : (teachersForSubj[subject_code]?.length
                    ? teachersForSubj[subject_code]
                    : Object.keys(teachers).map(Number))
            );

            /* prefer teachers still under max hours (R6) */
            const available = candidates.filter(t => teacher_schedule[t] < teachers[t].max_hours);
            const pool = available.length ? available : candidates;
            const tCode = pool[Math.floor(Math.random() * pool.length)];

            /* random timeslot order */
            const times = [...loaded_data.timeslots];
            for (let i = times.length - 1; i > 0; --i) {
                const j = Math.floor(Math.random() * (i + 1));
                [times[i], times[j]] = [times[j], times[i]];
            }

            let chosenTime = null, chosenRoom = null;

            for (const ts of times) {

                const tm = ts.code;

                /* teacher busy? (R3) */
                if (teacherTime[tCode][tm]) continue;

                /* group busy? (R2) */
                const grpKey = gKey(year_code, group_code);
                if (groupTime[grpKey]?.[tm]) continue;

                /* subgroup‑main conflicts (R7) */
                if (group_code !== 0) {

                    if (groups[group_code].name.length === 1) { // main
                        const everyoneBusy = groupTime[gKey(year_code, 0)]?.[tm];
                        if (everyoneBusy) continue;

                        if (mainToSubs[group_code]) {
                            let conflict = false;
                            for (const sb of mainToSubs[group_code])
                                if (groupTime[gKey(year_code, sb)]?.[tm]) { conflict = true; break; }
                            if (conflict) continue;
                        }
                    } else { // sub
                        const main = subToMain[group_code];
                        if (groupTime[gKey(year_code, main)]?.[tm]) continue;
                    }
                } else { // group 0 (Everyone)
                    let conflict = false;
                    for (const mg of Object.values(groups).filter(g => g.name.length === 1 && g.code !== 0)) {
                        if (groupTime[gKey(year_code, mg.code)]?.[tm]) { conflict = true; break; }
                    }
                    if (conflict) continue;
                }

                /* find room */
                const freeRooms = roomsArr.filter(room =>
                    !roomTime[room.code]?.[tm] &&
                    room.possible_times.includes(tm) &&
                    (type !== 'course' || room.course_possible)
                );

                if (freeRooms.length === 0) continue;

                const rChosen = freeRooms[Math.floor(Math.random() * freeRooms.length)];

                chosenTime = tm;
                chosenRoom = rChosen.code;
                break;
            }

            if (chosenTime === null) {         /* desperate fallback */
                const randTS = loaded_data.timeslots[Math.floor(Math.random() * loaded_data.timeslots.length)];
                chosenTime = randTS.code;

                let fallbackRooms = type === 'course'
                    ? roomsArr.filter(r => r.course_possible && r.possible_times.includes(chosenTime))
                    : roomsArr.filter(r => r.possible_times.includes(chosenTime));

                if (fallbackRooms.length === 0) fallbackRooms = roomsArr;
                chosenRoom = fallbackRooms[Math.floor(Math.random() * fallbackRooms.length)].code;
            }

            assignment[idx] = { teacher: tCode, time: chosenTime, room: chosenRoom };

            /* track usage */
            teacher_schedule[tCode] += 1;
            teacherTime[tCode][chosenTime] = (teacherTime[tCode][chosenTime] || 0) + 1;
            const gk = gKey(year_code, group_code);
            if (!groupTime[gk]) groupTime[gk] = {};
            groupTime[gk][chosenTime] = (groupTime[gk][chosenTime] || 0) + 1;
            if (!roomTime[chosenRoom]) roomTime[chosenRoom] = {};
            roomTime[chosenRoom][chosenTime] = (roomTime[chosenRoom][chosenTime] || 0) + 1;
        }

        let currentCost = calculateCost(assignment);
        if (currentCost < globalBestCost) {
            globalBestCost = currentCost;
            globalBestAsg  = JSON.parse(JSON.stringify(assignment));
        }

        /* STEP 2: hill‑climb local improvements until stuck or time‑out ---- */
        let improved = true;

        while (improved && (Date.now() - startTime < timeOut)) {

            improved = false;

            for (let i = 0; i < classCount; ++i) {

                if (Date.now() - startTime > timeOut) break;

                const cls = class_list[i];
                const old = assignment[i];
                const { teacher: tOld, time: tmOld, room: rOld } = old;
                const yr = cls.year_code;

                let bestN = null, bestNCost = currentCost;

                /* ==== neighbour 1: change teacher =================================*/
                const candidateTs = (cls.type === 'course'
                    ? (courseTeachersForSubj[cls.subject_code]?.length
                        ? courseTeachersForSubj[cls.subject_code]
                        : Object.keys(teachers).map(Number))
                    : (teachersForSubj[cls.subject_code]?.length
                        ? teachersForSubj[cls.subject_code]
                        : Object.keys(teachers).map(Number))
                );

                for (const tNew of candidateTs) {
                    if (tNew === tOld) continue;

                    /* teacher already teaching something at tmOld? */
                    let busy = false;
                    for (let j = 0; j < classCount; ++j)
                        if (j !== i && assignment[j].teacher === tNew && assignment[j].time === tmOld) { busy = true; break; }
                    if (busy) continue;

                    /* clone & mutate */
                    const neigh = assignment.map(a => ({ ...a }));
                    neigh[i].teacher = tNew;
                    const cost = calculateCost(neigh);
                    if (cost < bestNCost) { bestNCost = cost; bestN = neigh; }
                }

                /* ==== neighbour 2: change time (+room) ============================*/
                for (const ts of loaded_data.timeslots) {
                    const tmNew = ts.code;
                    if (tmNew === tmOld) continue;

                    /* teacher busy? */
                    let tBusy = false;
                    for (let j = 0; j < classCount; ++j)
                        if (j !== i && assignment[j].teacher === tOld && assignment[j].time === tmNew) { tBusy = true; break; }
                    if (tBusy) continue;

                    /* group busy? (same‑year only) */
                    let gBusy = false;
                    for (let j = 0; j < classCount; ++j) {
                        if (j === i) continue;
                        if (assignment[j].time !== tmNew) continue;
                        if (class_list[j].year_code !== yr) continue;

                        const gOther = class_list[j].group_code;
                        const gThis  = cls.group_code;
                        if (gOther === gThis) { gBusy = true; break; }

                        /* Everyone vs others */
                        if ((gThis === 0 && gOther !== 0) || (gOther === 0 && gThis !== 0)) { gBusy = true; break; }

                        /* main vs sub (R7) */
                        if (groups[gThis].name.length === 1 && groups[gOther].name.length > 1 &&
                            String(gOther).startsWith(String(gThis))) { gBusy = true; break; }
                        if (groups[gOther].name.length === 1 && groups[gThis].name.length > 1 &&
                            String(gThis).startsWith(String(gOther))) { gBusy = true; break; }
                    }
                    if (gBusy) continue;

                    /* room search */
                    const free = roomsArr.filter(r =>
                        !assignment.find(a => a.time === tmNew && a.room === r.code) &&
                        r.possible_times.includes(tmNew) &&
                        (cls.type !== 'course' || r.course_possible)
                    );
                    if (free.length === 0) continue;

                    const rNew = free[0].code;

                    const neigh = assignment.map(a => ({ ...a }));
                    neigh[i].time = tmNew;
                    neigh[i].room = rNew;
                    const cost = calculateCost(neigh);
                    if (cost < bestNCost) { bestNCost = cost; bestN = neigh; }
                }

                /* ==== neighbour 3: change room ====================================*/
                for (const r of loaded_data.rooms) {
                    if (r.code === rOld) continue;
                    if (!r.possible_times.includes(tmOld)) continue;
                    if (cls.type === 'course' && !r.course_possible) continue;

                    /* room busy? */
                    let busy = false;
                    for (let j = 0; j < classCount; ++j)
                        if (j !== i && assignment[j].time === tmOld && assignment[j].room === r.code) { busy = true; break; }
                    if (busy) continue;

                    const neigh = assignment.map(a => ({ ...a }));
                    neigh[i].room = r.code;
                    const cost = calculateCost(neigh);
                    if (cost < bestNCost) { bestNCost = cost; bestN = neigh; }
                }

                /* ==== accept best neighbour if better =============================*/
                if (bestN && bestNCost < currentCost) {
                    assignment.splice(0, classCount, ...bestN);
                    currentCost = bestNCost;
                    improved = true;
                    break;  // restart scanning classes
                }
            }
        }

        /* ---- store global best ----------------------------------------- */
        if (currentCost < globalBestCost) {
            globalBestCost = currentCost;
            globalBestAsg  = JSON.parse(JSON.stringify(assignment));
            console.log(`Better timetable – cost ${globalBestCost}`);
        }
    }

    /* ------------------------------------------------------------------- */
    /* ===  build best_timetable object to return ========================= */
    /* ------------------------------------------------------------------- */
    current_timetable = {};
    if (globalBestAsg) {
        for (let i = 0; i < classCount; ++i) {
            const cls = class_list[i];
            const { teacher: T, time: tm, room: R } = globalBestAsg[i];
            if (!(T in current_timetable)) current_timetable[T] = {};
            current_timetable[T][tm] = [
                cls.group_code,
                R,
                cls.subject_code,
                cls.type,
                cls.year_code               // <<<<<< NEW field: academic year
            ];
        }
    }
    best_timetable = JSON.parse(JSON.stringify(current_timetable));
    return true;
}

/* ----------------------------------------------------------------------- */
/* ===  PUBLIC ENTRY POINT  ============================================== */
/* ----------------------------------------------------------------------- */
async function generateTimetableAndClasslist(new_extra_restrictions, teacher_id, oldTimetable) {
    const db = await getDatabaseAsJson();
    loaded_data = JSON.parse(db);

    loaded_data.extra_restrictions = new_extra_restrictions ?? {
        unpreferred_timeslots: {},
        max_daily_hours       : {}
    };

    if (oldTimetable != null)
        initializeData(oldTimetable.class_list);
    else
        initializeData(null);

    startTime = Date.now();
    const ok = generateTimetableHillClimbing();

    return ok ? {
        data             : best_timetable,
        class_list       : class_list,
        extra_restrictions
    } : null;
}

module.exports = { generateTimetableAndClasslist };
