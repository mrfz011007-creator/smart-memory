const status = document.getElementById("status");

let db;


/* =========================
   INITIALIZATION
========================= */

async function startApp() {
    try {
        db = await openDatabase();

        status.textContent = "Database berhasil dibuka.";

        await loadAll();

    } catch (error) {
        status.textContent = "Database gagal dibuka.";
        console.error(error);
    }
}


/* =========================
   UTILITIES
========================= */

function createId() {
    return crypto.randomUUID();
}

function now() {
    return new Date().toISOString();
}

function escapeHTML(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}


/* =========================
   GENERIC DATABASE HELPERS
========================= */

function addRecord(storeName, record) {
    return new Promise((resolve, reject) => {

        const transaction = db.transaction(
            [storeName],
            "readwrite"
        );

        const store = transaction.objectStore(storeName);

        const request = store.add(record);

        request.onsuccess = () => {
            resolve(record);
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
}


function getAllRecords(storeName) {
    return new Promise((resolve, reject) => {

        const transaction = db.transaction(
            [storeName],
            "readonly"
        );

        const store = transaction.objectStore(storeName);

        const request = store.getAll();

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
}


/* =========================
   CAPTURE
========================= */

async function saveCapture() {

    const input =
        document.getElementById("captureInput");

    const content = input.value.trim();

    if (!content) {
        status.textContent =
            "Capture tidak boleh kosong.";

        return;
    }

    const capture = {
        id: createId(),
        content: content,
        type: null,
        created_at: now()
    };

    await addRecord("captures", capture);

    input.value = "";

    status.textContent =
        "Capture berhasil disimpan.";

    await loadAll();
}


async function classifyCapture(
    captureId,
    type
) {

    const transaction = db.transaction(
        ["captures", type],
        "readwrite"
    );

    const captures =
        transaction.objectStore("captures");

    const target =
        transaction.objectStore(type);

    const getRequest =
        captures.get(captureId);

    getRequest.onsuccess = () => {

        const capture = getRequest.result;

        if (!capture) return;

        const entity = {
            id: createId(),
            title: capture.content,
            description: capture.content,
            status: "active",
            created_at: now(),
            updated_at: now()
        };

        target.add(entity);

        capture.type = type;

        captures.put(capture);
    };

    transaction.oncomplete = async () => {
        status.textContent =
            `Capture diklasifikasikan sebagai ${type}.`;

        await loadAll();
    };

    transaction.onerror = () => {
        console.error(transaction.error);
    };
}


async function loadCaptures() {

    const captures =
        await getAllRecords("captures");

    captures.sort((a, b) =>
        new Date(b.created_at) -
        new Date(a.created_at)
    );

    const container =
        document.getElementById("captureList");

    container.innerHTML = "";

    if (captures.length === 0) {
        container.innerHTML =
            "<p>Belum ada capture.</p>";

        return;
    }

    captures.forEach((capture) => {

        const article =
            document.createElement("article");

        const date =
            new Date(
                capture.created_at
            ).toLocaleString("id-ID");

        let actions = "";

        if (!capture.type) {

            actions = `
                <div class="actions">
                    <button data-type="ideas">
                        Idea
                    </button>

                    <button data-type="problems">
                        Problem
                    </button>

                    <button data-type="questions">
                        Question
                    </button>
                </div>
            `;
        } else {

            actions = `
                <small>
                    Type: ${escapeHTML(capture.type)}
                </small>
            `;
        }

        article.innerHTML = `
            <p>
                ${escapeHTML(capture.content)}
            </p>

            <small>${date}</small>

            ${actions}
        `;

        if (!capture.type) {

            article
                .querySelectorAll("[data-type]")
                .forEach(button => {

                    button.addEventListener(
                        "click",
                        () => {
                            classifyCapture(
                                capture.id,
                                button.dataset.type
                            );
                        }
                    );

                });
        }

        container.appendChild(article);
    });
}


/* =========================
   ENTITIES
========================= */

async function loadEntities() {

    const ideas =
        await getAllRecords("ideas");

    const problems =
        await getAllRecords("problems");

    const questions =
        await getAllRecords("questions");


    renderEntityList(
        "ideaList",
        ideas
    );

    renderEntityList(
        "problemList",
        problems
    );

    renderEntityList(
        "questionList",
        questions
    );
}


function renderEntityList(
    elementId,
    records
) {

    const container =
        document.getElementById(elementId);

    container.innerHTML = "";

    if (records.length === 0) {
        container.innerHTML =
            "<p>Belum ada.</p>";

        return;
    }

    records
        .sort((a, b) =>
            new Date(b.created_at) -
            new Date(a.created_at)
        )
        .forEach(record => {

            const div =
                document.createElement("div");

            div.className = "item";

            div.innerHTML = `
                <strong>
                    ${escapeHTML(record.title)}
                </strong>

                <small>
                    ${escapeHTML(record.status)}
                </small>
            `;

            container.appendChild(div);
        });
}


/* =========================
   PROJECTS
========================= */

async function createProject() {

    const title =
        document
            .getElementById("projectTitle")
            .value
            .trim();

    const goal =
        document
            .getElementById("projectGoal")
            .value
            .trim();

    if (!title) {

        status.textContent =
            "Nama project wajib diisi.";

        return;
    }

    const project = {

        id: createId(),

        title: title,

        goal: goal,

        status: "active",

        origin_type: null,

        origin_id: null,

        created_at: now(),

        updated_at: now()
    };

    await addRecord(
        "projects",
        project
    );

    document
        .getElementById("projectTitle")
        .value = "";

    document
        .getElementById("projectGoal")
        .value = "";

    status.textContent =
        "Project berhasil dibuat.";

    await loadAll();
}


async function loadProjects() {

    const projects =
        await getAllRecords("projects");

    projects.sort((a, b) =>
        new Date(b.updated_at) -
        new Date(a.updated_at)
    );


    const list =
        document.getElementById("projectList");

    list.innerHTML = "";


    if (projects.length === 0) {

        list.innerHTML =
            "<p>Belum ada project.</p>";

    } else {

        projects.forEach(project => {

            const article =
                document.createElement("article");

            article.innerHTML = `
                <h3>
                    ${escapeHTML(project.title)}
                </h3>

                <p>
                    ${escapeHTML(project.goal || "")}
                </p>

                <small>
                    Status: ${escapeHTML(project.status)}
                </small>
            `;

            list.appendChild(article);
        });
    }


    updateProjectSelects(projects);
}


function updateProjectSelects(projects) {

    const selectIds = [
        "projectSelect",
        "experimentProject",
        "experienceProject",
        "lessonProject"
    ];

    selectIds.forEach(selectId => {

        const select =
            document.getElementById(selectId);

        const current =
            select.value;

        select.innerHTML = `
            <option value="">
                Pilih project
            </option>
        `;

        projects.forEach(project => {

            const option =
                document.createElement("option");

            option.value = project.id;

            option.textContent =
                project.title;

            select.appendChild(option);
        });

        if (current) {
            select.value = current;
        }
    });
}


/* =========================
   EXPERIMENT
========================= */

async function saveExperiment() {

    const projectId =
        document
            .getElementById("experimentProject")
            .value;

    const hypothesis =
        document
            .getElementById("experimentHypothesis")
            .value
            .trim();

    const method =
        document
            .getElementById("experimentMethod")
            .value
            .trim();

    const result =
        document
            .getElementById("experimentResult")
            .value
            .trim();

    const conclusion =
        document
            .getElementById("experimentConclusion")
            .value
            .trim();


    if (!projectId || !hypothesis) {

        status.textContent =
            "Project dan hypothesis wajib diisi.";

        return;
    }


    const experiment = {

        id: createId(),

        project_id: projectId,

        hypothesis,

        method,

        result,

        conclusion,

        created_at: now()
    };


    await addRecord(
        "experiments",
        experiment
    );


    document
        .getElementById("experimentHypothesis")
        .value = "";

    document
        .getElementById("experimentMethod")
        .value = "";

    document
        .getElementById("experimentResult")
        .value = "";

    document
        .getElementById("experimentConclusion")
        .value = "";


    status.textContent =
        "Experiment berhasil disimpan.";

    await loadAll();
}


/* =========================
   EXPERIENCE
========================= */

async function saveExperience() {

    const projectId =
        document
            .getElementById("experienceProject")
            .value;

    const description =
        document
            .getElementById("experienceDescription")
            .value
            .trim();


    if (!projectId || !description) {

        status.textContent =
            "Project dan experience wajib diisi.";

        return;
    }


    const experience = {

        id: createId(),

        project_id: projectId,

        experiment_id: null,

        description,

        created_at: now()
    };


    await addRecord(
        "experiences",
        experience
    );


    document
        .getElementById("experienceDescription")
        .value = "";


    status.textContent =
        "Experience berhasil disimpan.";

    await loadAll();
}


/* =========================
   LESSON
========================= */

async function saveLesson() {

    const title =
        document
            .getElementById("lessonTitle")
            .value
            .trim();

    const description =
        document
            .getElementById("lessonDescription")
            .value
            .trim();

    const projectId =
        document
            .getElementById("lessonProject")
            .value;


    if (!title || !description) {

        status.textContent =
            "Judul dan isi lesson wajib diisi.";

        return;
    }


    const lesson = {

        id: createId(),

        title,

        description,

        status: "active",

        project_id: projectId || null,

        created_at: now(),

        updated_at: now()
    };


    await addRecord(
        "lessons",
        lesson
    );


    document
        .getElementById("lessonTitle")
        .value = "";

    document
        .getElementById("lessonDescription")
        .value = "";


    status.textContent =
        "Lesson berhasil disimpan.";

    await loadAll();
}


/* =========================
   PROJECT WORKSPACE
========================= */

async function showProjectWorkspace(projectId) {

    const container =
        document.getElementById(
            "projectWorkspace"
        );

    if (!projectId) {

        container.innerHTML =
            "<p>Pilih project untuk melihat workspace.</p>";

        return;
    }


    const projects =
        await getAllRecords("projects");

    const experiments =
        await getAllRecords("experiments");

    const experiences =
        await getAllRecords("experiences");

    const lessons =
        await getAllRecords("lessons");


    const project =
        projects.find(
            item => item.id === projectId
        );


    if (!project) return;


    const projectExperiments =
        experiments.filter(
            item => item.project_id === projectId
        );

    const projectExperiences =
        experiences.filter(
            item => item.project_id === projectId
        );

    const projectLessons =
        lessons.filter(
            item => item.project_id === projectId
        );


    container.innerHTML = `

        <h3>
            ${escapeHTML(project.title)}
        </h3>

        <p>
            ${escapeHTML(project.goal || "")}
        </p>


        <h3>Experiments</h3>

        ${
            projectExperiments.length
            ? projectExperiments.map(item => `
                <div class="item">
                    <strong>
                        Hypothesis
                    </strong>

                    <p>
                        ${escapeHTML(item.hypothesis)}
                    </p>

                    <small>
                        Conclusion:
                        ${escapeHTML(
                            item.conclusion || "-"
                        )}
                    </small>
                </div>
            `).join("")
            : "<p>Belum ada experiment.</p>"
        }


        <h3>Experiences</h3>

        ${
            projectExperiences.length
            ? projectExperiences.map(item => `
                <div class="item">
                    ${escapeHTML(item.description)}
                </div>
            `).join("")
            : "<p>Belum ada experience.</p>"
        }


        <h3>Lessons</h3>

        ${
            projectLessons.length
            ? projectLessons.map(item => `
                <div class="item">
                    <strong>
                        ${escapeHTML(item.title)}
                    </strong>

                    <p>
                        ${escapeHTML(item.description)}
                    </p>
                </div>
            `).join("")
            : "<p>Belum ada lesson.</p>"
        }

    `;
}


/* =========================
   LOAD EVERYTHING
========================= */

async function loadAll() {

    await loadCaptures();

    await loadEntities();

    await loadProjects();
}


/* =========================
   EVENTS
========================= */

document
    .getElementById("saveCapture")
    .addEventListener(
        "click",
        saveCapture
    );


document
    .getElementById("createProject")
    .addEventListener(
        "click",
        createProject
    );


document
    .getElementById("saveExperiment")
    .addEventListener(
        "click",
        saveExperiment
    );


document
    .getElementById("saveExperience")
    .addEventListener(
        "click",
        saveExperience
    );


document
    .getElementById("saveLesson")
    .addEventListener(
        "click",
        saveLesson
    );


document
    .getElementById("projectSelect")
    .addEventListener(
        "change",
        event => {
            showProjectWorkspace(
                event.target.value
            );
        }
    );


startApp();
