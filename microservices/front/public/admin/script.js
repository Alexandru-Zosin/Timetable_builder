window.onload = async (event) => {
    // load constraints

    // var constraints;
    // if (response.status === 200) {
    //     constraints = await response.json();
    // } else {
    //     window.alert("An error has occured.");
    // }

    // const constraintsSelector = document.getElementById("constraint-list");
    // constraintsSelector.innerHTML = '';

    // for (var constraint in Object.values(constraints)) {
    //     var constraintElement = document.createElement("div");
    //     constraintElement.classList.add("constraint-item");

    //     const teacherInfo = document.createElement('div');
    //     teacherInfo.classList.add("teacher-info");
    //     teacherInfo.innerHTML = `<i class='fas fa-chalkboard-teacher'></i> ${teacherName} ($)`
    // }

}

document.getElementById("new-timetable-btn").addEventListener("click", async () => {
    const response = await fetch("https://localhost:3557/timetable", {
        method: "POST",
        credentials: "include",
        mode: "cors",
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            prompt: "",
            teacher_id: ""
        })
    });


    if (response.status === 200) {
        alert("Successfully generated a new timetable");
    } else {

    }
});

function addConstraint(teacherName, teacherId, constraintText) {
    const list = document.getElementById('constraint-list');
    const item = document.createElement('div');
    item.classList.add('constraint-item');

    const teacherInfo = document.createElement('div');
    teacherInfo.classList.add('teacher-info');
    teacherInfo.innerHTML = `<i class='fas fa-chalkboard-teacher'></i> ${teacherName} (${teacherId})`;

    const constraintTextElem = document.createElement('div');
    constraintTextElem.textContent = constraintText;

    const actions = document.createElement('div');
    actions.classList.add('actions');
    const acceptBtn = document.createElement('button');
    acceptBtn.classList.add('accept');
    acceptBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
    const rejectBtn = document.createElement('button');
    rejectBtn.classList.add('reject')
    rejectBtn.innerHTML = '<i class="fa-solid fa-times"></i>';

    const loadingSpinner = document.createElement('div');
    loadingSpinner.classList.add('loading-circle');
    loadingSpinner.style.display = 'none';

    acceptBtn.addEventListener('click', () => {
        loadingSpinner.style.display = 'inline-block';
        simulateServerReply(() => {
            loadingSpinner.style.display = 'none';
            alert('Accepted');
        });
    });

    rejectBtn.addEventListener('click', () => {
        alert('Rejected');
    });

    actions.appendChild(acceptBtn);
    actions.appendChild(rejectBtn);
    actions.appendChild(loadingSpinner);
    item.appendChild(teacherInfo);
    item.appendChild(constraintTextElem);
    item.appendChild(actions);
    list.appendChild(item);
}
