//=====01 CORE=====

let db;

const $=id=>document.getElementById(id);
const uid=()=>crypto.randomUUID();
const now=()=>new Date().toISOString();

const esc=s=>{
    const d=document.createElement("div");
    d.textContent=s??"";
    return d.innerHTML;
};

async function exportDatabase(){
    if(!db){
        status.textContent="Database belum siap.";
        return;
    }

    const stores=[
        ...db.objectStoreNames
    ];

    const backup={
        database:"aiProjectHub",
        version:db.version,
        exported_at:now(),
        stores:{}
    };

    for(const storeName of stores){
        backup.stores[storeName]=
            await getAllRecords(storeName);
    }

    const blob=new Blob(
        [JSON.stringify(backup,null,2)],
        {type:"application/json"}
    );

    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");

    a.href=url;
    a.download=
        `ai-project-hub-backup-${Date.now()}.json`;

    a.click();

    URL.revokeObjectURL(url);

    status.textContent=
        `Backup berhasil dibuat: ${stores.length} stores.`;
}
//=====02 DATABASE CRUD=====

function addRecord(store,data){
    return new Promise((resolve,reject)=>{
        const r=db.transaction(store,"readwrite").objectStore(store).add(data);
        r.onsuccess=()=>resolve(data);
        r.onerror=()=>reject(r.error);
    });
}

function getRecord(store,id){
    return new Promise((resolve,reject)=>{
        const r=db.transaction(store).objectStore(store).get(id);
        r.onsuccess=()=>resolve(r.result);
        r.onerror=()=>reject(r.error);
    });
}

function getAllRecords(store){
    return new Promise((resolve,reject)=>{
        const r=db.transaction(store).objectStore(store).getAll();
        r.onsuccess=()=>resolve(r.result);
        r.onerror=()=>reject(r.error);
    });
}

function updateRecord(store,data){
    return new Promise((resolve,reject)=>{
        const r=db.transaction(store,"readwrite").objectStore(store).put(data);
        r.onsuccess=()=>resolve(data);
        r.onerror=()=>reject(r.error);
    });
}

function deleteRecord(store,id){
    return new Promise((resolve,reject)=>{
        const r=db.transaction(store,"readwrite").objectStore(store).delete(id);
        r.onsuccess=()=>resolve();
        r.onerror=()=>reject(r.error);
    });
}
//=====03 CAPTURE=====

async function saveCapture(){
    const input=$("captureInput");
    const text=input.value.trim();
    if(!text)return;

    await addRecord("captures",{
        id:uid(),
        text,
        type:"unclassified",
        created_at:now()
    });

    input.value="";
    status.textContent="Capture berhasil disimpan.";
    await loadCaptures();
}

async function loadCaptures(){
    const list=$("captureList");
    const data=await getAllRecords("captures");

    list.innerHTML=data.length?data.map(x=>`
        <article>
            <p>${esc(x.text)}</p>
            <small>${x.type}</small>
            <div>
                <button data-id="${x.id}" data-type="idea">Idea</button>
                <button data-id="${x.id}" data-type="problem">Problem</button>
                <button data-id="${x.id}" data-type="question">Question</button>
            </div>
        </article>
    `).join(""):"<p>Belum ada capture.</p>";

    list.querySelectorAll("button").forEach(b=>{
        b.onclick=()=>classifyCapture(b.dataset.id,b.dataset.type);
    });
}

async function classifyCapture(id,type){
    const capture=await getRecord("captures",id);
    if(!capture)return;

    const store={
        idea:"ideas",
        problem:"problems",
        question:"questions"
    }[type];

    const data={
        id:uid(),
        title:capture.text,
        description:capture.text,
        created_at:now()
    };

    if(type==="question"){
        data.question=capture.text;
        delete data.title;
    }

    await addRecord(store,data);
    capture.type=type;
    await updateRecord("captures",capture);

    status.textContent=`Capture diklasifikasikan sebagai ${type}.`;
    await loadCaptures();
    await loadEntities();
}
//=====04 ENTITIES=====

async function loadEntities(){
    const [ideas,problems,questions]=await Promise.all([
        getAllRecords("ideas"),
        getAllRecords("problems"),
        getAllRecords("questions")
    ]);

    $("ideaList").innerHTML=renderEntities(ideas,"idea");
    $("problemList").innerHTML=renderEntities(problems,"problem");
    $("questionList").innerHTML=renderEntities(questions,"question");
}

function renderEntities(data,type){
    if(!data.length)return"<p>Belum ada data.</p>";

    return data.map(x=>`
        <article>
            <strong>${esc(x.title||x.question)}</strong>
            ${x.description?`<p>${esc(x.description)}</p>`:""}
            <small>${new Date(x.created_at).toLocaleString("id-ID")}</small>
        </article>
    `).join("");
}
//=====05 PROJECT=====

