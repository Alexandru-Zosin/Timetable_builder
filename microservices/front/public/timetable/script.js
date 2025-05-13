let groups = [],
    rooms = [],
    subjects = [],
    teachers = [],
    timeslots = [],
    role,
    tag,
    yeartag,                      
    groupMap = {},
    teacherMap = {},
    roomMap = {},
    subjectMap = {},
    timeslotMap = {};

// this will hold all timetable info by "G###" (group) or "T##" (teacher)
let timetableData = {};

let currentFilterType = 'group';   // 'group' or 'teacher'
let currentFilterValue = null;      //  "G101" or "T2"
let currentClassType = 'all';     //  'course', 'seminar', 'all'
let currentYearFilter = 'all';     // === NEW ===  '1', '2', '3', 'all'

// day order used in sorting
const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

/* ------------------------------------------------------------------ */
window.addEventListener('load', async function () {
    try {
        /* ------------ 1. authentication ------------- */
        const validationResponse = await fetch("https://localhost:3000/validate", {
            method: 'POST',
            credentials: 'include',
            mode: 'cors',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        });

        if (validationResponse.status == 200) {
            ({ role, tag, yeartag } = await validationResponse.json()); // () to not confuse a block of code
        } else {
            window.location.href = "https://localhost/login/index.html";
            return;
        }

        const response = await fetch('https://localhost:3557/timetable', {
            method: 'GET',
            credentials: 'include',
            mode: 'cors',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            }
        });
        let data;
        if (response.status == 200) {
            data = await response.json();
        } else {
            Swal.fire({
                text: "Error: Can't retrieve the timetable..",
                customClass: {
                    popup: 'custom-swal',
                },
                showConfirmButton: false,
                timer: 1500
            });
        }

        groups = data.info.groups;
        rooms = data.info.rooms;
        subjects = data.info.subjects;
        teachers = data.info.teachers;
        timeslots = data.info.timeslots;

        const bestTimetable = data.data;

        // build a mapping (object or Map) to find details by code quickly
        groups.forEach(g => groupMap[g.code] = g);
        teachers.forEach(t => teacherMap[t.code] = t);
        rooms.forEach(r => roomMap[r.code] = r);
        subjects.forEach(s => subjectMap[s.code] = s);
        timeslots.forEach(ts => timeslotMap[ts.code] = ts);

        /* ------------ 4. reshape timetable ------------ */
        transformData(bestTimetable, groupMap, teacherMap, roomMap, subjectMap, timeslotMap);

        /* ------------ 5. UI initialisation ------------ */
        populateSelectors();

        if (role === 'student') {
            currentFilterType = 'group';
            const selectTag = (Object.values(groupMap).filter(g => g.name === tag))[0].code;
            currentFilterValue = 'G' + selectTag;
            document.getElementById('group-select').value = selectTag;

            /* pick the student’s year automatically */
            if (yeartag !== undefined) {                          // === NEW ===
                currentYearFilter = yeartag.toString();
                document.getElementById('year-select').value = yeartag;
            }

            hideConstraintForm();
        } else { /* teacher */
            currentFilterType = 'teacher';
            currentFilterValue = 'T' + tag;
            document.getElementById('teacher-select').value = tag;
        }

        // default: no particular selection, or pick "all" for group
        // but let's do an initial render with no filter selected.
        //currentFilterType = 'group';
        //currentFilterValue = 'Gall';  // a placeholder if you want "all" by default
        renderFilteredTimetable();

        // EVENT LISTENERS
        // Listen for filter by class type (course/seminar/all)
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                currentClassType = this.dataset.filter;      // 'course' / 'seminar' / 'all'
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                renderFilteredTimetable();
            });
        });

        document.getElementById('group-select').addEventListener('change', function () {
            // if user picks a group, switch filterType to 'group'
            currentFilterType = 'group';
            currentFilterValue = (this.value === 'all') ? 'Gall' : ('G' + this.value);

            /* whenever a group is picked, reset teacher selector */
            document.getElementById('teacher-select').value = 'all';
            renderFilteredTimetable();
        });

        /* === NEW ===  year selector */
        document.getElementById('year-select').addEventListener('change', function () {
            currentYearFilter = this.value;   // '1' / '2' / '3' / 'all'
            renderFilteredTimetable();
        });

        /* teacher selector */
        document.getElementById('teacher-select').addEventListener('change', function () {
            currentFilterType = 'teacher';
            currentFilterValue = (this.value === 'all') ? 'Tall' : ('T' + this.value);

            /* whenever a teacher is picked, reset group selector */
            document.getElementById('group-select').value = 'all';
            renderFilteredTimetable();
        });

        document.getElementById('logout-btn').addEventListener('click', async () => {
            const logoutRequest = await fetch("https://localhost:3000/logout",
                {
                    method: "POST",
                    credentials: "include",
                    mode: "cors",
                    headers: {
                        "Accept": "application/json",
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({})
                }
            );
            if (logoutRequest.status !== 200) {
                Swal.fire({
                    text: `Logout failed. ${response.status}`,
                    customClass: {
                        popup: 'custom-swal',
                    },
                    showConfirmButton: false,
                    timer: 1500
                });
                return;
            }
            window.location.href = "https://localhost/login/index.html";
        });

        document.getElementById("prompt-btn").addEventListener('click', async () => {
            const constraint = document.getElementById("suggestion-details").value;
            const response = await fetch("https://localhost:3557/constraints", {
                method: "POST",
                credentials: "include",
                mode: "cors",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    name: teacherMap[tag].name,
                    constraint: constraint
                })
            });
            if (response.status == 409) {
                Swal.fire({
                    text: `You already made a request. Wait for it to be processed.`,
                    customClass: {
                        popup: 'custom-swal',
                    },
                    showConfirmButton: false,
                    timer: 1500
                });
            } else if (response.status !== 201) {
                Swal.fire({
                    text: `Constraint was not successfully sent. ${response.status}`,
                    customClass: {
                        popup: 'custom-swal',
                    },
                    showConfirmButton: false,
                    timer: 1500
                });
            } else {
                Swal.fire({
                    text: `Constraint was successfully created.`,
                    customClass: {
                        popup: 'custom-swal',
                    },
                    showConfirmButton: false,
                    timer: 1500
                });
            }
            document.getElementById("suggestion-details").value = "";
        });
    } catch (error) {
        Swal.fire({
            text: 'Error: ' + error,
            customClass: {
                popup: 'custom-swal',
            },
            showConfirmButton: false,
            timer: 1500
        });
    }
});

