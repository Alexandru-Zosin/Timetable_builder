window.onload = async () => {
    try {
        // Logout
        document.getElementById('logout-btn').addEventListener('click', async () => {
            const logoutRequest = await fetch("https://localhost:3000/logout", {
                method: "POST",
                credentials: "include",
                mode: "cors",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({})
            });
            if (logoutRequest.status !== 200) {
                window.alert(`Logout failed. ${logoutRequest.status}`);
                return;
            }
            window.location.href = "https://localhost/login/index.html";
        });

        document.getElementById('generate-timetable-btn').addEventListener('click', async () => {
            try {
                const res = await fetch("https://localhost:3557/timetable", {
                    method: "POST",
                    credentials: "include",
                    mode: "cors",
                    headers: {
                        "Accept": "application/json",
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        prompt: '',
                        teacher_id: null
                    })
                });
                if (res.ok) {
                    alert("A new timetable was generated.");
                } else {
                    alert(`Failed to generate timetable. Status: ${res.status}`);
                }
            } catch (err) {
                console.error("Error generating timetable:", err);
            }
        });

        // Fetch and render constraints
        const response = await fetch("https://localhost:3557/constraints", {
            method: "GET",
            credentials: "include",
            mode: "cors",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json"
            },
        });

        if (response.ok) {
            const data = await response.json();
            const constraints = data.requests || [];
            const constraintList = document.getElementById("constraint-list");

            constraints.forEach(constraint => {
                const item = document.createElement("div");
                item.className = "constraint-item";

                const text = document.createElement("div");
                text.className = "constraint-text";
                text.textContent = `#${constraint.id} (${constraint.name}): ${constraint.request}`;

                const actions = document.createElement("div");
                actions.className = "constraint-actions";

                const acceptBtn = document.createElement("button");
                acceptBtn.textContent = "Accept";
                acceptBtn.onclick = () => acceptConstraint(constraint.id, constraint.request, item);

                const rejectBtn = document.createElement("button");
                rejectBtn.className = "reject";
                rejectBtn.textContent = "X";
                rejectBtn.onclick = () => removeConstraint(constraint.id, item);

                actions.appendChild(acceptBtn);
                actions.appendChild(rejectBtn);

                item.appendChild(text);
                item.appendChild(actions);
                constraintList.appendChild(item);
            });
        } else {
            console.error("Failed to fetch constraints:", response.status);
        }
    } catch (error) {
        console.error("Error:", error);
    }
};

async function acceptConstraint(id, prompt, item) {
    try {
        const res = await fetch(`https://localhost:3557/timetable`, {
            method: "POST",
            credentials: "include",
            mode: "cors",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ 
                prompt: prompt,
                teacher_id: id })
        });

        if (res.ok) {
            removeConstraint(id, item);
            alert(`Generated a new timetable based on teacher ${id}'s request.`)
        } else {
            alert(`Failed to accept constraint #${id}`);
        }
    } catch (err) {
        console.error(`Error accepting constraint #${id}:`, err);
    }
}

async function removeConstraint(id, itemElement) {
    try {
        const res = await fetch(`https://localhost:3557/constraints/${id}`, {
            method: "DELETE",
            credentials: "include",
            mode: "cors",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json"
            }
        });

        if (res.ok) {
            itemElement.remove();
        } else {
            alert(`Failed to reject constraint #${id}`);
        }
    } catch (err) {
        console.error(`Error rejecting constraint #${id}:`, err);
    }
}