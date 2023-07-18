export class StateChannelManager {

    #channels = {}

    addStateChannel (key) {
        this.#channels[key] = {}
        this.#channels[key]["listeners"] = []
    }

    pushState (key, value) {
        if (this.#channels[key]) {
            this.#channels[key]["listeners"].forEach(c => { c(value) })
        }
    }

    addStateChangeListener (key, listener) {
        this.#channels[key]["listeners"].push(listener)
    }

    removeStateChangeListener (key, callback) {
        let listenerIndex = this.#channels[key]["listeners"].indexOf(callback)
        if (listenerIndex > -1) {
            this.#channels[key]["listeners"].splice(listenerIndex, 1)
        }
    }

}