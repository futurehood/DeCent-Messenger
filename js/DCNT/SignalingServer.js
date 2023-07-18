export class SignalingServer {

    #worker
    #config
    #wss
    #applicationProtocols = []

    generateStateMessage (type) {
        return {
            local: !!this.#config.local,
            event: type,
            host: this.getHost(),
            readyState: this.getReadyState()
        }
    }

    #wssEvents = {
        open: (e) => {
            // Register application protocols
            this.registerProtocols()
            this.#worker.postMessage(this.generateStateMessage(e.type))
        },
        message: (e) => {
            let json = JSON.parse(e.data)
            if (json !== undefined) {
                let message = {
                    event: e.type,
                    host: this.getUrl().host,
                    data: json
                }
                this.#worker.postMessage(message)
            } else {
                // The remote client is misbehaving
                this.#wss.close()
            }
        },
        error: (e) => {
            this.#worker.postMessage("signalingServerError", e)
        },
        close: (e) => {
            this.#worker.postMessage(this.generateStateMessage(e.type))
        }
    }

    constructor (worker, config) {
        this.#worker = worker
        this.#config = config
        this.#applicationProtocols = config.applicationProtocols
        this.setUpWebSocketConnectionObject(config)
    }

    setUpWebSocketConnectionObject (config) {
        let host = config.host
        if (config.local) {
            host+=self.location.pathname.replace("js/DCNT/WebSocketManager.js", "")
        }
        this.#worker.postMessage({
            signalingServer: this,
            event: "signalingServerConnection"
        })
        this.#wss = new WebSocket("wss://"+host, "DCNT")
        this.#wss.addEventListener("open", this.#wssEvents.open)
        this.#wss.addEventListener("error", this.#wssEvents.error)
        this.#wss.addEventListener("message", this.#wssEvents.message)
        this.#wss.addEventListener("close", this.#wssEvents.close)
    }

    registerProtocols () {
        this.send({ protocols: this.#applicationProtocols })
    }

    getUrl () {
        return new URL(this.#wss.url)
    }

    getHost () {
        return this.getUrl().host
    }

    getReadyState () {
        return this.#wss.readyState
    }

    connect () {
        this.setUpWebSocketConnectionObject(this.#config)
    }

    disconnect () {
        this.#wss.close()
    }

    send (frame) {
        this.#wss.send(JSON.stringify(frame))
    }

}
