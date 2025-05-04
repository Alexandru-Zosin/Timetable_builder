function toggleTheme() {
    const body = document.body;
    const buttonIcon = document.querySelector('.theme-toggle i');
    body.classList.toggle('dark');

    if (body.classList.contains('dark')) {
        buttonIcon.classList.replace('fa-moon', 'fa-sun');
        localStorage.setItem('theme', 'dark');
    } else {
        buttonIcon.classList.replace('fa-sun', 'fa-moon');
        localStorage.setItem('theme', 'light');
    }
}

// load theme from localStorage on page load
window.addEventListener('load', () => {
    const theme = localStorage.getItem('theme');
    const buttonIcon = document.querySelector('.theme-toggle i');
    if (theme === 'dark') {
        document.body.classList.add('dark');
        buttonIcon.classList.replace('fa-moon', 'fa-sun');
    }
});