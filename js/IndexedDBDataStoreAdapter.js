export default class IndexedDBDataStoreAdapter {

    static #store_name = "decent-messenger"
    
    #datastore_manager = undefined
    #db = undefined

    constructor (datastore_manager) {
        this.#datastore_manager = datastore_manager
        try {
            const db = indexedDB.open(IndexedDBDataStoreAdapter.#store_name, 1)
            db.onerror = (e) => {
                console.log(e)
            }
            db.onsuccess = ({target}) => {
                this.#db = target.result
                console.log("Db connected!", this.#db)
                this.#datastore_manager.register(this)
            }
            db.onupgradeneeded = ({target}) => {
                if (!target.result.objectStoreNames.contains("active_profile")) {
                    target.result.createObjectStore("active_profile", { keyPath: "id", autoIncrement: false})
                }
                if (!target.result.objectStoreNames.contains("profiles")) {
                    let store = target.result.createObjectStore("profiles", { keyPath: "id", autoIncrement: true})
                    store.createIndex("name", "name", {unique: true})
                }
                if (!target.result.objectStoreNames.contains("servers")) {
                    let store = target.result.createObjectStore("servers", { keyPath: "id", autoIncrement: true})
                    store.createIndex("profile_id", "profile_id")
                    store.createIndex("host", "host")
                }
                if (!target.result.objectStoreNames.contains("contacts")) {
                    let store = target.result.createObjectStore("contacts", { keyPath: "id", autoIncrement: true})
                    store.createIndex("profile_id", "profile_id")
                    store.createIndex("name", "name")
                    store.createIndex("host", "host")
                }
                // if (!target.result.objectStoreNames.contains("call-logs")) {
                //     // Build call logs schema
                //     let logs = target.result.createObjectStore("call-logs", { keyPath: "id", autoIncrement: true })
                //     logs.createIndex("type", type", {unique: false})
                //     logs.createIndex("host", "host", {unique: false})
                //     logs.createIndex("datetime", "datetime", {unique: false})
                // }
                // if (!target.result.objectStoreNames.contains("messages")) {
                //     // Build messages schema
                //     let messages = target.result.createObjectStore("messages", { keyPath: "id", autoIncrement: true})
                //     messages.createIndex("type", "type", {unique: false}) // 0=Undelieverd,1=Sent,2=SentConfirmed,3=Received,4=ReceviedConfirmed
                //     messages.createIndex("flag", "flag", {unique: false, default: false})
                //     messages.createIndex("datetime", "datetime", {unique: false})
                //     messages.createIndex("host", "host", {unique: false})
                // }
                console.log("DB upgrade completed")
            }
            db.onversionchange = e => {
                db.close()
                console.log("DB is outdated")
                alert("DB is outdated, refresh plz")
                // TODO: Refresh page here probably...
            }
            db.close = e => {
                console.log("DB Closed", e)
            }
        } catch (Exception) {
            console.log("Something went wrong while connecting to the database")
        }
    }

    getStoreName() {
        return IndexedDBDataStoreAdapter.#store_name
    }

    add (store_id, data) {
        return new Promise((resolve, reject) => {
            console.log("Trying to add", store_id, data)
            try {
                console.log("Adding", store_id, data)
                let transaction = this.#db.transaction(store_id, "readwrite")
                let store = transaction.objectStore(store_id)
                console.log("Fetched the datastore", store)
                let request = store.add(data) 
                request.onsuccess = (e) => {
                    console.log("db add: completed: Executing listener callbacks")
                    data.id = e.target.result
                    this.#datastore_manager.executeListenerCallbacks(store_id, data)
                    resolve(e.target.result)
                }
                request.onerror = (e) => {
                    // Error callback here
                    reject(e)
                }
            } catch (e) {
                console.log("DB add: Exception caught", e)
                reject(e)
            }
        })
    }

    update (store_id, updated_entry) {
        return new Promise((resolve, reject) => {
            console.log("Trying to update", store_id, updated_entry)
            try {
                let transaction = this.#db.transaction(store_id, "readwrite")
                let store = transaction.objectStore(store_id)
                console.log("update running:", store, updated_entry)
                let request = store.put(updated_entry)
                request.onsuccess = (e) => {
                    console.log("Executing listener callbacks")
                    this.#datastore_manager.executeListenerCallbacks(store_id, e)
                    resolve(true)
                }
                request.onerror = (e) => {
                    console.log("Rejected,", e)
                    reject(false)
                }
            } catch (e) {
                console.log("Ex", e)
                reject(false)
            }
        })
    }

    async delete (store_id, ids = null) {
        console.log("Running indexedb delete on ", ids)
        let promises = []
        let transaction = this.#db.transaction(store_id, "readwrite")
        let transaction_result = this.getTransactionPromise(transaction)
        let store = transaction.objectStore(store_id)
        if (!ids) {
            let promise = new Promise((resolve, reject) => {
                console.log("Trying to get ALL IDS for ", store_id)
                let request = store.clear()
                request.onsuccess = (e) => {
                    console.log("Executing listener callbacks")
                    this.#datastore_manager.executeListenerCallbacks(store_id, e)
                    resolve(e)
                }
                request.onerror = reject
                request.onblocked = reject
            })
            promises.push(promise)
        } else {
            if (ids.constructor.name !== "Array") {
                ids = [ids]
            }
            // Loop input
            ids.forEach(id => {
                console.log("Looping for an input ID(s): ", id)
                let promise = new Promise((resolve, reject) => {
                    console.log("Trying to delete this ID", id, store_id)
                    let request = store.delete(Number(id))
                    request.onsuccess = (e) => {
                        console.log("Executing listener callbacks", e)
                        this.#datastore_manager.executeListenerCallbacks(store_id, e)
                        resolve(e)
                    }
                    request.onerror = reject
                    request.onblocked = reject
                })
                promises.push(promise)
            })
        }

        await transaction_result
        return Promise.all(promises)
    }

    getTransactionPromise (transaction) {
        return new Promise((resolve, reject) => {
            transaction.addEventListener("complete", (e) => {
                // console.log("Transaction complete in promise", e)
                resolve(e)
            })
            transaction.addEventListener("error", (e) => {
                // console.log("Transaction error in promise", e)
                reject(e)
            })
        })
    }

    async get (store_id, ids = null) {       
        let promises = []
        let transaction = this.#db.transaction(store_id, "readonly")
        let transaction_result = this.getTransactionPromise(transaction)
        let store = transaction.objectStore(store_id)
        if (!ids) {
            let promise = new Promise((resolve, reject) => {
                let request = store.getAll()
                request.onsuccess = (e) => {
                    resolve(e)
                }
                request.onerror = reject
                request.onblocked = reject
            })
            promises.push(promise)
        } else {
            if (ids.constructor.name !== "Array") {
                ids = [ids]
            }
            // Loop input
            ids.forEach(id => {
                let promise = new Promise((resolve, reject) => {
                    let request = store.get(Number(id))
                    request.onsuccess = (e) => {
                        resolve(e)
                    }
                    request.onerror = reject
                    request.onblocked = reject
                })
                promises.push(promise)
            })
        }
        await transaction_result
        return Promise.all(promises)
    }

    getTransaction (store_id) {
        return this.#db.transaction(store_id)
    }

    getAllByKey (store_id, key_name, key) {
        return new Promise((resolve, reject) => {
            let transaction = this.getTransaction(store_id)
            let store = transaction.objectStore(store_id)
            let request = store.getAll()
            request.onsuccess = (e) => { 
                console.log("get all by key", e)
                resolve(e) }
            request.onerror = (e) => { reject(e) }
        })
    }

    async getAllWhere (store_id, test) {
        // TODO: Use cursor
        return new Promise((resolve, reject) => {
            let transaction = this.getTransaction(store_id)
            let store = transaction.objectStore(store_id)
            let request = store.getAll()
            request.onsuccess = ({target}) => {
                let results = [] 
                target.result.forEach(e => {
                    if (test(e)) {
                        results.push(e)
                    }
                })
                resolve(results) }
            request.onerror = (e) => { reject(e) }
        })
    }

}