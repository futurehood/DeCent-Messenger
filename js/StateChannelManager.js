export class StateChannelManager {

    #channels = {}

    addStateChannel (key) {
        this.#channels[key] = {}
        this.#channels[key]["listeners"] = []
    }

    pushState (key, value) {
        // console.log("Pushing state with key/val", key, value,)
        if (this.#channels[key]) {
            this.#channels[key]["listeners"].forEach(c => { c(value) })
        } else {
            console.log("Nothing to push state to!")
        }
    }

    addStateChangeListener (key, listener) {
        // console.log("Adding state change lisrn", key, listener)
        this.#channels[key]["listeners"].push(listener)
    }

    removeStateChangeListener (key, callback) {
        // console.log("removing istener for ", key, callback)
        let listenerIndex = this.#channels[key]["listeners"].indexOf(callback)
        if (listenerIndex > -1) {
            // console.log("ListenerIndex is > -1")
            this.#channels[key]["listeners"].splice(listenerIndex, 1)
        }
    }

}