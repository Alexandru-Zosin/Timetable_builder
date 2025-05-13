window.onload = async () => {
    try {
        const response = await fetch("https://localhost:3000/validate", {
            method: "POST",
            credentials: 'include',
            mode: "cors",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({}),
        });

        if (response.status === 200) {
            window.location.href = "https://localhost/timetable/index.html";
        }
    } catch (error) {
        console.error("Validation Error:", error);
    }
};

// form switching functionality
const loginTab = document.getElementById('login-tab');
const signupTab = document.getElementById('signup-tab');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');

loginTab.addEventListener('click', function () {
    loginTab.classList.add('active');
    signupTab.classList.remove('active');
    loginForm.classList.add('active-form');
    signupForm.classList.remove('active-form');
});

signupTab.addEventListener('click', function () {
    signupTab.classList.add('active');
    loginTab.classList.remove('active');
    signupForm.classList.add('active-form');
    loginForm.classList.remove('active-form');
});

loginForm.addEventListener('submit', async function (event) {
    event.preventDefault(); // form doesn't reload the page, nor is the request sent automatically

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
        Swal.fire({
            text: "Please fill in all fields.",
            customClass: {
                popup: 'custom-swal'
            },
            showConfirmButton: false,
            timer: 1500
        });
        return;
    }

    try {
        const response = await fetch("https://localhost:3000/login", {
            method: "POST",
            credentials: 'include',
            mode: "cors",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ email, password }),
        });

        if (response.status === 200) {
            window.location.href = "https://localhost/timetable/index.html";
        } else if (response.status === 403 || response.status === 401) {
            Swal.fire({
                text: "Invalid credentials.",
                customClass: {
                    popup: 'custom-swal',
                },
                showConfirmButton: false,
                timer: 1500
            });
        } else {
            Swal.fire({
                text: "Internal server error.",
                customClass: {
                    popup: 'custom-swal'
                },
                showConfirmButton: false,
                timer: 1500
            });
        }
    } catch (error) {
        console.error("Login Error:", error);
    }
});

signupForm.addEventListener('submit', async function (event) {
    event.preventDefault();

    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const grouptag = document.getElementById('group-select').value;
    const yeartag = document.getElementById('year-select').value;

    if (!email || !password || !confirmPassword || !grouptag || !yeartag) {
        Swal.fire({
            text: "Please fill in all fields.",
            customClass: {
                popup: 'custom-swal'
            },
            showConfirmButton: false,
            timer: 1500
        });
        return;
    }

    try {
        const response = await fetch("https://localhost:3000/signup", {
            method: "POST",
            credentials: 'include',
            mode: "cors",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ email, password, confirmPassword, grouptag, yeartag }),
        });

        if (response.status === 201) {
            window.location.href = "https://localhost/login/index.html";
        } else if (response.status === 400) {
            Swal.fire({
                text: "Signup failed: Passwords do not match.",
                customClass: {
                    popup: 'custom-swal'
                },
                showConfirmButton: false,
                timer: 1500
            });
        } else if (response.status === 403) {
            Swal.fire({
                text: "Signup failed: Invalid credentials.",
                customClass: {
                    popup: 'custom-swal'
                },
                showConfirmButton: false,
                timer: 1500
            });
        } else if (response.status === 409) {
            Swal.fire({
                text: "Signup failed: User already exists.",
                customClass: {
                    popup: 'custom-swal'
                },
                showConfirmButton: false,
                timer: 1500
            });
        } else {
            Swal.fire({
                text: "Signup failed. Please try again.",
                customClass: {
                    popup: 'custom-swal'
                }, showConfirmButton: false,
                timer: 1500
            });
        }
    } catch (error) {
        console.error("Signup Error:", error);
    }
});
