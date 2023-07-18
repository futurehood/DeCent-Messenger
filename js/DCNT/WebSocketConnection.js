export class WebSocketConnection {

    #webSocketManager
    #config
    #wss
    
    constructor (webSocketManager, config) {
        this.#webSocketManager = webSocketManager
        this.#config = config
        this.setUpWebSocketConnectionObject(config)
    }

    setUpWebSocketConnectionObject (host) {
        this.#wss = new WebSocket("wss://"+host, "DCNT")
        this.#wss.addEventListener("open", this.#webSocketManager.broadcastConnectionEvent)
        this.#wss.addEventListener("error", this.#webSocketManager.broadcastConnectionEvent)
        this.#wss.addEventListener("message", this.#webSocketManager.broadcastConnectionEvent)
        this.#wss.addEventListener("close", this.#webSocketManager.broadcastConnectionEvent)
    }

    getUrl () {
        return new URL(this.#wss.url)
    }

    getHost () {
        return this.getUrl().host
    }

    disconnect () {
        this.#wss.close()
    }

    send (frame) {
        this.#wss.send(JSON.stringify(frame))
    }

}