/**
 * Build timetableData keyed by "G..." or "T...".
 * For each teacher_code in bestTimetable:
 *   - We read each time_code in bestTimetable[teacher_code],
 *   - We push to that teacher's schedule (timetableData["T" + teacher_code]),
 *   - We also push to the appropriate group(s) schedule.
 *
 * group_code == 0 => replicate to all 3-digit groups
 * group_code < 10 and != 0 => replicate to all that match that hundred block
 * e.g. group_code = 1 => replicate to 101,102,103,...
 */
function transformData(bestTimetable, groupMap, teacherMap, roomMap, subjectMap, timeslotMap) {
    // helper – initialise nested structure
    const initDayArray = (obj, key, day) => {
        if (!obj[key]) obj[key] = {};
        if (!obj[key][day]) obj[key][day] = [];
    };

    // quick way to get all group codes that are >=100
    // or group codes that share the same hundred block.
    const allFullGroups = Object.keys(groupMap)
        .map(code => parseInt(code, 10))
        .filter(code => code >= 100)
        .sort((a, b) => a - b);

    for (let tCode in bestTimetable) {
        const teacherCode = parseInt(tCode, 10);
        // ensure we have an entry for this teacher
        if (!timetableData["T" + teacherCode]) {
            timetableData["T" + teacherCode] = {};
        }

        const teacherSchedule = bestTimetable[tCode];

        for (let timeCode in teacherSchedule) {
            /* ------------ DESTRUCTURE -------------
               [groupCode, roomCode, subjectCode, classType, year]          === NEW === */
            const [groupCode, roomCode, subjectCode, classType, year] = teacherSchedule[timeCode];

            const day = timeslotMap[timeCode].day;
            const hourStr = timeslotMap[timeCode].hour; 
            // assume each timeslot is 2 hours, so interval is e.g. "08-10"
            const startHour = parseInt(hourStr.slice(0, 2), 10);
            const endHour = startHour + 2;
            const interval = `${String(startHour).padStart(2, '0')}-${String(endHour).padStart(2, '0')}`;

            // build the row
            const subj = subjectMap[subjectCode];
            const isOptional = (subj.is_optional === 1);

            /* row now carries the Year so we can filter later */
            const row = {
                Interval: interval,
                Subject: subj.name,
                Teacher: teacherMap[teacherCode]?.name ?? ("Teacher " + teacherCode),
                Room: roomMap[roomCode]?.name ?? ("Room " + roomCode),
                Type: classType,            // 'course' / 'seminar'
                Optional: isOptional,
                Year: year                  // === NEW ===
            };

            /* ---- 1) teacher timetable ---- */
            initDayArray(timetableData, "T" + teacherCode, day);
            timetableData["T" + teacherCode][day].push(row);

            /* ---- 2) replicate to groups (logic unchanged) ---- */
            if (groupCode >= 100) {
                const gKey = "G" + groupCode;
                initDayArray(timetableData, gKey, day);
                timetableData[gKey][day].push(row);

            } else if (groupCode === 0) {
                // group_code = 0 => replicate to everyone
                for (const g of allFullGroups) {
                    const gKey = "G" + g;
                    initDayArray(timetableData, gKey, day);
                    timetableData[gKey][day].push(row);
                }

            } else {
                // groupCode < 10 and != 0 => replicate to that hundred range
                // e.g. groupCode = 1 => all 1xx
                // e.g. groupCode = 2 => all 2xx
                const hundred = groupCode; // 1 => 100..199, 2 => 200..299
                for (const g of allFullGroups) {
                    if (Math.floor(g / 100) === hundred) {
                        const gKey = "G" + g;
                        initDayArray(timetableData, gKey, day);
                        timetableData[gKey][day].push(row);
                    }
                }
            }
        }
    }

    /* ---- sort entries chronologically ---- */
    for (let key in timetableData) {
        const dayObj = timetableData[key];
        const sortedDayObj = {};
        DAY_ORDER.forEach(d => {
            if (dayObj[d]) {
                dayObj[d].sort((a, b) => {
                    const startA = parseInt(a.Interval.split('-')[0], 10);
                    const startB = parseInt(b.Interval.split('-')[0], 10);
                    return startA - startB;
                });
                sortedDayObj[d] = dayObj[d];
            }
        });
        timetableData[key] = sortedDayObj;
    }
}