async function createProject(){
    const title=$("projectTitle").value.trim();
    const goal=$("projectGoal").value.trim();

    if(!title||!goal){
        status.textContent="Nama dan tujuan project wajib diisi.";
        return;
    }

    await addRecord("projects",{
        id:uid(),
        title,
        goal,
        status:"active",
        created_at:now(),
        updated_at:now()
    });

    $("projectTitle").value="";
    $("projectGoal").value="";
    status.textContent="Project berhasil dibuat.";
    await loadProjects();
}

async function loadProjects(){
    const projects=await getAllRecords("projects");

    $("projectList").innerHTML=projects.length?projects.map(p=>`
        <article>
            <strong>${esc(p.title)}</strong>
            <p>${esc(p.goal)}</p>
            <small>${p.status}</small>
            <div>
                <button onclick="editProject('${p.id}')">Edit</button>
                <button onclick="deleteProject('${p.id}')">Delete</button>
            </div>
        </article>
    `).join(""):"<p>Belum ada project.</p>";

    updateProjectSelects(projects);
}

function updateProjectSelects(projects){
    const selects=[
        $("projectSelect"),
        $("experimentProject"),
        $("experienceProject"),
        $("lessonProject")
    ];

    selects.forEach(select=>{
        const current=select.value;
        select.innerHTML='<option value="">Pilih project</option>';
        projects.forEach(p=>{
            select.innerHTML+=`<option value="${p.id}">${esc(p.title)}</option>`;
        });
        select.value=current;
    });
}

async function editProject(id){
    const p=await getRecord("projects",id);
    if(!p)return;

    const title=prompt("Nama project:",p.title);
    if(title===null)return;

    const goal=prompt("Tujuan project:",p.goal);
    if(goal===null)return;

    p.title=title.trim();
    p.goal=goal.trim();
    p.updated_at=now();

    if(!p.title||!p.goal)return;

    await updateRecord("projects",p);
    status.textContent="Project berhasil diperbarui.";
    await loadProjects();
    await showProjectWorkspace(p.id);
}

async function deleteProject(id){
    const p=await getRecord("projects",id);
    if(!p)return;

    if(!confirm(`Hapus project "${p.title}" beserta data terkait?`))return;

    const experiments=await getAllRecords("experiments");
    const experiences=await getAllRecords("experiences");
    const lessons=await getAllRecords("lessons");

    for(const x of experiments.filter(x=>x.project_id===id))
        await deleteRecord("experiments",x.id);

    for(const x of experiences.filter(x=>x.project_id===id))
        await deleteRecord("experiences",x.id);

    for(const x of lessons.filter(x=>x.project_id===id))
        await deleteRecord("lessons",x.id);

    await deleteRecord("projects",id);

    $("projectWorkspace").innerHTML="<p>Pilih project untuk melihat workspace.</p>";
    status.textContent="Project berhasil dihapus.";
    await loadProjects();
}
//=====06 EXPERIMENT=====

async function saveExperiment(){
    const project_id=$("experimentProject").value;
    const hypothesis=$("experimentHypothesis").value.trim();
    const method=$("experimentMethod").value.trim();
    const result=$("experimentResult").value.trim();
    const conclusion=$("experimentConclusion").value.trim();

    if(!project_id||!hypothesis){
        status.textContent="Project dan hypothesis wajib diisi.";
        return;
    }

    await addRecord("experiments",{
        id:uid(),project_id,hypothesis,method,result,conclusion,
        created_at:now()
    });

    $("experimentHypothesis").value="";
    $("experimentMethod").value="";
    $("experimentResult").value="";
    $("experimentConclusion").value="";

    status.textContent="Experiment berhasil disimpan.";
    await loadProjects();
    await showProjectWorkspace(project_id);
}

async function editExperiment(id){
    const e=await getRecord("experiments",id);
    if(!e)return;

    const hypothesis=prompt("Hypothesis:",e.hypothesis);
    if(hypothesis===null)return;
    const method=prompt("Method:",e.method||"");
    if(method===null)return;
    const result=prompt("Result:",e.result||"");
    if(result===null)return;
    const conclusion=prompt("Conclusion:",e.conclusion||"");
    if(conclusion===null)return;

    e.hypothesis=hypothesis.trim();
    e.method=method.trim();
    e.result=result.trim();
    e.conclusion=conclusion.trim();

    if(!e.hypothesis){
        status.textContent="Hypothesis wajib diisi.";
        return;
    }

    await updateRecord("experiments",e);
    status.textContent="Experiment berhasil diperbarui.";
    await showProjectWorkspace(e.project_id);
}

async function deleteExperiment(id){
    const e=await getRecord("experiments",id);
    if(!e)return;
    if(!confirm("Hapus experiment ini?"))return;

    await deleteRecord("experiments",id);
    status.textContent="Experiment berhasil dihapus.";
    await showProjectWorkspace(e.project_id);
}
//=====07 EXPERIENCE=====

