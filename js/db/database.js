//===== DATABASE.JS =====

const DB_NAME="aiProjectHub";
const DB_VERSION=4;

function openDatabase(){
    return new Promise((resolve,reject)=>{
        const request=indexedDB.open(DB_NAME,DB_VERSION);

        request.onupgradeneeded=event=>{
            const db=event.target.result;
            const tx=event.target.transaction;

            const stores=[
                "problems",
                "ideas",
                "questions",
                "projects",
                "experiments",
                "experiences",
                "lessons",
                "concepts",
                "tools",
                "workflows"
            ];

            stores.forEach(storeName=>{
                if(!db.objectStoreNames.contains(storeName)){
                    db.createObjectStore(storeName,{keyPath:"id"});
                }
            });

            if(!db.objectStoreNames.contains("captures")){
                const store=db.createObjectStore("captures",{keyPath:"id"});
                store.createIndex("created_at","created_at");
            }

            if(!db.objectStoreNames.contains("relationships")){
                const store=db.createObjectStore("relationships",{keyPath:"id"});

                store.createIndex(
                    "from",
                    ["from_type","from_id"]
                );

                store.createIndex(
                    "to",
                    ["to_type","to_id"]
                );

                store.createIndex(
                    "relation",
                    "relation"
                );

                store.createIndex(
                    "created_at",
                    "created_at"
                );

            }else{
                const store=tx.objectStore("relationships");

                if(store.indexNames.contains("from_id")){
                    store.deleteIndex("from_id");
                }

                if(store.indexNames.contains("to_id")){
                    store.deleteIndex("to_id");
                }

                if(!store.indexNames.contains("from")){
                    store.createIndex(
                        "from",
                        ["from_type","from_id"]
                    );
                }

                if(!store.indexNames.contains("to")){
                    store.createIndex(
                        "to",
                        ["to_type","to_id"]
                    );
                }

                if(!store.indexNames.contains("relation")){
                    store.createIndex(
                        "relation",
                        "relation"
                    );
                }

                if(!store.indexNames.contains("created_at")){
                    store.createIndex(
                        "created_at",
                        "created_at"
                    );
                }
            }
        };

        request.onsuccess=()=>{
            resolve(request.result);
        };

        request.onerror=()=>{
            reject(request.error);
        };
    });
}
