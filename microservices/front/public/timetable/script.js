// Load sample timetable data - Replace this with your actual data loading
loadTimetableData()
    .then(data => {
        renderTimetable(data);
    })
    .catch(error => {
        console.error('Error loading timetable data:', error);
    });

// Initialize event listeners
initializeEventListeners();

/**
 * Load timetable data - Replace this with your actual data fetching logic
 * @returns {Promise<Array>} A promise that resolves to the timetable data
 */
function loadTimetableData() {
    // This is a placeholder. In a real app, you would fetch data from an API
    return new Promise((resolve) => {
        // Sample data structure
        const sampleData = [
            {
                id: 1,
                name: "Algorithms and Data Structures",
                type: "course",
                teacher: "Dr. Smith",
                room: "A101",
                group: "CS-2023",
                day: 1, // Monday
                startTime: "10:00",
                endTime: "12:00"
            },
            {
                id: 2,
                name: "Database Systems",
                type: "seminar",
                teacher: "Prof. Johnson",
                room: "B205",
                group: "CS-2023",
                day: 1, // Monday
                startTime: "14:00",
                endTime: "16:00"
            },
            {
                id: 3,
                name: "Computer Networks",
                type: "course",
                teacher: "Dr. Williams",
                room: "A102",
                group: "CS-2023",
                day: 2, // Tuesday
                startTime: "9:00",
                endTime: "11:00"
            },
            {
                id: 4,
                name: "Software Engineering",
                type: "seminar",
                teacher: "Prof. Brown",
                room: "C303",
                group: "CS-2023",
                day: 3, // Wednesday
                startTime: "13:00",
                endTime: "15:00"
            },
            {
                id: 5,
                name: "Artificial Intelligence",
                type: "course",
                teacher: "Dr. Davis",
                room: "A103",
                group: "CS-2023",
                day: 4, // Thursday
                startTime: "11:00",
                endTime: "13:00"
            },
            {
                id: 6,
                name: "Human-Computer Interaction",
                type: "seminar",
                teacher: "Prof. Wilson",
                room: "B206",
                group: "CS-2023",
                day: 5, // Friday
                startTime: "15:00",
                endTime: "17:00"
            }
        ];
        
        resolve(sampleData);
    });
}

function renderTimetable(timetableData) {
    const timetableGrid = document.getElementById('timetable-grid');
    timetableGrid.innerHTML = '';
    
    // Create day columns
    for (let day = 1; day <= 5; day++) {
        const dayColumn = document.createElement('div');
        dayColumn.className = 'day-column';
        dayColumn.dataset.day = day;
        timetableGrid.appendChild(dayColumn);
        
        // Filter classes for this day
        const dayClasses = timetableData.filter(cls => cls.day === day);
        
        // Render each class card
        dayClasses.forEach(cls => {
            const classCard = createClassCard(cls);
            dayColumn.appendChild(classCard);
        });
    }
}

function createClassCard(classData) {
    const startHour = parseInt(classData.startTime.split(':')[0]);
    // const startMinute = parseInt(classData.startTime.split(':')[1]);
    const endHour = parseInt(classData.endTime.split(':')[0]);
    // const endMinute = parseInt(classData.endTime.split(':')[1]);
    
    // Calculate position and height
    const topPosition = (startHour - 8) * 80; // 8:00 is the starting time
    const duration = (endHour - startHour);
    const height = duration * 80;
    
    const classCard = document.createElement('div');
    classCard.className = `class-card ${classData.type}`;
    classCard.dataset.id = classData.id;
    
    classCard.style.top = `${topPosition}px`;
    classCard.style.height = `${height}px`;
    
    classCard.innerHTML = `
        <div class="class-time">${classData.startTime} - ${classData.endTime}</div>
        <div class="class-name">${classData.name}</div>
        <div class="class-info">
            <div class="class-teacher"><i class="fas fa-user"></i> ${classData.teacher}</div>
            <div class="class-room"><i class="fas fa-map-marker-alt"></i> ${classData.room}</div>
            <div class="class-group"><i class="fas fa-users"></i> ${classData.group}</div>
        </div>
    `;
    
    return classCard;
}

/**
 * Initialize all event listeners
 */
function initializeEventListeners() {
    
    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(button => {
        button.addEventListener('click', function() {
            filterTimetable(this.dataset.filter);
            
            // Update active state
            document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
        });
    });
    
    // Logout button
    document.getElementById('logout-btn').addEventListener('click', function() {
        handleLogout();
    });
    
    // Suggestion form
    document.getElementById('suggestion-form').addEventListener('submit', function(e) {
        e.preventDefault();
        handleSuggestionSubmit();
    });
}

/**
 * Filter timetable by type
 * @param {string} filter - The filter type
 */
function filterTimetable(filter) {
    const cards = document.querySelectorAll('.class-card');
    
    cards.forEach(card => {
        card.style.display = 'block';
        
        if (filter === 'all') {
            return;
        }
        
        if (filter === 'course' && !card.classList.contains('course')) {
            card.style.display = 'none';
        }
        
        if (filter === 'seminar' && !card.classList.contains('seminar')) {
            card.style.display = 'none';
        }
        
    });
}

/**
 * Handle logout button click
 */
function handleLogout() {
    // This is a placeholder. In a real app, you would handle logout logic
    alert('Logging out...');
}

/**
 * Handle suggestion form submission
 */
function handleSuggestionSubmit() {
    const type = document.getElementById('suggestion-type').value;
    const course = document.getElementById('suggestion-course').value;
    const details = document.getElementById('suggestion-details').value;
    
    // This is a placeholder. In a real app, you would send this data to your backend
    console.log('Suggestion submitted:', { type, course, details });
    
    // Show confirmation
    alert('Thank you for your suggestion! It has been submitted for review.');
    
    // Clear form
    document.getElementById('suggestion-form').reset();
}
