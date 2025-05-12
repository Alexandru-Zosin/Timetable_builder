const { getDatabaseAsJson } = require("../utils/downloadDatabases");

let groups, rooms, teachers, subjects, timeslots, extra_restrictions;
const TIMEOUT = 60000;
const HARD_VIOLATION_WEIGHT = 30;

class_list = [];

async function initializeData() {
    loaded_data = JSON.parse(await getDatabaseAsJson());

    groups = Object.fromEntries(loaded_data.groups.map(group => [group.code, group]));
    rooms = Object.fromEntries(loaded_data.rooms.map(room => [room.code, room]));
    teachers = Object.fromEntries(loaded_data.teachers.map(teacher => [teacher.code, teacher]));
    subjects = Object.fromEntries(loaded_data.subjects.map(subject => [subject.code, subject]));
    timeslots = Object.fromEntries(loaded_data.timeslots.map(time => [time.code, time]));
    extra_restrictions = loaded_data.extra_restrictions;

    // builds the list of classes to schedule (courses & seminars)
    // iterates through all subjects and adds one course and one seminar for each group (or subgroup) as needed
    // group_code == 0 means EVERYONE (the whole cohort, used for courses of optional subjects)    for (const subject in Object.values(subjects)) {
    for (const subject of Object.values(subjects)) {  
        if (subject.is_optional) {
            class_list.push({
                type: 'course',
                subject_code: subject.code,
                group_code: 0
            });
            
            const main_groups = Object.values(groups).filter(group => group.name.length === 1);
            for (const main_group of main_groups)
                class_list.push({
                    type: 'seminar',
                    subject_code: subject.code,
                    group_code: main_group.code
                }); 
        } else {
            const main_groups = Object.values(groups).filter(group => group.name.length === 1);
            for (const main_group of main_groups)
                class_list.push({
                    type: 'course',
                    subject_code: subject.code,
                    group_code: main_group.code
                });

            const sub_groups = Object.values(groups).filter(group => group.code > 100);
            for (const sub_group of sub_groups)
                class_list.push({
                    type: 'seminar',
                    subject_code: subject.code,
                    group_code: sub_group.code
                }); 
        }
    }
    class_list.sort((a, b) => Math.random() - 0.5);

    best_timetable = null;
}

function calculateCost(assignment) {
    let hardViolations = 0;
    let softViolations = 0;

    for (let i = 0; i < class_list.length; i++) {
        const subject_code = cls.subject_code;
        const group_code = cls.group_code;
        const class_type = cls.type;
        
        const teacher_code = assignment[i].teacher_code;
        const time_code = assignment[i].time_code;
        const room_code = assignment[i].room_code;

        
    }
    

}

