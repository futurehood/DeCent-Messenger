export class DataChannel {

    #dataChannelManager
    #dataChannel
    #confirmed = false

    #events = {
        error: (e) => {
            let context = {
                dataChannel: this,
                dataChannelManager: this.#dataChannelManager,
                event: e,
            }
            this.#dataChannelManager.broadcastEvent("dataChannelError", context)
        },
        bufferedamountlow: (e) => {
            let context = {
                dataChannel: this,
                dataChannelManager: this.#dataChannelManager,
                event: e,
            }
            this.#dataChannelManager.broadcastEvent("dataChannelBufferedAmountLow", context)
        },
        open: (e) => {
            let context = {
                dataChannel: this,
                dataChannelManager: this.#dataChannelManager,
                event: e,
            }
            this.#dataChannelManager.broadcastEvent("dataChannelOpened", context)
        },
        message: (e) => {
            let context = {
                dataChannel: this,
                peerConnection: this.#dataChannelManager.getPeerConnection(),
                dataChannelManager: this.#dataChannelManager,
                event: e,
            }
            this.#dataChannelManager.broadcastEvent("dataChannelMessage", context)
        },
        closing: (e) => {
            let context = {
                dataChannel: this,
                dataChannelManager: this.#dataChannelManager,
                event: e
            }
            this.#dataChannelManager.broadcastEvent("dataChannelClosing", context)
        },
        close: (e) => {
            let context = {
                dataChannel: this,
                dataChannelManager: this.#dataChannelManager,
                event: e,
            }
            this.#dataChannelManager.broadcastEvent("dataChannelClosed", context)
        },
    }
    constructor (dataChannelManager, label, options) {
        this.#dataChannelManager = dataChannelManager
        this.#dataChannel = this.#dataChannelManager.createDataChannel(label, options)
        if (options["binaryType"]) {
            this.#dataChannel.binaryType = options.binaryType
        }
        this.#addEventListeners()
    }

    #addEventListeners () {
        this.#dataChannel.addEventListener("error", this.#events.error)
        this.#dataChannel.addEventListener("bufferedamountlow", this.#events.bufferedamountlow)
        this.#dataChannel.addEventListener("open", this.#events.open)
        this.#dataChannel.addEventListener("message", this.#events.message)
        this.#dataChannel.addEventListener("closing", this.#events.closing)
        this.#dataChannel.addEventListener("close", this.#events.close)
    }

    getReadyState() {
        return this.#dataChannel.readyState
    }

    setConfirmed (state) {
        this.#confirmed = state
    }

    getConfirmed () {
        return this.#confirmed
    }

    getLabel () {
        return this.#dataChannel.label
    }

    send (data) {
        if (data.constructor === Object) {
            data = JSON.stringify(data)
        }
        this.#dataChannel.send(data)
    }

}