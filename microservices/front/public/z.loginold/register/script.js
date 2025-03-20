document.getElementById("submit-button").addEventListener('click', async () => {
    const email = document.getElementById("email").value;
    if (!email) {
        window.alert("Please insert a email.");
        return;
    }
    const password = document.getElementById("pass").value;
    if (!password) {
        window.alert("Please enter a password.");
        return;
    }
    const confirmPassword = document.getElementById("confirmCurrentPassword").value;

    try {
        const response = await fetch("https://localhost:3000/signup", {
            method: "POST",
            credentials: 'include',
            mode: "cors",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ 
                email: email,
                password: password,
                confirmPassword: confirmPassword,
            }),
        });

        if (response.status === 201) {
            window.location.href = "https://localhost/login/index.html";
        } else if (response.status === 400) {
            window.alert("Signup failed: Password does not match confirm password.")
        }
        else if (response.status === 403) {
            window.alert("Signup failed: Invalid credentials.")
        }
        else if (response.status === 409) {
            window.alert("Signup failed: User already exists.");
        } else {
            const errorData = await response.json(); // parses from json to js obj; returns promise
            window.alert(`Signup failed: ${errorData.error}`);
        }
    } catch (error) {
        console.log(error);
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