function generateTimetableHillClimbing() {
    /*
    Restrictions (MANDATORY):
    #  R1) Mandatory subjects are assigned to each group.                          ###DONE
    #  R2) No overlapping classes for the same group at the same time.             ###DONE
    #  R3) A teacher does not teach two classes at the same time.                  ###DONE
    #  R4) A room must be available to the university at the given time.           ###DONE
    #R4.1) A room cannot have two classes at the same time.                        ###DONE
    #  R5) A course must be taught in a room that supports courses.                ###DONE
    #  R6) A professor cannot exceed max teaching hours.                           ###DONE
    #  R7) A course can be taught only by an eligible teacher.
    #  R8) A subgroup cannot have classes when maingroup does
    Extra restrictions (POSSIBLE):
    #-----#
    #  E1) A professor can have a number of maximum daily teaching hours           ###DONE
    #  E2) A professor can have unpreferred timeslots                              ###DONE
    */

    // First step of the algorithm: building a starting point timetable
    const teachersForSubject = {};
    const courseTeachersForSubject = {};
    for (const subject_code in subjects) {
        teachersForSubject[subject_code] = []
        courseTeachersForSubject[subject_code] = []
    }
    for (const teacher_code in teachers) {
        for (const subject_code of subjects_taught) {
            teachersForSubject[subject_code].push(teacher_code);
            if (teachers[teacher_code].can_teach_course)
                courseTeachersForSubject[subject_code].push(teacher_code);
        }
    }

    const mainCodeByName = {}; //for each name ([0]), give main_code 
    const mainToSubs = {}; // for each main_group_code give subs
    const subToMain = {}; //  for each sub_group_code give MAIN
    
    for (const group of groups) {
        if(group.name.length === 1 && group.code != 0) {
            mainCodeByName[group.name[0]] = group.code;
            mainToSubs[group.code] = [];
        }
    }

    for (const group of groups) {
        if (group.name.length > 1 && group.code != 0) {
            const mainName = group.name[0];
            const mainCode = mainCodeByName[mainName];

            if (mainCode != null) {
                mainToSubs[mainCode].push(group.code);
                subToMain[group.code] = mainCode;
            }
        }
    }

    // Running the algorithm until the timeout:
    // Random Restart Hill Climbing
    startTime = Date.now();
    while (Date.now() - startTime < TIMEOUT) {
        // Generate an initial 'random' solution
        let assignment = [];
        const teachersHoursCount = {};
        const teacherOccupiedTimeslots = {};
        const groupOccupiedTimeslots = {};
        const roomOccupiedTimeslots = {};

        for (const tCode in teachers) {
            teacherOccupiedTimeslots[tCode] = new Set();
            teachersHoursCount[tCode] = 0;
        }

        for (const gCode in groups)
            groupOccupiedTimeslots[gCode] = new Set();

        for (const rCode in rooms)
            roomOccupiedTimeslots[rCode] = new Set();

        let chosenTeacherCode, chosenTimeCode, chosenRoomCode;
        // Restarting step (creating a new random initial solution)
        // Base case: if we've processed all classes, success (R1)
        for (let i = 0; i < class_list.length; i++) {
            // I. Choosing a random teacher
            const subject_code = class_list[i].subject_code;
            const group_code = class_list[i].group_code;
            const class_type = class_list[i].class_type;
            
            //R7: courses are only for elligible teachers
            let elligibleTeachers = (class_type === 'course') ? courseTeachersForSubject[subject_code] : teachersForSubject[subject_code];
            if (!elligibleTeachers) // if empty, we consider all teachers
                elligibleTeachers = Object.keys(teachers);
        
            //R6: can't exceed max hours
            elligibleTeachers = elligibleTeachers.filter(tCode => teachersHoursCount[tCode] < teachers[tCode].max_hours)
            if (!elligibleTeachers) // if empty, we consider all teachers (Randomly assign)
                elligibleTeachers = Object.keys(teachers);

            chosenTeacherCode = elligibleTeachers[Math.floor(Math.random() * elligibleTeachers.length)];
            
            // II. Choosing a random timeslot & room
            const timeslotsShuffled = Object.keys(timeslots).sort(() => Math.random() - 0.5);
            for (const time_code of timeslotsShuffled) {
                // R2) No overlapping classes for the same group at the same time.            
                // Here we need to add main group seminar to subgroups at least
                if (groupOccupiedTimeslots[group_code].has(time_code))
                    continue;
                // R3) A teacher does not teach two classes at the same time.    
                if (teacherOccupiedTimeslots[chosenTeacherCode].has(time_code))
                    continue;
                
                // R8) A subgroup cannot have classes when maingroup does
                if (groups[group_code].name.length === 1) {
                    let conflict = false;
                    for (const sub_g_code of mainToSubs[group_code])
                        if (groupOccupiedTimeslots[sub_g_code].has(time_code)) {
                            conflict = true;
                            break;
                        }
                    
                    if (conflict)
                        continue;
                } else if (group_code > 100) {
                    let conflict = false;
                    const main_g_code = subToMain[group_code];
                    if (groupOccupiedTimeslots[main_g_code]) {
                        conflict = true;
                        break;
                    }

                    if (conflict)
                        continue;
                }

                // R5) A course must be taught in a room that supports courses.
                let elligibleRooms = (class_type === 'course') ? 
                Object.values(rooms).filter(room => room.course_possible).map(room => room.code) 
                : Object.values(rooms).map(room => room.code);
                
                // R4) A room must be available to the university at the given time.
                elligibleRooms = elligibleRooms.filter(rCode => rooms[rCode].possibleTimes.includes(chosenTimeCode));

                // R4.1) A room cannot have two classes at the same time.   
                elligibleRooms = elligibleRooms?.filter(rCode => !roomOccupiedTimeslots[rCode].has(chosenTimeCode));
                
                if (elligibleRooms.length === 0)
                    continue; // if so, we try with the next random assignment
                
                chosenTimeCode = time_code;
                chosenRoomCode = elligibleRooms[Math.floor(Math.random() * elligibleRooms.length)];
            } // end for time x room loop

            // If we have no option, we Randomly Assign
            if (chosenTimeCode === null || chosenRoomCode === null) {
                chosenTimeCode = Object.keys(timeslots)[Math.floor(Math.random() * Object.keys(timeslots).length)]

                elligibleRooms = (class_type === 'course')
                    ? Object.values(rooms).filter(room => room.course_possible && room.possible_times.includes(time_code)).map(room => room.code)
                    : Object.values(rooms).filter(room => room.possible_times.includes(time_code)).map(room => room.code);
                if (elligibleTeachers.length === 0)
                    elligibleRooms = Object.values(rooms).map(room => room.code); // as a last resort, allow any room

                chosenRoomCode = elligibleRooms[Math.floor(Math.random() * elligibleRooms.length)];
            }

            // We complete by making the assignment
            assignment[i] = {
                teacher_code: chosenTeacherCode,
                time_code: chosenTimeCode,
                room_code: chosenRoomCode
            }

            teacherOccupiedTimeslots[chosenTeacherCode].add(chosenTimeCode);
            teachersHoursCount[chosenTeacherCode] += 1;
            groupOccupiedTimeslots[group_code].add(chosenTimeCode);
            roomOccupiedTimeslots[chosenRoomCode].add(chosenTimeCode);
        }

        // Performing the hillclimbing
    }

}

initializeData();