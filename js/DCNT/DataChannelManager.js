import {DataChannel} from "./DataChannel.js";
import {Dispatcher} from "./Dispatcher.js";

export class DataChannelManager {

    #peerConnection
    #dispatcher = new Dispatcher(this)

    #dataChannels = []

    constructor (peerConnection) {
        this.#peerConnection = peerConnection
    }

    broadcastEvent (eventName, context) {
        this.#peerConnection.broadcastEvent(eventName, context)
    }

    getPeerConnection () {
        return this.#peerConnection
    }

    getConnectionId () {
        return this.#peerConnection.getLocalConnectionId()
    }

    addDataChannel (label, options = {}) {
        this.#dataChannels.push(new DataChannel(this, label, options))
        return this.#dataChannels[this.#dataChannels.length - 1]
    }

    createDataChannel (label, options) {
        return this.#peerConnection.createDataChannel(label, options)
    }

    getDataChannel (label) {
        return this.#dataChannels.find(c => c.getLabel() === label)
    }

    removeDataChannel (label) {
        let index = this.#dataChannels.findIndex(dataChannel => dataChannel.label === label)
        this.#dataChannels[index].close()
        return this.#dataChannels.splice(index, 1)
    }

    processQueue (label) {
        this.#dispatcher.processQueue(label)
    }

    send (label, data) {
        let dataChannel = this.getDataChannel(label)
        if (!dataChannel) {
            // dataChannel = this.addDataChannel(label)
            throw new Error("No DataChannel found!")
        }
        const dispatch = {
            label: label,
            data: data
        }
        this.#dispatcher.queueDispatch(dispatch)
    }

}