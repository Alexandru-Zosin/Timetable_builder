import { showAlert } from '../utils/scripts/customAlert.js';
import { internalFetch } from '../utils/scripts/customFetch.js';

let groups = [], rooms = [], subjects = [], teachers = [], timeslots = [], role, tag, yeartag,
    groupMap = {}, teacherMap = {}, roomMap = {}, subjectMap = {}, timeslotMap = {};

let timetableData = {}; // holds all timetable info by G### or T##

let currentFilterType = 'group';   // or teacher
let currentFilterValue = null;      //  G101 or T2 or Tall or Gall
let currentFilterYear = 'all';     // 1, 2, 3, all
let currentClassType = 'all';     //  course, seminar, all
// day order used in sorting
const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

window.addEventListener('load', async function () {
    try {
        const validationResponse = await internalFetch("https://localhost:3000/validate", "POST", {});
        if (validationResponse.status == 200) {
            ({ role, tag, yeartag } = await validationResponse.json()); // not a block of code
        } else {
            window.location.href = "https://localhost/login/index.html";
            return;
        }

        let res; // could have used a better variable name
        const response = await internalFetch("https://localhost:3557/timetable", "GET");
        if (response.status == 200) {
            res = await response.json();
        } else {
            showAlert({ text: "Error: Can't retrieve the timetable.." });
        }
        // res.info -> general datatable structures
        groups = res.info.groups;
        rooms = res.info.rooms;
        subjects = res.info.subjects;
        teachers = res.info.teachers;
        timeslots = res.info.timeslots;
        // res.data -> the actual generated timetable
        const bestTimetable = res.data;

        // build a mapping to find details by code
        groups.forEach(g => groupMap[g.code] = g);
        teachers.forEach(t => teacherMap[t.code] = t);
        rooms.forEach(r => roomMap[r.code] = r);
        subjects.forEach(s => subjectMap[s.code] = s);
        timeslots.forEach(ts => timeslotMap[ts.code] = ts);

        //reshape timetable to timetable[T] or timetable[G]
        transformData(bestTimetable); 

        // UI selectors initialization
        populateSelectors();

        // we use the role, tag, yeartag to get the filters
        if (role === 'student') {
            currentFilterType = 'group';
            const selectTag = (Object.values(groupMap).filter(g => g.name === tag))[0].code; // 101, ...
            currentFilterValue = 'G' + selectTag; // ^for tData
            document.getElementById('group-select').value = selectTag;//option is automatically selected 
            currentFilterYear = yeartag?.toString();
            document.getElementById('year-select').value = yeartag;
            //
            hideConstraintForm(); // only available to teacher
        } else { // teacher or null
            currentFilterType = 'teacher';
            currentFilterValue = 'T' + tag;
            document.getElementById('teacher-select').value = tag; // goes black for admin (dep. on browser)
        }

        renderFilteredTimetable();

        // EVENT LISTENERS
        // class type (course/seminar/all)
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                currentClassType = this.dataset.filter;
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                renderFilteredTimetable();
            });
        });

        document.getElementById('group-select').addEventListener('change', function () {
            currentFilterType = 'group';
            currentFilterValue = (this.value === 'all') ? 'Gall' : ('G' + this.value);
            // whenever a group is picked, reset teacher selector
            document.getElementById('teacher-select').value = 'all'; // selects default html all tag
            renderFilteredTimetable();
        }); // this is dynamically bounded to the elem. ev. listener is attached to

        document.getElementById('year-select').addEventListener('change', function () {
            currentFilterYear = this.value;   // 1, 2, 3 or all
            renderFilteredTimetable();
        });

        document.getElementById('teacher-select').addEventListener('change', function () {
            currentFilterType = 'teacher';
            currentFilterValue = (this.value === 'all') ? 'Tall' : ('T' + this.value);
            // whenever a teacher is picked, reset group selector
            document.getElementById('group-select').value = 'all'; // selects default html all tag
            renderFilteredTimetable();
        });

        document.getElementById('logout-btn').addEventListener('click', async () => {
            const logoutRequest = await internalFetch("https://localhost:3000/logout", "POST", {});

            if (logoutRequest.status !== 200) {
                showAlert({ text: `Logout failed. ${response.status}` });
                return;
            }
            window.location.href = "https://localhost/login/index.html";
        });

        document.getElementById("prompt-btn").addEventListener('click', async () => {
            const constraint = document.getElementById("suggestion-details").value;
            const response = await internalFetch("https://localhost:3557/constraints", "POST", {
                name: teacherMap[tag].name,
                constraint: constraint
            });

            if (response.status == 409) {
                showAlert({ text: `You already made a request. Wait for it to be processed.` });
            } else if (response.status !== 201) {
                showAlert({ text: `Constraint was not successfully sent. ${response.status}` });
            } else {
                showAlert({ text: `Constraint was successfully created.` });
            }
            document.getElementById("suggestion-details").value = "";
        });
    } catch (error) {
        showAlert({ text: 'Error: ' + error });
    }
});