async function saveExperience(){
    const project_id=$("experienceProject").value;
    const description=$("experienceDescription").value.trim();

    if(!project_id||!description){
        status.textContent="Project dan experience wajib diisi.";
        return;
    }

    await addRecord("experiences",{
        id:uid(),
        project_id,
        description,
        created_at:now()
    });

    $("experienceDescription").value="";
    status.textContent="Experience berhasil disimpan.";
    await showProjectWorkspace(project_id);
}

async function editExperience(id){
    const e=await getRecord("experiences",id);
    if(!e)return;

    const description=prompt("Apa yang benar-benar terjadi?",e.description);
    if(description===null)return;

    e.description=description.trim();

    if(!e.description){
        status.textContent="Experience tidak boleh kosong.";
        return;
    }

    await updateRecord("experiences",e);
    status.textContent="Experience berhasil diperbarui.";
    await showProjectWorkspace(e.project_id);
}

async function deleteExperience(id){
    const e=await getRecord("experiences",id);
    if(!e)return;
    if(!confirm("Hapus experience ini?"))return;

    await deleteRecord("experiences",id);
    status.textContent="Experience berhasil dihapus.";
    await showProjectWorkspace(e.project_id);
}
//=====08 LESSON=====

async function saveLesson(){
    const title=$("lessonTitle").value.trim();
    const description=$("lessonDescription").value.trim();
    const project_id=$("lessonProject").value;

    if(!title||!description){
        status.textContent="Judul dan lesson wajib diisi.";
        return;
    }

    await addRecord("lessons",{
        id:uid(),
        title,
        description,
        project_id,
        status:"active",
        created_at:now(),
        updated_at:now()
    });

    $("lessonTitle").value="";
    $("lessonDescription").value="";
    status.textContent="Lesson berhasil disimpan.";

    await showProjectWorkspace(project_id);
}

async function editLesson(id){
    const l=await getRecord("lessons",id);
    if(!l)return;

    const title=prompt("Judul lesson:",l.title);
    if(title===null)return;

    const description=prompt("Apa yang dipelajari?",l.description);
    if(description===null)return;

    l.title=title.trim();
    l.description=description.trim();
    l.updated_at=now();

    if(!l.title||!l.description){
        status.textContent="Judul dan lesson wajib diisi.";
        return;
    }

    await updateRecord("lessons",l);
    status.textContent="Lesson berhasil diperbarui.";
    await showProjectWorkspace(l.project_id);
}

async function deleteLesson(id){
    const l=await getRecord("lessons",id);
    if(!l)return;
    if(!confirm("Hapus lesson ini?"))return;

    await deleteRecord("lessons",id);
    status.textContent="Lesson berhasil dihapus.";
    await showProjectWorkspace(l.project_id);
}
//=====09 PROJECT WORKSPACE=====

async function showProjectWorkspace(id){
    const p=await getRecord("projects",id);
    if(!p){
        $("projectWorkspace").innerHTML="<p>Project tidak ditemukan.</p>";
        return;
    }

    $("projectSelect").value=id;

    const [experiments,experiences,lessons]=await Promise.all([
        getAllRecords("experiments"),
        getAllRecords("experiences"),
        getAllRecords("lessons")
    ]);

    const ex=experiments.filter(x=>x.project_id===id);
    const xp=experiences.filter(x=>x.project_id===id);
    const le=lessons.filter(x=>x.project_id===id);

    $("projectWorkspace").innerHTML=`
        <article>
            <h3>${esc(p.title)}</h3>
            <p>${esc(p.goal)}</p>
            <small>Status: ${esc(p.status)}</small>

            <h4>Experiments</h4>
            ${ex.length?ex.map(x=>`
                <div>
                    <strong>${esc(x.hypothesis)}</strong>
                    <p>Method: ${esc(x.method)}</p>
                    <p>Result: ${esc(x.result)}</p>
                    <p>Conclusion: ${esc(x.conclusion)}</p>
                    <button onclick="editExperiment('${x.id}')">Edit</button>
                    <button onclick="deleteExperiment('${x.id}')">Delete</button>
                </div>
            `).join(""):"<p>Belum ada experiment.</p>"}

            <h4>Experiences</h4>
            ${xp.length?xp.map(x=>`
                <div>
                    <p>${esc(x.description)}</p>
                    <button onclick="editExperience('${x.id}')">Edit</button>
                    <button onclick="deleteExperience('${x.id}')">Delete</button>
                </div>
            `).join(""):"<p>Belum ada experience.</p>"}

            <h4>Lessons</h4>
            ${le.length?le.map(x=>`
                <div>
                    <strong>${esc(x.title)}</strong>
                    <p>${esc(x.description)}</p>
                    <button onclick="editLesson('${x.id}')">Edit</button>
                    <button onclick="deleteLesson('${x.id}')">Delete</button>
                </div>
            `).join(""):"<p>Belum ada lesson.</p>"}
        </article>
    `;
}

