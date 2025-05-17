import { showAlert } from '../utils/scripts/customAlert.js';
import { internalFetch } from '../utils/scripts/customFetch.js';

function getTimeoutValue() {
    const sliderValue = document.getElementById("timeout-range").value;
    return sliderValue;
}

window.onload = async () => {
    try {
        document.getElementById('logout-btn').addEventListener('click', async () => {
            const logoutRequest = await internalFetch("https://localhost:3000/logout", "POST", {});
            if (logoutRequest.status !== 200) {
                showAlert({text: `Logout failed. ${logoutRequest.status}`});
                return;
            }
            window.location.href = "https://localhost/login/index.html";
        });
        
        document.getElementById('generate-bk-btn').addEventListener('click', async () => {
            await generateTimetable('bk');
        });
        document.getElementById('generate-hc-btn').addEventListener('click', async () => {
            await generateTimetable('hc');
        });

        async function generateTimetable(algorithm) {
            try {
                const timeout = getTimeoutValue();

                const res = await internalFetch("https://localhost:3557/timetable", "POST", 
                                                {
                                                    prompt: '',
                                                    teacher_id: null,
                                                    algorithm: algorithm,
                                                    timeout: timeout
                                                });
                if (res.ok) {
                    showAlert({text: `A new ${algorithm.toUpperCase()} timetable was generated.`});
                } else {
                    showAlert({text: `Failed to generate ${algorithm.toUpperCase()} timetable. Status: ${res.status}`});
                }
            } catch (err) {
                showAlert({text: "Error generating timetable. Check console."});
                console.error("Error generating timetable:", err);
            }
        }
        
        document.getElementById("timeout-range").addEventListener("input", function () {
            document.getElementById("timeout-value").textContent = `${this.value}s`;
        });        

        const response = await internalFetch("https://localhost:3557/constraints", "GET");
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

                const acceptBkBtn = document.createElement("button");
                acceptBkBtn.classList.add("acceptBtn");
                acceptBkBtn.textContent = "Accept_BK";
                acceptBkBtn.onclick = () => acceptConstraint(constraint.id, constraint.request, item, 'bk');

                const acceptHcBtn = document.createElement("button");
                acceptHcBtn.classList.add("acceptBtn");
                acceptHcBtn.textContent = "Accept_HC";
                acceptHcBtn.onclick = () => acceptConstraint(constraint.id, constraint.request, item, 'hc');

                const rejectBtn = document.createElement("button");
                rejectBtn.className = "reject";
                rejectBtn.textContent = "X";
                rejectBtn.onclick = () => removeConstraint(constraint.id, item);

                actions.appendChild(acceptBkBtn);
                actions.appendChild(acceptHcBtn);
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

async function acceptConstraint(id, prompt, item, algorithm) {
    try {
        const timeout = getTimeoutValue();

        const res = await internalFetch("https://localhost:3557/timetable", "POST", {
            prompt: prompt,
            teacher_id: id,
            algorithm: algorithm,
            timeout: timeout
        });
        if (res.ok) {
            removeConstraint(id, item);
            showAlert({text: `Generated a new ${algorithm.toUpperCase()} timetable based on teacher ${id}'s request.`, timer: 3500});
        } else {
            showAlert({text: `Failed to accept constraint #${id}`, timer: 3500});
        }
    } catch (err) {
        console.error(`Error accepting constraint #${id}:`, err);
    }
}

async function removeConstraint(id, itemElement) {
    try {
        const res = await internalFetch(`https://localhost:3557/constraints/${id}`, "DELETE");
        if (res.ok) {
            itemElement.remove();
        } else {
            showAlert({text: `Failed to reject constraint #${id}`, timer: 2500});
        }
    } catch (err) {
        console.error(`Error rejecting constraint #${id}:`, err);
    }
}