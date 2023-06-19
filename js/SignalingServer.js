export class SignalingServer {

    #connectionManager = null
    #config
    #wss = null
    #applicationProtocols = []

    #wssEvents = {
        open: (e) => {
            console.log("OPEN WSS", e)
            // Register application protocols
            this.registerProtocols()
            let context = {
                signalingServer: this,
                event:  e
            }
            this.#connectionManager.broadcastEvent(
                "signalingServerConnected",
                context
            )
        },
        message: (e) => {
            console.log("WebSocket message received:", e)
            try {
                let json = JSON.parse(e.data)
                if (json !== undefined) {
                    let context = {
                        signalingServer: this,
                        message: json
                    }
                    this.#connectionManager.broadcastEvent(
                        "signalingServerMessageReceived",
                        context
                    )
                } else {
                    throw new Error("JSON parsing error")
                }
            } catch (e) {
                // The remote client is misbehaving
                this.#wss.close()
                console.log("Exception on signaling server message handler", e)

            }
        },
        error: (e) => {
            console.log("ERRIR WSS")
            this.#connectionManager.broadcastEvent("signalingServerError", e)
        },
        close: (e) => {
            console.log("CLOSE WSS")
            let context = {
                signalingServer: this,
                event: e
            }
            this.#connectionManager.broadcastEvent("signalingServerDisconnected", context)
        }
    }

    constructor (connectionManager, config) {
        this.#connectionManager = connectionManager
        this.#config = config
        this.#applicationProtocols = config.applicationProtocols
        this.setUpWebSocketConnectionObject(config)
    }

    setUpWebSocketConnectionObject (config) {
        let host = config.host
        if (window.location.host === host) {
            console.log("Local conn")
            host+=window.location.pathname
        }
        console.log("Prepared host for signlaing server connection", host, window.location.host)
        this.#connectionManager.broadcastEvent("signalingServerConnecting", this)
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

    getReadyState () {
        return this.#wss.readyState
    }

    send (frame) {
        try {
            this.#wss.send(JSON.stringify(frame))
            console.log("WebSocket message sent:", frame)
        } catch (e) {
            console.log("Caught exception on signaling server send", e)
        }
    }

    connect () {
        this.setUpWebSocketConnectionObject(this.#config)
    }

    disconnect () {
        console.log("Disconnect wss state:", this.#wss)
        this.#wss.close()
    }

}
