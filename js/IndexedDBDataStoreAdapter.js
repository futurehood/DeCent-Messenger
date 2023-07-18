export default class IndexedDBDataStoreAdapter {

    static #store_name = "decent-messenger"
    
    #dataStoreManager = undefined
    #db = undefined

    constructor (dataStoreManager) {
        this.#dataStoreManager = dataStoreManager
        try {
            const db = indexedDB.open(IndexedDBDataStoreAdapter.#store_name, 1)
            db.onerror = (e) => {
                console.log(e)
            }
            db.onsuccess = ({target}) => {
                this.#db = target.result
                this.#dataStoreManager.register(this)
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
            }
            db.onversionchange = e => {
                db.close()
                // TODO: Refresh page here probably...
            }
            db.close = e => {}
        } catch (Exception) {
            throw new Error("Something went wrong while connecting to the database")
        }
    }

    getStoreName() {
        return IndexedDBDataStoreAdapter.#store_name
    }

    add (store_id, data) {
        return new Promise((resolve, reject) => {
            try {
                let transaction = this.#db.transaction(store_id, "readwrite")
                let store = transaction.objectStore(store_id)
                let request = store.add(data)
                request.onsuccess = (e) => {
                    data.id = e.target.result
                    this.#dataStoreManager.updateStateChannel(store_id, data)
                    resolve(e.target.result)
                }
                request.onerror = (e) => {
                    reject(e)
                }
            } catch (e) {
                reject(e)
            }
        })
    }

    update (store_id, updated_entry) {
        return new Promise((resolve, reject) => {
            try {
                let transaction = this.#db.transaction(store_id, "readwrite")
                let store = transaction.objectStore(store_id)
                let request = store.put(updated_entry)
                request.onsuccess = (e) => {
                    this.#updateStateChannel(store_id, e)
                    resolve(true)
                }
                request.onerror = (e) => {
                    reject(false)
                }
            } catch (e) {
                reject(false)
            }
        })
    }

    async delete (store_id, ids = null) {
        let promises = []
        let transaction = this.#db.transaction(store_id, "readwrite")
        let transaction_result = this.getTransactionPromise(transaction)
        let store = transaction.objectStore(store_id)
        if (!ids) {
            let promise = new Promise((resolve, reject) => {
                let request = store.clear()
                request.onsuccess = (e) => {
                    this.#updateStateChannel(store_id, e)
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
                    let request = store.delete(Number(id))
                    request.onsuccess = (e) => {
                        this.#updateStateChannel(store_id, e)
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

    async #updateStateChannel (store_id, result) {
        if (result.type === "success") {
            if (result.target.data) {
                this.#dataStoreManager.updateStateChannel(store_id, result.target.data)
            } else {
                this.#dataStoreManager.updateStateChannel(store_id, result)
            }
        }
    }

    getTransactionPromise (transaction) {
        return new Promise((resolve, reject) => {
            transaction.addEventListener("complete", (e) => {
                resolve(e)
            })
            transaction.addEventListener("error", (e) => {
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