/* ------------------------------------------------------------------ */
/** populate the group, teacher *and year* <select> elements */
function populateSelectors() {
    const groupSelect = document.getElementById('group-select');
    const teacherSelect = document.getElementById('teacher-select');
    const yearSelect = document.getElementById('year-select');          // === NEW ===

    groupSelect.innerHTML = '<option value="all">Select Group</option>';
    teacherSelect.innerHTML = '<option value="all">Select Teacher</option>';
    yearSelect.innerHTML = `
       <option value="all">Select Year</option>
       <option value="1">Year 1</option>
       <option value="2">Year 2</option>
       <option value="3">Year 3</option>`;

    groups
        .filter(g => g.code >= 100)
        .sort((a, b) => a.code - b.code)
        .forEach(g => {
            const option = document.createElement('option');
            option.value = g.code;        // '101'
            option.textContent = g.name;  // 'A1'
            groupSelect.appendChild(option);
        });

    teachers
        .sort((a, b) => a.code - b.code)
        .forEach(t => {
            const option = document.createElement('option');
            option.value = t.code;        // '2'
            option.textContent = `${t.name} (${t.code})`;
            teacherSelect.appendChild(option);
        });
}

/* ------------------------------------------------------------------ */
/** renders the timetable based on current filters */
function renderFilteredTimetable() {
    const timetableGrid = document.getElementById('timetable-grid');
    timetableGrid.innerHTML = '';

    // === STRICT FILTER RULES ===
    const teacherSelected = currentFilterType === 'teacher' && currentFilterValue !== 'Tall';
    const groupSelected = currentFilterType === 'group' && currentFilterValue !== 'Gall';
    const yearSelected = currentYearFilter !== 'all';

    if (
        (!yearSelected && !teacherSelected) ||     // No year → must have a teacher
        (yearSelected && !teacherSelected && !groupSelected) // Year selected → need group or teacher
    ) {
        return; // Don't render anything
    }

    const dataForKey = timetableData[currentFilterValue] || {};

    DAY_ORDER.forEach(day => {
        const dayColumn = document.createElement('div');
        dayColumn.className = 'day-column';

        const entries = dataForKey[day] || [];
        entries.forEach(row => {

            /* --- FILTERS -------------------------------------------------- */
            const classTypeOk = (currentClassType === 'all' || row.Type === currentClassType);
            const yearOk = (currentYearFilter === 'all' || String(row.Year) === currentYearFilter); // === NEW ===

            if (classTypeOk && yearOk) {
                const [startStr, endStr] = row.Interval.split('-');
                const startHour = parseInt(startStr, 10);
                const endHour = parseInt(endStr, 10);

                // each hour = 80px in height
                const topPosition = (startHour - 8) * 80;
                const height = (endHour - startHour) * 79;

                const classCard = document.createElement('div');
                // if it's optional, we apply 'optional' else row.Type
                const cardClass = row.Optional ? 'optional' : row.Type; // 'course', 'seminar', or 'optional'

                classCard.className = `class-card ${cardClass}`;
                classCard.style.top = `${topPosition}px`;
                classCard.style.height = `${height}px`;

                classCard.innerHTML = `
                   <div class="class-time">${row.Interval}</div>
                   <div class="class-name">${row.Subject}</div>
                   <div class="class-info">
                       <div class="class-teacher"><i class="fas fa-user"></i> ${row.Teacher}</div>
                       <div class="class-room"><i class="fas fa-map-marker-alt"></i> ${row.Room}</div>
                       <div class="class-type">${row.Type}${row.Optional ? ' (optional)' : ''}</div>
                   </div>`;
                dayColumn.appendChild(classCard);
            }
        });

        timetableGrid.appendChild(dayColumn);
    });
}

function hideConstraintForm() {
    const formSelector = document.getElementById("footer");
    formSelector.style.display = 'none';
}