import {WebSocketConnection} from "./WebSocketConnection.js";

class WebSocketManager {

    #connections = []

    constructor () {
        self.addEventListener("message", this.receiveMessage.bind(this))
    }

    receiveMessage (e) {
        if (!e.data.type) {
            throw Error("SignalingManager message is missing type property")
        }
        const server = this.#connections.find(s => s.getHost() === e.data.host)
        switch (e.data.type) {
            case "connect":
                this.addConnection(e.data.host)
                break
            case "disconnect":
                server.disconnect()
                this.removeConnection(server)
                break
            case "message":
                server.send(e.data.message)
                break
        }
    }

    broadcastConnectionEvent (e) {
        const message = {
            event: e.type,
            readyState: e.target.readyState,
            host: (new URL(e.target.url)).host
        }
        if (e.data) {
            message.data = e.data
        }
        self.postMessage(message)
    }

    addConnection (host) {
        if ((host).includes("127.0.0.1")){
            host += "/messenger/"
        }
        this.#connections.push(new WebSocketConnection(this, host))
    }

    removeConnection (server) {
        this.#connections.splice(this.#connections.indexOf(server), 1)
    }

}

new WebSocketManager()