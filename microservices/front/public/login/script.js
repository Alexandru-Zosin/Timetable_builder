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

    /*try {
        const response = await fetch("https://localhost:3557/timetable", {
            method: "POST",
            credentials: "include",
            mode: "cors",
            headers: {
                "Accept": "application/json",
                "Content-Type" : "application-json"
            },
            body: JSON.stringify({extra_restrictions : [] })
        });
    } catch (error) {
        console.log("err");
    }*/
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
        alert("Please fill in all fields.");
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
            alert("Invalid credentials.");
        } else {
            alert("Internal server error.");
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

    if (!email || !password || !confirmPassword || !grouptag) {
        alert("Please fill in all fields.");
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
            body: JSON.stringify({ email, password, confirmPassword, grouptag }),
        });

        if (response.status === 201) {
            window.location.href = "https://localhost/login/index.html";
        } else if (response.status === 400) {
            alert("Signup failed: Passwords do not match.");
        } else if (response.status === 403) {
            alert("Signup failed: Invalid credentials.");
        } else if (response.status === 409) {
            alert("Signup failed: User already exists.");
        } else {
            alert("Signup failed. Please try again.");
        }
    } catch (error) {
        console.error("Signup Error:", error);
    }
});