$("projectSelect").onchange=()=>{
    const id=$("projectSelect").value;
    if(id)showProjectWorkspace(id);
    else $("projectWorkspace").innerHTML="<p>Pilih project untuk melihat workspace.</p>";
};
//=====10 APP INIT=====

async function loadAll(){
    await loadCaptures();
    await loadEntities();
    await loadProjects();
}

function showInitStatus(message){
    const el=$("status");

    if(el){
        el.textContent=message;
    }
}

async function startApp(){
    try{
        showInitStatus("INIT 1/8 — Membuka database...");

        db=await openDatabase();

        showInitStatus(
            `INIT 2/8 — Database berhasil dibuka. V${db.version}`
        );

        showInitStatus(
            "INIT 3/8 — Memeriksa relationships..."
        );

        await cleanDuplicateRelationships();

        showInitStatus(
            "INIT 4/8 — Memasang event..."
        );

        $("saveCapture").onclick=saveCapture;
        $("createProject").onclick=createProject;
        $("saveExperiment").onclick=saveExperiment;
        $("saveExperience").onclick=saveExperience;
        $("saveLesson").onclick=saveLesson;

        showInitStatus(
            "INIT 5/8 — Memuat Knowledge UI..."
        );

        initKnowledgeUI();
        initToolUI();
        initWorkflowUI();
        initRecallUI();

        showInitStatus(
            "INIT 6/8 — Memuat data utama..."
        );

        await loadAll();

        showInitStatus(
            "INIT 7/8 — Memuat knowledge..."
        );

        await loadConcepts();
        await loadTools();
        await loadWorkflows();

        showInitStatus(
            "INIT 8/8 — AI Project Hub siap."
        );

    }catch(error){
        console.error(error);

        showInitStatus(
            `ERROR — ${error.name}: ${error.message}`
        );
    }
}

startApp();
//=====11 RELATIONSHIP DATABASE=====

function createRelationship(from_type,from_id,relation,to_type,to_id){
    return new Promise((resolve,reject)=>{
        if(!from_type||!from_id||!relation||!to_type||!to_id){
            reject(new Error("Invalid relationship"));
            return;
        }

        const relationship={
            id:crypto.randomUUID(),
            from_type,
            from_id,
            relation,
            to_type,
            to_id,
            created_at:new Date().toISOString()
        };

        const tx=db.transaction("relationships","readwrite");
        const store=tx.objectStore("relationships");
        const request=store.add(relationship);

        request.onsuccess=()=>resolve(relationship);
        request.onerror=()=>reject(request.error);
    });
}

function getRelationshipsByFrom(type,id){
    return new Promise((resolve,reject)=>{
        const tx=db.transaction("relationships","readonly");
        const index=tx.objectStore("relationships").index("from");
        const request=index.getAll([type,id]);

        request.onsuccess=()=>resolve(request.result);
        request.onerror=()=>reject(request.error);
    });
}

function getRelationshipsByTo(type,id){
    return new Promise((resolve,reject)=>{
        const tx=db.transaction("relationships","readonly");
        const index=tx.objectStore("relationships").index("to");
        const request=index.getAll([type,id]);

        request.onsuccess=()=>resolve(request.result);
        request.onerror=()=>reject(request.error);
    });
}

function getRelationshipsByRelation(relation){
    return new Promise((resolve,reject)=>{
        const tx=db.transaction("relationships","readonly");
        const index=tx.objectStore("relationships").index("relation");
        const request=index.getAll(relation);

        request.onsuccess=()=>resolve(request.result);
        request.onerror=()=>reject(request.error);
    });
}

function deleteRelationship(id){
    return new Promise((resolve,reject)=>{
        const tx=db.transaction("relationships","readwrite");
        const request=tx.objectStore("relationships").delete(id);

        request.onsuccess=()=>resolve(true);
        request.onerror=()=>reject(request.error);
    });
}

function getAllRelationships(){
    return new Promise((resolve,reject)=>{
        const tx=db.transaction("relationships","readonly");
        const request=tx.objectStore("relationships").getAll();

        request.onsuccess=()=>resolve(request.result);
        request.onerror=()=>reject(request.error);
    });
}

async function cleanDuplicateRelationships(){
    const relationships=await getAllRelationships();
    const seen=new Set();
    const duplicates=[];

    for(const r of relationships){
        const key=[
            r.from_type,
            r.from_id,
            r.relation,
            r.to_type,
            r.to_id
        ].join("|");

        if(seen.has(key)){
            duplicates.push(r.id);
        }else{
            seen.add(key);
        }
    }

    if(!duplicates.length)return;

    const tx=db.transaction("relationships","readwrite");
    const store=tx.objectStore("relationships");

    duplicates.forEach(id=>{
        store.delete(id);
    });

    await new Promise((resolve,reject)=>{
        tx.oncomplete=resolve;
        tx.onerror=()=>reject(tx.error);
        tx.onabort=()=>reject(tx.error);
    });
}
//=====12 CONCEPT DATABASE=====