function transformData(bestTimetable) {
    // helper structures
    const initDayArray = (tmtbl, key, day) => { // helper fct to initiate timetable entries
        if (!tmtbl[key])    // key is T## or G###
            tmtbl[key] = {};
        if (!tmtbl[key][day])
            tmtbl[key][day] = [];
    };
    const subGroups = Object.keys(groupMap)
        .map(code => parseInt(code, 10)) // base 10
        .filter(code => code >= 100)
        .sort((a, b) => a - b);
    ///////////////////

    for (let tCode in bestTimetable) { // we read each timecode and push to both T## and G### timetableData
        const teacherCode = parseInt(tCode, 10);
        if (!timetableData["T" + teacherCode])
            timetableData["T" + teacherCode] = {};

        const teacherSchedule = bestTimetable[tCode];
        for (let timeCode in teacherSchedule) {
            const [groupCode, roomCode, subjectCode, classType, year] = teacherSchedule[timeCode];

            // extracting necessary information for a timeslot
            const day = timeslotMap[timeCode].day;
            const hourStr = timeslotMap[timeCode].hour; //"08:00" ---
            const startHour = parseInt(hourStr.slice(0, 2), 10); // 08:00 -> 08 = 8
            const endHour = startHour + 2; // a timeslot is for 2 hours
            const interval = `${String(startHour).padStart(2, '0')}-${String(endHour).padStart(2, '0')}`;
            // pad 8 to 08 of len 2
            const subj = subjectMap[subjectCode];
            const isOptional = (subj.is_optional === 1);
            const row = {
                Interval: interval,
                Subject: subj.name,
                Teacher: teacherMap[teacherCode]?.name,
                Room: roomMap[roomCode]?.name,
                Type: classType,
                Optional: isOptional,
                Year: year
            };

            // timetableData[T]
            initDayArray(timetableData, "T" + teacherCode, day);
            timetableData["T" + teacherCode][day].push(row);

            // timetableData[G]
            if (groupCode >= 100) { // for all subgroups (individually)
                const gKey = "G" + groupCode;
                initDayArray(timetableData, gKey, day);
                timetableData[gKey][day].push(row);

            } else if (groupCode === 0) { // for all subgroups (from everyone)
                for (const g of subGroups) {
                    const gKey = "G" + g;
                    initDayArray(timetableData, gKey, day);
                    timetableData[gKey][day].push(row);
                }

            } else { // for all subgroups (from main groups)
                for (const g of subGroups) {
                    if (Math.floor(g / 100) === groupCode) {
                        const gKey = "G" + g;
                        initDayArray(timetableData, gKey, day);
                        timetableData[gKey][day].push(row);
                    }
                }
            }
        }
    }

    // sort entries(rows) based on their intervals inside each timetableData[(G/T)key][day]
    for (let key in timetableData) { // for all teachers and groups in timetableData
        const dayEntries = timetableData[key];
        const sortedDayEntries = {};
        DAY_ORDER.forEach(d => {    
            if (dayEntries[d]) {
                dayEntries[d].sort((a, b) => {
                    const startA = parseInt(a.Interval.split('-')[0], 10);
                    const startB = parseInt(b.Interval.split('-')[0], 10);
                    return startA - startB;
                });
                sortedDayEntries[d] = dayEntries[d];
            }
        });
        timetableData[key] = sortedDayEntries;
    }
} // end transformData

// populates the group, teacher and year <select> elements
function populateSelectors() {
    const groupSelect = document.getElementById('group-select');
    const teacherSelect = document.getElementById('teacher-select');
    const yearSelect = document.getElementById('year-select');

    groupSelect.innerHTML = '<option value="all">Select Group</option>';
    teacherSelect.innerHTML = '<option value="all">Select Teacher</option>';
    yearSelect.innerHTML = `
       <option value="all">Select Year</option>
       <option value="1">Year 1</option>
       <option value="2">Year 2</option>
       <option value="3">Year 3</option>`;

    groups
        .filter(g => g.code >= 100) // only for subgroups
        .sort((a, b) => a.code - b.code)    // ascending ordering
        .forEach(g => {
            const option = document.createElement('option');
            option.value = g.code;        // 101
            option.textContent = g.name;  // A1
            groupSelect.appendChild(option);
        });

    teachers
        .sort((a, b) => a.code - b.code)
        .forEach(t => {
            const option = document.createElement('option');
            option.value = t.code;        // 2
            option.textContent = `${t.name} (${t.code})`;
            teacherSelect.appendChild(option);
        });
}

