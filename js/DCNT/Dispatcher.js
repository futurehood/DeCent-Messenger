export class Dispatcher {

    #dataChannelManager
    #queue = []

    constructor (dataChannelManager) {
        this.#dataChannelManager = dataChannelManager
    }

    channelReady (dataChannel) {
        return dataChannel.getReadyState() === "open" && dataChannel.getConfirmed()
    }

    async queueFile (file) {
        let arrayBuffer = await file.arrayBuffer()
        for (let i = 0; i < arrayBuffer.byteLength; i += 65535) {
            const chunk = arrayBuffer.slice(i, i + 65535)
            const dispatch = {
                label: "file",
                data: chunk
            }
            this.#queue.push(dispatch)
        }
    }

    async queueDispatch (dispatch) {
        switch (dispatch.data.constructor) {
            case File:
                await this.queueFile(dispatch.data)
                // this.#queue.push(dispatch)
                break
            case String:
                if ((new TextEncoder().encode(dispatch.data)).length <= 65535) {
                    this.#queue.push(dispatch)
                }
                break
            default:
                this.#queue.push(dispatch)
                break
        }

        // Add dispatch to the queue
        const targetChannel = this.#dataChannelManager.getDataChannel(dispatch.label)

        // If DataChannel is ready and confirmed, dispatch for channel
        if (this.channelReady(targetChannel)) {
            this.processQueue(dispatch.label)
        }
    }

    processQueue (label) {
        const dataChannel = this.#dataChannelManager.getDataChannel(label)
        let channelDispatches = this.#queue.filter(m => m.label === label)
        channelDispatches.forEach(d => {
            dataChannel.send(d.data)
            this.#queue.splice(this.#queue.indexOf(d), 1)
        })
    }

}