async function createConcept(name,definition,explanation=""){
    name=name.trim();
    definition=definition.trim();
    explanation=explanation.trim();

    if(!name||!definition)return null;

    const data={
        id:uid(),
        name,
        definition,
        explanation,
        status:"active",
        created_at:now(),
        updated_at:now()
    };

    await addRecord("concepts",data);
    return data;
}

async function getConcept(id){
    return getRecord("concepts",id);
}

async function getAllConcepts(){
    return getAllRecords("concepts");
}

async function updateConcept(data){
    data.updated_at=now();
    return updateRecord("concepts",data);
}

async function deleteConcept(id){
    return deleteRecord("concepts",id);
}
//=====13 TOOL DATABASE=====

async function createTool(name,purpose,how_to_use="",limitations=""){
    name=name.trim();
    purpose=purpose.trim();
    how_to_use=how_to_use.trim();
    limitations=limitations.trim();

    if(!name||!purpose)return null;

    const data={
        id:uid(),
        name,
        purpose,
        how_to_use,
        limitations,
        status:"active",
        created_at:now(),
        updated_at:now()
    };

    await addRecord("tools",data);
    return data;
}

async function getTool(id){
    return getRecord("tools",id);
}

async function getAllTools(){
    return getAllRecords("tools");
}

async function updateTool(data){
    data.updated_at=now();
    return updateRecord("tools",data);
}

async function deleteTool(id){
    return deleteRecord("tools",id);
}
//=====14 WORKFLOW DATABASE=====

async function createWorkflow(name,goal,steps=""){
    name=name.trim();
    goal=goal.trim();
    steps=steps.trim();

    if(!name||!goal)return null;

    const data={
        id:uid(),
        name,
        goal,
        steps,
        status:"active",
        created_at:now(),
        updated_at:now()
    };

    await addRecord("workflows",data);
    return data;
}

async function getWorkflow(id){
    return getRecord("workflows",id);
}

async function getAllWorkflows(){
    return getAllRecords("workflows");
}

async function updateWorkflow(data){
    data.updated_at=now();
    return updateRecord("workflows",data);
}

async function deleteWorkflow(id){
    return deleteRecord("workflows",id);
}
//=====15 KNOWLEDGE UI: CONCEPT=====

function initKnowledgeUI(){
    if($("knowledgeSection"))return;

    const section=document.createElement("section");
    section.id="knowledgeSection";
    section.innerHTML=`
        <h2>Knowledge</h2>
        <h3>Concept</h3>
        <input id="conceptName" placeholder="Nama concept">
        <textarea id="conceptDefinition" rows="3" placeholder="Definition"></textarea>
        <textarea id="conceptExplanation" rows="3" placeholder="Explanation"></textarea>
        <button id="saveConcept">Save Concept</button>
        <div id="conceptList"></div>
    `;

    document.querySelector("main").appendChild(section);
    $("saveConcept").onclick=saveConcept;
}

async function saveConcept(){
    const name=$("conceptName").value.trim();
    const definition=$("conceptDefinition").value.trim();
    const explanation=$("conceptExplanation").value.trim();

    const data=await createConcept(name,definition,explanation);

    if(!data){
        status.textContent="Nama dan definition wajib diisi.";
        return;
    }

    $("conceptName").value="";
    $("conceptDefinition").value="";
    $("conceptExplanation").value="";

    status.textContent="Concept berhasil disimpan.";
    await loadConcepts();
}

async function loadConcepts(){
    const data=await getAllConcepts();

    $("conceptList").innerHTML=data.length?data.map(x=>`
        <article>
            <strong>${esc(x.name)}</strong>
            <p>${esc(x.definition)}</p>
            ${x.explanation?`<p>${esc(x.explanation)}</p>`:""}
            <button onclick="editConcept('${x.id}')">Edit</button>
            <button onclick="deleteConceptUI('${x.id}')">Delete</button>
        </article>
    `).join(""):"<p>Belum ada concept.</p>";
}

async function editConcept(id){
    const c=await getConcept(id);
    if(!c)return;

    const name=prompt("Nama concept:",c.name);
    if(name===null)return;

    const definition=prompt("Definition:",c.definition);
    if(definition===null)return;

    const explanation=prompt("Explanation:",c.explanation||"");
    if(explanation===null)return;

    c.name=name.trim();
    c.definition=definition.trim();
    c.explanation=explanation.trim();

    if(!c.name||!c.definition)return;

    await updateConcept(c);
    status.textContent="Concept berhasil diperbarui.";
    await loadConcepts();
}

async function deleteConceptUI(id){
    if(!confirm("Hapus concept ini?"))return;

    await deleteConcept(id);
    status.textContent="Concept berhasil dihapus.";
    await loadConcepts();
}
//=====16 KNOWLEDGE UI: TOOL=====

