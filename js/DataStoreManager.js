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
        let context = {
            storeName: this.#adapter.getStoreName()
        }
        this.#application.handleEvent("dataStoreConnected", context)
    }

    updateStateChannel (store_id, data) {
        this.#stateChannelManager.pushState(store_id, data)
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
        return null
    }

    async getWhere (store_id, test) {
        return this.#adapter.getAllWhere(store_id, test)
    }
}