// renders the timetable based on current filters
function renderFilteredTimetable() {
    const timetableGrid = document.getElementById('timetable-grid');
    timetableGrid.innerHTML = ''; // resets all previous DOM elements used in the grid

    const distinctTeacherSelected = currentFilterType === 'teacher' && currentFilterValue !== 'Tall';
    const distinctGroupSelected = currentFilterType === 'group' && currentFilterValue !== 'Gall';
    const distinctYearSelected = currentFilterYear !== 'all';

    if ((!distinctYearSelected && !distinctTeacherSelected) || 
        (distinctYearSelected && !distinctTeacherSelected && !distinctGroupSelected)) {
        return; // don't render anything (1)
    }

    // timetableData for a T## or a G###, based on the currentFilterValue
    const timetableDataForKey = timetableData[currentFilterValue] || {};
    
    DAY_ORDER.forEach(day => { // // creating a dayColumn for each day
        const dayColumn = document.createElement('div');
        dayColumn.className = 'day-column';

        // adding overlapping entries to intervalMap structure 
        // and filtering all/seminar/course
        const entries = timetableDataForKey[day] || [];
        const intervalMap = {}; // to group overlapping entries
        entries.forEach(row => { // each entry: Interval, Subj, Teacher, Room, Type, Opt, Year
            const classTypeOk = (currentClassType === 'all' || row.Type === currentClassType);
            // if classtype = 'all', each row qualifies so they will all be included
            
            const yearOk = (currentFilterYear === 'all' || String(row.Year) === currentFilterYear);
            // all *could* be included for a group (overlapping years!)
            // but rendering is prevented by (1)
            
            if (classTypeOk && yearOk) {
                const interval = row.Interval;

                if (!intervalMap[interval]) 
                    intervalMap[interval] = [];
                intervalMap[interval].push(row);
            }  //  now intervalMap contains all rows(entries/timeslots) for the given key (T## or G###)
        });

        // actual adding of the rows to the dayColumn
        Object.entries(intervalMap).forEach(([interval, rows]) => {
            const [startStr, endStr] = interval.split('-');
            const startHour = parseInt(startStr, 10);
            const endHour = parseInt(endStr, 10);

            const topPosition = (startHour - 8) * 80;
            const height = (endHour - startHour) * 79;

            let index = 0;

            const multiple = rows.length > 1;

            const classCard = document.createElement('div');
            const currentRow = rows[index];
            const cardClass = currentRow.Optional ? 'optional' : currentRow.Type;
            classCard.className = `class-card ${cardClass}`;
            if (multiple) { // clickable or changeable slot
                classCard.classList.add('clickable-slot');
                classCard.innerHTML = `
            <div class="class-time">${interval} *</div>
            <div class="class-name">${currentRow.Subject}</div>
            <div class="class-info">
                <div class="class-teacher"><i class="fas fa-user"></i> ${currentRow.Teacher}</div>
                <div class="class-room"><i class="fas fa-map-marker-alt"></i> ${currentRow.Room}</div>
                <div class="class-type">${currentRow.Type}${currentRow.Optional ? ' (optional)' : ''}</div>
            </div>
        `;

                classCard.addEventListener('click', function () { // closure over main forLoop
                    index = (index + 1) % rows.length;
                    const r = rows[index];
                    const newCardClass = r.Optional ? 'optional' : r.Type;
                    classCard.className = `class-card ${newCardClass} clickable-slot`;
                    classCard.innerHTML = `
                <div class="class-time">${interval} *</div>
                <div class="class-name">${r.Subject}</div>
                <div class="class-info">
                    <div class="class-teacher"><i class="fas fa-user"></i> ${r.Teacher}</div>
                    <div class="class-room"><i class="fas fa-map-marker-alt"></i> ${r.Room}</div>
                    <div class="class-type">${r.Type}${r.Optional ? ' (optional)' : ''}</div>
                </div>
            `;
                });
            } else {
                classCard.innerHTML = `
            <div class="class-time">${interval}</div>
            <div class="class-name">${currentRow.Subject}</div>
            <div class="class-info">
                <div class="class-teacher"><i class="fas fa-user"></i> ${currentRow.Teacher}</div>
                <div class="class-room"><i class="fas fa-map-marker-alt"></i> ${currentRow.Room}</div>
                <div class="class-type">${currentRow.Type}${currentRow.Optional ? ' (optional)' : ''}</div>
            </div>
        `;
            }

            classCard.style.top = `${topPosition}px`;
            classCard.style.height = `${height}px`;
            dayColumn.appendChild(classCard);
        });
        timetableGrid.appendChild(dayColumn);
    });
}

function hideConstraintForm() {
    const formSelector = document.getElementById("footer");
    formSelector.style.display = 'none';
}