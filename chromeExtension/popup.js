document.addEventListener('DOMContentLoaded', async () => {
    const contentDiv = document.getElementById('content');
    const today = new Date();
    const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const todayDay = weekdays[today.getDay()];

    if (todayDay === "Saturday" || todayDay === "Sunday") {
        contentDiv.innerHTML = '<p class="message">Keep studying hard!</p>';
        return;
    }

    try {
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
        const todayTimetable = data.data[todayDay] || [];

        if (todayTimetable.length === 0) {
            contentDiv.innerHTML = '<p class="message">No classes today!</p>';
            return;
        }

        todayTimetable.forEach(entry => {
            const entryDiv = document.createElement('div');
            entryDiv.className = 'entry';
            entryDiv.innerHTML = `<strong>${entry.Interval}:</strong> ${entry.Subject} - ${entry.Teacher} (${entry.Room})`;
            contentDiv.appendChild(entryDiv);
        });
    } catch (error) {
        contentDiv.innerHTML = '<p class="message">Error loading timetable.</p>';
        console.error('Failed to load timetable:', error);
    }
});