function initToolUI(){
    if($("toolSection"))return;

    const section=document.createElement("section");
    section.id="toolSection";
    section.innerHTML=`
        <h3>Tool</h3>
        <input id="toolName" placeholder="Nama tool">
        <textarea id="toolPurpose" rows="3" placeholder="Purpose"></textarea>
        <textarea id="toolHowToUse" rows="3" placeholder="How to use"></textarea>
        <textarea id="toolLimitations" rows="3" placeholder="Limitations"></textarea>
        <button id="saveTool">Save Tool</button>
        <div id="toolList"></div>
    `;

    $("knowledgeSection").appendChild(section);
    $("saveTool").onclick=saveTool;
}

async function saveTool(){
    const name=$("toolName").value.trim();
    const purpose=$("toolPurpose").value.trim();
    const howToUse=$("toolHowToUse").value.trim();
    const limitations=$("toolLimitations").value.trim();

    const data=await createTool(name,purpose,howToUse,limitations);

    if(!data){
        status.textContent="Nama dan purpose wajib diisi.";
        return;
    }

    $("toolName").value="";
    $("toolPurpose").value="";
    $("toolHowToUse").value="";
    $("toolLimitations").value="";

    status.textContent="Tool berhasil disimpan.";
    await loadTools();
}

async function loadTools(){
    const data=await getAllTools();

    $("toolList").innerHTML=data.length?data.map(x=>`
        <article>
            <strong>${esc(x.name)}</strong>
            <p>${esc(x.purpose)}</p>
            ${x.how_to_use?`<p>${esc(x.how_to_use)}</p>`:""}
            ${x.limitations?`<p>${esc(x.limitations)}</p>`:""}
            <button onclick="editTool('${x.id}')">Edit</button>
            <button onclick="deleteToolUI('${x.id}')">Delete</button>
        </article>
    `).join(""):"<p>Belum ada tool.</p>";
}

async function editTool(id){
    const t=await getTool(id);
    if(!t)return;

    const name=prompt("Nama tool:",t.name);
    if(name===null)return;

    const purpose=prompt("Purpose:",t.purpose);
    if(purpose===null)return;

    const howToUse=prompt("How to use:",t.how_to_use||"");
    if(howToUse===null)return;

    const limitations=prompt("Limitations:",t.limitations||"");
    if(limitations===null)return;

    t.name=name.trim();
    t.purpose=purpose.trim();
    t.how_to_use=howToUse.trim();
    t.limitations=limitations.trim();

    if(!t.name||!t.purpose)return;

    await updateTool(t);
    status.textContent="Tool berhasil diperbarui.";
    await loadTools();
}

async function deleteToolUI(id){
    if(!confirm("Hapus tool ini?"))return;

    await deleteTool(id);
    status.textContent="Tool berhasil dihapus.";
    await loadTools();
}
//=====17 KNOWLEDGE UI: WORKFLOW=====

function initWorkflowUI(){
    if($("workflowSection"))return;

    const section=document.createElement("section");
    section.id="workflowSection";
    section.innerHTML=`
        <h3>Workflow</h3>
        <input id="workflowName" placeholder="Nama workflow">
        <textarea id="workflowGoal" rows="3" placeholder="Goal"></textarea>
        <textarea id="workflowSteps" rows="5" placeholder="Steps"></textarea>
        <button id="saveWorkflow">Save Workflow</button>
        <div id="workflowList"></div>
    `;

    $("knowledgeSection").appendChild(section);
    $("saveWorkflow").onclick=saveWorkflow;
}

async function saveWorkflow(){
    const name=$("workflowName").value.trim();
    const goal=$("workflowGoal").value.trim();
    const steps=$("workflowSteps").value.trim();

    const data=await createWorkflow(name,goal,steps);

    if(!data){
        status.textContent="Nama dan goal wajib diisi.";
        return;
    }

    $("workflowName").value="";
    $("workflowGoal").value="";
    $("workflowSteps").value="";

    status.textContent="Workflow berhasil disimpan.";
    await loadWorkflows();
}

async function loadWorkflows(){
    const data=await getAllWorkflows();

    $("workflowList").innerHTML=data.length?data.map(x=>`
        <article>
            <strong>${esc(x.name)}</strong>
            <p>${esc(x.goal)}</p>
            ${x.steps?`<p>${esc(x.steps)}</p>`:""}
            <button onclick="editWorkflow('${x.id}')">Edit</button>
            <button onclick="deleteWorkflowUI('${x.id}')">Delete</button>
        </article>
    `).join(""):"<p>Belum ada workflow.</p>";
}

