export class Dispatcher {

    #application

    #queue = []

    constructor (application) {
        this.#application = application
    }

    dispatch (context) {
        if (context.channel.readyState === "open") {
            context.channel.send(context.message)
        } else {
            // console.log("Queuing message", context, context.channel.readyState)
            this.#queue.push(context)
        }
    }

    processQueue (dataChannel = null) {
        // console.log("Process queue running", dataChannel)
        if (dataChannel.readyState === "open") {
            let channelDispatches = this.#queue.filter(m => m.channel === dataChannel)
            channelDispatches.forEach(d => {
                // console.log("Sending", d)
                d.channel.send(d.message)
            })
        }
    }

}