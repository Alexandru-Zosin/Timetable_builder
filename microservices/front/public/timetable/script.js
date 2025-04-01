let groups = [];
let rooms = [];
let subjects = [];
let teachers = [];
let timeslots = [];

// This will hold all timetable info keyed by "G###" (group) or "T##" (teacher).
// e.g. timetableData["G101"] -> { Monday: [...], Tuesday: [...], ... }
//      timetableData["T2"]   -> { Monday: [...], Tuesday: [...], ... }
let timetableData = {};

// UI filter state
let currentFilterType = null;        // 'group' or 'teacher'
let currentFilterValue = null;       // e.g. "G101" or "T2"
let currentClassType = 'all';        // 'course', 'seminar', 'all'

// Day order used in sorting
const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

window.onload = async function () {
  try {
    // Fetch the timetable from your backend
    const response = await fetch('https://localhost:3557/timetable', {
      method: 'GET',
      credentials: 'include',
      mode: 'cors',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      }
    });
    const data = await response.json();

    groups    = data.info.groups;
    rooms     = data.info.rooms;
    subjects  = data.info.subjects;
    teachers  = data.info.teachers;
    timeslots = data.info.timeslots;

    const bestTimetable = data.data;

    // Build a mapping (object or Map) to find details by code quickly
    const groupMap    = {};
    const teacherMap  = {};
    const roomMap     = {};
    const subjectMap  = {};
    const timeslotMap = {};

    groups.forEach(g => groupMap[g.code] = g);
    teachers.forEach(t => teacherMap[t.code] = t);
    rooms.forEach(r => roomMap[r.code] = r);
    subjects.forEach(s => subjectMap[s.code] = s);
    timeslots.forEach(ts => timeslotMap[ts.code] = ts);

    // Transform data into the final timetableData
    transformData(bestTimetable, groupMap, teacherMap, roomMap, subjectMap, timeslotMap);

    // Populate the dropdown selectors
    populateSelectors();

    // Default: no particular selection, or pick "all" for group
    // but let's do an initial render with no filter selected.
    currentFilterType = 'group';
    currentFilterValue = 'Gall';  // a placeholder if you want "all" by default
    renderFilteredTimetable();

    // Listen for filter by class type (course/seminar/all)
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        currentClassType = this.dataset.filter;  // 'course', 'seminar', or 'all'
        // Toggle active class
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');

        renderFilteredTimetable();
      });
    });

    // Listen for group selector changes
    document.getElementById('group-select').addEventListener('change', function () {
      // If user picks a group, switch filterType to 'group'
      currentFilterType = 'group';
      if (this.value === 'all') {
        currentFilterValue = 'Gall';  // you can define a special "all" if you wish
      } else {
        currentFilterValue = 'G' + this.value;
      }

      // Reset teacher selector
      document.getElementById('teacher-select').value = 'all';

      renderFilteredTimetable();
    });

    // Listen for teacher selector changes
    document.getElementById('teacher-select').addEventListener('change', function () {
      // If user picks a teacher, switch filterType to 'teacher'
      currentFilterType = 'teacher';
      if (this.value === 'all') {
        currentFilterValue = 'Tall'; // define if you'd like "all teachers"
      } else {
        currentFilterValue = 'T' + this.value;
      }

      // Reset group selector
      document.getElementById('group-select').value = 'all';

      renderFilteredTimetable();
    });

  } catch (error) {
    console.error('Error loading timetable data:', error);
  }
};

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
  // Helper to initialize day->[] structure
  const initDayArray = (obj, key, day) => {
    if (!obj[key]) {
      obj[key] = {};
    }
    if (!obj[key][day]) {
      obj[key][day] = [];
    }
  };

  // A quick way to get all group codes that are >=100
  // or group codes that share the same hundred block.
  const allFullGroups = Object.keys(groupMap)
    .map(code => parseInt(code, 10))
    .filter(code => code >= 100) // only real subgroups
    .sort((a, b) => a - b);

  // For each teacher code
  for (let tCode in bestTimetable) {
    const teacherCode = parseInt(tCode, 10);
    // Ensure we have an entry for this teacher
    if (!timetableData["T" + teacherCode]) {
      timetableData["T" + teacherCode] = {};
    }

    // This teacher's schedule
    const teacherSchedule = bestTimetable[tCode];

    // For each time code in this teacher's schedule
    for (let timeCode in teacherSchedule) {
      const [groupCode, roomCode, subjectCode, classType] = teacherSchedule[timeCode];

      const day     = timeslotMap[timeCode].day;
      const hourStr = timeslotMap[timeCode].hour;  // e.g. "08:00"
      // Let’s assume each timeslot is 2 hours, so Interval is e.g. "08-10"
      const startHour = parseInt(hourStr.slice(0, 2), 10);
      const endHour   = startHour + 2;
      const interval  = `${String(startHour).padStart(2, '0')}-${String(endHour).padStart(2, '0')}`;

      // Build the row
      const subj       = subjectMap[subjectCode];
      const isOptional = (subj.is_optional === 1);
      const row = {
        Interval: interval,
        Subject: subj.name,
        Teacher: teacherMap[teacherCode]?.name ?? ("Teacher " + teacherCode),
        Room: roomMap[roomCode]?.name ?? ("Room " + roomCode),
        Type: classType,        // 'course' or 'seminar'
        Optional: isOptional
      };

      // 1) Add to teacher's timetable
      initDayArray(timetableData, "T" + teacherCode, day);
      timetableData["T" + teacherCode][day].push(row);

      // 2) Add to group(s) timetable
      if (groupCode >= 100) {
        // It's a real group code
        const key = "G" + groupCode;
        initDayArray(timetableData, key, day);
        timetableData[key][day].push(row);

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

  // Now sort the entries in each day by start time
  for (let key in timetableData) {
    const dayObj = timetableData[key];
    // dayObj is like { Monday: [...], Tuesday: [...], ... }
    // Sort day keys by our DAY_ORDER
    const sortedDayObj = {};
    DAY_ORDER.forEach(d => {
      if (dayObj[d]) {
        // Sort by the numeric start hour
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

/**
 * Populate the group and teacher <select> elements.
 */
function populateSelectors() {
  const groupSelect   = document.getElementById('group-select');
  const teacherSelect = document.getElementById('teacher-select');

  // Clear them if needed
  groupSelect.innerHTML = '<option value="all">Select Group</option>';
  teacherSelect.innerHTML = '<option value="all">Select Teacher</option>';

  // Add each 3-digit group
  groups
    .filter(g => g.code >= 100)
    .sort((a, b) => a.code - b.code)
    .forEach(g => {
      const option = document.createElement('option');
      option.value = g.code;       // e.g. '101'
      option.textContent = g.name; // e.g. 'A1'
      groupSelect.appendChild(option);
    });

  // Add each teacher
  teachers
    .sort((a, b) => a.code - b.code)
    .forEach(t => {
      const option = document.createElement('option');
      option.value = t.code;         // e.g. '2'
      option.textContent = t.name;   // e.g. 'Conf. dr. ...'
      teacherSelect.appendChild(option);
    });
}

/**
 * Renders the timetable based on currentFilterValue ("G..." or "T...") and currentClassType.
 */
function renderFilteredTimetable() {
  const timetableGrid = document.getElementById('timetable-grid');
  timetableGrid.innerHTML = '';

  // We’ll show Monday..Friday columns
  // If no data or user picks 'all' with no logic, just show empty columns
  const dataForKey = timetableData[currentFilterValue] || {};

  // Create 5 columns for each day in order
  DAY_ORDER.forEach(day => {
    const dayColumn = document.createElement('div');
    dayColumn.className = 'day-column';

    // For each row in day
    const entries = dataForKey[day] || []; // might be empty
    entries.forEach(row => {
      // Filter by classType if needed
      // row.Type is 'course' or 'seminar'
      if (currentClassType === 'all' || row.Type === currentClassType) {
        const [startStr, endStr] = row.Interval.split('-');
        const startHour = parseInt(startStr, 10);
        const endHour   = parseInt(endStr, 10);

        // Each hour = 80px in height (example)
        const topPosition = (startHour - 8) * 80;  // e.g. 8 => 0, 9 => 80, etc.
        const height      = (endHour - startHour) * 79;

        const classCard = document.createElement('div');
        // If it's optional, we apply 'optional' else row.Type
        const cardClass = row.Optional ? 'optional' : row.Type; // 'course', 'seminar', or 'optional'

        classCard.className = `class-card ${cardClass}`;
        classCard.style.top    = `${topPosition}px`;
        classCard.style.height = `${height}px`;

        classCard.innerHTML = `
          <div class="class-time">${row.Interval}</div>
          <div class="class-name">${row.Subject}</div>
          <div class="class-info">
            <div class="class-teacher"><i class="fas fa-user"></i> ${row.Teacher}</div>
            <div class="class-room"><i class="fas fa-map-marker-alt"></i> ${row.Room}</div>
            <div class="class-type">${row.Type}${row.Optional ? ' (optional)' : ''}</div>
          </div>
        `;
        dayColumn.appendChild(classCard);
      }
    });

    timetableGrid.appendChild(dayColumn);
  });
}