async function editWorkflow(id){
    const w=await getWorkflow(id);
    if(!w)return;

    const name=prompt("Nama workflow:",w.name);
    if(name===null)return;

    const goal=prompt("Goal:",w.goal);
    if(goal===null)return;

    const steps=prompt("Steps:",w.steps||"");
    if(steps===null)return;

    w.name=name.trim();
    w.goal=goal.trim();
    w.steps=steps.trim();

    if(!w.name||!w.goal)return;

    await updateWorkflow(w);
    status.textContent="Workflow berhasil diperbarui.";
    await loadWorkflows();
}

async function deleteWorkflowUI(id){
    if(!confirm("Hapus workflow ini?"))return;

    await deleteWorkflow(id);
    status.textContent="Workflow berhasil dihapus.";
    await loadWorkflows();
}
//=====18 RECALL CORE=====

function matchScore(text,query){
    text=text.toLowerCase();
    query=query.toLowerCase().trim();
    if(!query)return 0;
    if(text===query)return 3;
    if(text.includes(query))return 2;

    const words=query.split(/\s+/).filter(Boolean);
    const hits=words.filter(x=>text.includes(x)).length;
    return hits?1:0;
}

async function recall(query){
    query=query.trim();
    if(!query)return[];

    const [concepts,tools,workflows,lessons]=await Promise.all([
        getAllConcepts(),
        getAllTools(),
        getAllWorkflows(),
        getAllRecords("lessons")
    ]);

    const results=[];

    concepts.forEach(x=>{
        const text=`${x.name} ${x.definition} ${x.explanation||""}`;
        const score=matchScore(text,query);
        if(score)results.push({type:"Concept",data:x,score});
    });

    tools.forEach(x=>{
        const text=`${x.name} ${x.purpose} ${x.how_to_use||""} ${x.limitations||""}`;
        const score=matchScore(text,query);
        if(score)results.push({type:"Tool",data:x,score});
    });

    workflows.forEach(x=>{
        const text=`${x.name} ${x.goal} ${x.steps||""}`;
        const score=matchScore(text,query);
        if(score)results.push({type:"Workflow",data:x,score});
    });

    lessons.forEach(x=>{
        const text=`${x.title} ${x.description}`;
        const score=matchScore(text,query);
        if(score)results.push({type:"Lesson",data:x,score});
    });

    return results.sort((a,b)=>b.score-a.score);
}
//=====19 RECALL UI=====

function initRecallUI(){
    if($("recallSection"))return;

    const section=document.createElement("section");
    section.id="recallSection";
    section.innerHTML=`
        <h2>Recall</h2>
        <input id="recallInput" placeholder="Apa yang sedang kamu cari?">
        <button id="recallButton">Recall</button>
        <div id="recallList"></div>
    `;

    document.querySelector("main").appendChild(section);
    $("recallButton").onclick=runRecall;
}

async function runRecall(){
    const query=$("recallInput").value.trim();

    if(!query){
        status.textContent="Masukkan kata atau topik.";
        return;
    }

    const results=await recall(query);

    $("recallList").innerHTML=results.length?results.map(x=>{
        const d=x.data;
        const title=d.name||d.title||d.question;
        const description=d.definition||d.purpose||d.goal||d.description||"";

        return`
            <article>
                <small>${x.type}</small>
                <strong>${esc(title)}</strong>
                <p>${esc(description)}</p>
                <button onclick="openKnowledge('${x.type}','${x.data.id}')">Open</button>
            </article>
        `;
    }).join(""):"<p>Tidak ada knowledge yang relevan.</p>";

    status.textContent=`Ditemukan ${results.length} hasil.`;
}
//=====20 KNOWLEDGE DETAIL=====

async function openKnowledge(type,id){
    const stores={
        Concept:"concepts",
        Tool:"tools",
        Workflow:"workflows",
        Lesson:"lessons"
    };

    const data=await getRecord(stores[type],id);
    if(!data)return;

    let html=`<small>${type}</small>`;

    if(type==="Concept"){
        html+=`
            <h3>${esc(data.name)}</h3>
            <p><strong>Definition</strong></p>
            <p>${esc(data.definition)}</p>
            ${data.explanation?`<p><strong>Explanation</strong></p><p>${esc(data.explanation)}</p>`:""}
        `;
    }

    if(type==="Tool"){
        html+=`
            <h3>${esc(data.name)}</h3>
            <p><strong>Purpose</strong></p>
            <p>${esc(data.purpose)}</p>
            ${data.how_to_use?`<p><strong>How to use</strong></p><p>${esc(data.how_to_use)}</p>`:""}
            ${data.limitations?`<p><strong>Limitations</strong></p><p>${esc(data.limitations)}</p>`:""}
        `;
    }

    if(type==="Workflow"){
        html+=`
            <h3>${esc(data.name)}</h3>
            <p><strong>Goal</strong></p>
            <p>${esc(data.goal)}</p>
            ${data.steps?`<p><strong>Steps</strong></p><p>${esc(data.steps)}</p>`:""}
        `;
    }

    if(type==="Lesson"){
        html+=`
            <h3>${esc(data.title)}</h3>
            <p>${esc(data.description)}</p>
        `;
    }

    html+=`<p><strong>Status:</strong> ${esc(data.status||"active")}</p>`;

    const section=$("recallSection");

    section.innerHTML=`
        <h2>Knowledge Detail</h2>

        <article>
            ${html}
        </article>

        <div id="relationshipArea"></div>

        <button id="backRecall">Back</button>
    `;

    $("backRecall").onclick=()=>{
        section.innerHTML=`
            <h2>Recall</h2>
            <input id="recallInput" placeholder="Apa yang sedang kamu cari?">
            <button id="recallButton">Recall</button>
            <div id="recallList"></div>
        `;

        $("recallButton").onclick=runRecall;
    };

    await renderRelationships(type,id);
}
//=====21 RELATIONSHIP UI=====

