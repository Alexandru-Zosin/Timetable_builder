document.addEventListener('DOMContentLoaded', function() {
    // User data - This would come from your backend
    const userData = {
        name: 'Jane Smith',
        avatar: 'https://ui-avatars.com/api/?name=Jane+Smith&background=4a6cff&color=fff'
    };

    // Initialize the UI with user data
    initializeUserInterface(userData);
    
    // Load sample timetable data - Replace this with your actual data loading
    loadTimetableData()
        .then(data => {
            renderTimetable(data);
            initializeTimetableEvents();
        })
        .catch(error => {
            console.error('Error loading timetable data:', error);
        });
    
    // Initialize event listeners
    initializeEventListeners();
});

/**
 * Initialize the user interface with user data
 * @param {Object} userData - The user data object
 */
function initializeUserInterface(userData) {
    document.getElementById('user-name').textContent = userData.name;
    document.getElementById('user-avatar').src = userData.avatar;
}

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
                endTime: "12:00",
                mandatory: true
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
                endTime: "16:00",
                mandatory: false
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
                endTime: "11:00",
                mandatory: true
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
                endTime: "15:00",
                mandatory: true
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
                endTime: "13:00",
                mandatory: false
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
                endTime: "17:00",
                mandatory: false
            }
        ];
        
        // Simulate API delay
        setTimeout(() => resolve(sampleData), 300);
    });
}

/**
 * Render the timetable with provided data
 * @param {Array} timetableData - The timetable data
 */
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

/**
 * Create a class card element
 * @param {Object} classData - The class data
 * @returns {HTMLElement} The class card element
 */
function createClassCard(classData) {
    const startHour = parseInt(classData.startTime.split(':')[0]);
    const startMinute = parseInt(classData.startTime.split(':')[1]);
    const endHour = parseInt(classData.endTime.split(':')[0]);
    const endMinute = parseInt(classData.endTime.split(':')[1]);
    
    // Calculate position and height
    const topPosition = (startHour - 8) * 80 + (startMinute / 60) * 80; // 8:00 is the starting time
    const duration = (endHour - startHour) + (endMinute - startMinute) / 60;
    const height = duration * 80;
    
    const classCard = document.createElement('div');
    classCard.className = `class-card ${classData.type}`;
    classCard.dataset.id = classData.id;
    
    if (classData.mandatory) {
        classCard.classList.add('mandatory');
    }
    
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
 * Initialize timetable-related event listeners
 */
function initializeTimetableEvents() {
    // Add click event to class cards
    document.querySelectorAll('.class-card').forEach(card => {
        card.addEventListener('click', function() {
            showClassDetails(this.dataset.id);
        });
    });
}

/**
 * Show details for a specific class
 * @param {string} classId - The class ID
 */
function showClassDetails(classId) {
    // Here you would show a modal or details panel with more information about the class
    alert(`Viewing details for class #${classId}`);
    // In a real application, you would fetch detailed information and show it in a modal
}

/**
 * Initialize all event listeners
 */
function initializeEventListeners() {
    // Week navigation
    document.getElementById('prev-week').addEventListener('click', navigateWeek('prev'));
    document.getElementById('next-week').addEventListener('click', navigateWeek('next'));
    
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
 * Navigate to previous or next week
 * @param {string} direction - Navigation direction ('prev' or 'next')
 * @returns {Function} Event handler function
 */
function navigateWeek(direction) {
    return function() {
        // This is a placeholder. In a real app, you would update the date and fetch new data
        const currentWeek = document.getElementById('current-week').textContent;
        
        // For demo purposes, just update the text
        if (direction === 'prev') {
            document.getElementById('current-week').textContent = 'September 4-10, 2023';
        } else {
            document.getElementById('current-week').textContent = 'September 18-24, 2023';
        }
        
        // Here you would load new data for the selected week
        console.log(`Navigating ${direction} from ${currentWeek}`);
    };
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
        
        if (filter === 'mandatory' && !card.classList.contains('mandatory')) {
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
