import IndexedDBDataStoreAdapter from "./IndexedDBDataStoreAdapter.js"

export class DataStoreManager {

    #application = undefined
    #stateChannelManager = undefined

    #adapter = new IndexedDBDataStoreAdapter(this)

    #listener_pools = []

    constructor (application, stateChannelManager) {
        this.#application = application
        this.#stateChannelManager = stateChannelManager
    }

    register () {
        // console.log("Registering connected data store...", this)
        let context = {
            storeName: this.#adapter.getStoreName()
        }
        this.#application.handleEvent("dataStoreConnected", context)
    }

    registerListener (store_id, callback, key = null, match = null) {
        let listener_pool = this.#listener_pools.find(l => l.store_id === store_id)
        // console.log("Checked for existing listener pool", store_id)
        // console.log("Checked for existing listener pool", listener_pool)
        if (!listener_pool) {
            // console.log("No listener pool found")
            let pool = {
                store_id: store_id,
                listeners: []
            }
            this.#listener_pools.push(pool)
            listener_pool = this.#listener_pools.at(-1)
            // console.log("Created this listener pool", this.#listener_pools)
        }
        let listener = {
            key: key,
            match: match,
            callback: callback
        }
        // console.log("Registering listener here:", listener)

        listener_pool.listeners.push(listener)
    }

    executeListenerCallbacks (store_id, data) {
        // console.log("executeLis... args", store_id, data)
        this.#stateChannelManager.pushState(store_id, data)
        // let pool = this.#listener_pools.find(l => l.store_id === store_id)
        // if (pool) {
        //     pool.listeners.forEach(listener => {
        //         console.log("executeListenerCallbacks: data", data)
        //         if (!listener.key && !listener.match) {
        //             return listener.callback(data, event)
        //         }
        //         if (data[listener.key] === listener.match) {
        //             console.log("SWEET SHIT MAYNE IT WRKS", data, event)
        //             return listener.callback(data, event)
        //         }
        //     })
        // }
    }

    async add (store_id, entry) {
        return this.#adapter.add(store_id, entry)
    }

    async update (store_id, updated_entries) {
        return this.#adapter.update(store_id, updated_entries)
    }

    async delete (store_id, ids) {
        return this.#adapter.delete(store_id, ids)
    }

    async get (store_id, ids = null) {
        const query = await this.#adapter.get(store_id, ids)
        if (query[0]) {
            return query[0].target.result
        }
        console.log("Query res", query)
        return null
    }

    async getWhere (store_id, test) {
        return this.#adapter.getAllWhere(store_id, test)
    }
}