const knowledgeTypes=[
    "Concept",
    "Tool",
    "Workflow",
    "Lesson"
];

const relationTypes=[
    "related_to",
    "uses",
    "supports",
    "learned_from",
    "derived_from",
    "applies_to"
];

async function getKnowledgeList(){
    const data=[];

    const [concepts,tools,workflows,lessons]=await Promise.all([
        getAllConcepts(),
        getAllTools(),
        getAllWorkflows(),
        getAllRecords("lessons")
    ]);

    concepts.forEach(x=>{
        data.push({type:"Concept",id:x.id,name:x.name});
    });

    tools.forEach(x=>{
        data.push({type:"Tool",id:x.id,name:x.name});
    });

    workflows.forEach(x=>{
        data.push({type:"Workflow",id:x.id,name:x.name});
    });

    lessons.forEach(x=>{
        data.push({type:"Lesson",id:x.id,name:x.title});
    });

    return data;
}

async function relationshipExists(
    fromType,
    fromId,
    relation,
    toType,
    toId
){
    const data=await getAllRecords("relationships");

    return data.some(x=>
        x.from_type===fromType&&
        x.from_id===fromId&&
        x.relation===relation&&
        x.to_type===toType&&
        x.to_id===toId
    );
}

async function renderRelationships(type,id){
    const area=$("relationshipArea");

    const relations=[
        ...(await getRelationshipsByFrom(type,id)),
        ...(await getRelationshipsByTo(type,id))
    ];

    const knowledge=await getKnowledgeList();

    const related=relations.map(r=>{
        const isFrom=
            r.from_type===type&&
            r.from_id===id;

        const targetType=isFrom?
            r.to_type:
            r.from_type;

        const targetId=isFrom?
            r.to_id:
            r.from_id;

        const target=knowledge.find(x=>
            x.type===targetType&&
            x.id===targetId
        );

        if(!target)return"";

        return`
            <li>
                ${isFrom
                    ? `${esc(r.relation)} → ${esc(target.name)} (${esc(target.type)})`
                    : `← ${esc(r.relation)} — ${esc(target.name)} (${esc(target.type)})`
                }
            </li>
        `;
    }).filter(Boolean).join("");

    area.innerHTML=`
        <h4>Related Knowledge</h4>

        ${related?
            `<ul>${related}</ul>`:
            `<p>Belum ada relationship.</p>`
        }

        <h4>Add Relationship</h4>

        <select id="relationType">
            <option value="">Pilih relation</option>
            ${relationTypes.map(x=>
                `<option value="${x}">${x}</option>`
            ).join("")}
        </select>

        <select id="relationTargetType">
            <option value="">Pilih type</option>
            ${knowledgeTypes.map(x=>
                `<option value="${x}">${x}</option>`
            ).join("")}
        </select>

        <select id="relationTarget">
            <option value="">Pilih knowledge</option>
        </select>

        <button id="addRelationship">
            Add Relationship
        </button>
    `;

    $("relationTargetType").onchange=async()=>{
        const targetType=$("relationTargetType").value;

        const list=knowledge.filter(x=>
            x.type===targetType&&
            !(x.type===type&&x.id===id)
        );

        $("relationTarget").innerHTML=
            '<option value="">Pilih knowledge</option>'+
            list.map(x=>
                `<option value="${x.id}">
                    ${esc(x.name)}
                </option>`
            ).join("");
    };

    $("addRelationship").onclick=async()=>{
        const relation=$("relationType").value;
        const targetType=$("relationTargetType").value;
        const targetId=$("relationTarget").value;

        if(!relation||!targetType||!targetId){
            status.textContent="Semua relationship wajib diisi.";
            return;
        }

        const exists=await relationshipExists(
            type,
            id,
            relation,
            targetType,
            targetId
        );

        if(exists){
            status.textContent="Relationship tersebut sudah ada.";
            return;
        }

        await createRelationship(
            type,
            id,
            relation,
            targetType,
            targetId
        );

        status.textContent="Relationship berhasil ditambahkan.";

        await renderRelationships(type,id);
    };
}
