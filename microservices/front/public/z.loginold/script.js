document.getElementById("submit-button").addEventListener('click', async () => {
    const email = document.getElementById("email").value;
    if (!email) {
        window.alert("Please enter an email.");
        return;
    }

    const password = document.getElementById("pass").value;
    if (!password) {
        window.alert("Please enter a password.")
        return;
    }

    try {
        const response = await fetch("https://localhost:3000/login", {
            method: "POST",
            credentials: 'include', // https://reqbin.com/code/javascript/lcpj87js/javascript-fetch-with-credentials
            mode: "cors",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                email: email,
                password: password
            }),
        });

        if (response.status === 200) {
            window.location.href = "https://localhost/mainPage/index.html";
        } else if (response.status === 403) {
            window.alert("Invalid credentials.");
        } else if (response.status === 401) {
            window.alert("Login failed. Wrong credentials.");
        } else {
            window.alert("Internal server error.");
        }
    } catch (err) {
        console.log(err);
    }
});

window.onload = async () => {
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
        window.location.href = "https://localhost/mainPage/index.html";
    }
};