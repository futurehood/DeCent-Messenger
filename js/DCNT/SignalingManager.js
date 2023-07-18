export class SignalingManager {

    #networkManager
    #webSocketManager

    #servers = []
    #applicationProtocols = []

    constructor (networkManager, applicationProtocols) {
        this.#networkManager = networkManager
        this.#applicationProtocols = applicationProtocols
        this.#webSocketManager = new Worker("js/DCNT/WebSocketManager.js", { type: "module" })
        this.#webSocketManager.addEventListener("message", this.receiveMessage.bind(this))
    }

    addSignalingServer (host) {
        let message = {
            type: "connect",
            host: host
        }
        this.#webSocketManager.postMessage(message)
    }

    removeSignalingServer (host) {
        if (this.#servers.find(s => s.host === host)) {
            let message = {
                type: "disconnect",
                host: host
            }
            this.#webSocketManager.postMessage(message)
        }
    }

    getSignalingServer (host) {
        return this.#servers.find(s => s.host === host)
    }

    getSignalingServers () {
        return this.#servers
    }

    sendSignalingFrame (host, frame) {
        let message = {
            type: "message",
            host: host,
            message: frame
        }
        this.#webSocketManager.postMessage(message)
    }

    receiveMessage (e) {
        switch (e.data.event) {
            case "open":
                let server = {
                    host: e.data.host,
                    readyState: e.data.readyState
                }
                this.#servers.push(server)
                this.registerApplicationProtocols(e.data.host)
                // If connection is not local server, connect with RTC
                if (!(e.data.host).includes("127.0.0.1")) {
                    const pc = this.#networkManager.addPeerConnection(e.data.host, self.crypto.randomUUID())
                    pc.setRemoteHost(e.data.host)
                    pc.addDataChannel("base", { negotiated: true, id: 0 })
                }
                break
            case "message":
                const message = JSON.parse(e.data.data)
                if (message.sdp) {
                    return this.#handleSdpSignal(e.data.host, message)
                }
                if (message.ice) {
                    return this.#handleIceCandidateSignal(message)
                }
                break
            case "error":
                break
            case "close":
                // Remove connection reference here
                this.#servers.splice(this.#servers.findIndex(s => s.host === e.data.host), 1)
                break
        }
        this.#networkManager.broadcastEvent("signaling", e.data)
    }

    registerApplicationProtocols (host) {
        let message = {
            type: "message",
            host: host,
            message: {
                protocols: this.#applicationProtocols
            }
        }
        this.#webSocketManager.postMessage(message)
    }

    async #handleSdpSignal (host, message, confirm = false) {
        let sdp = JSON.parse(message.sdp)
        if (sdp.type === "offer") {
            if (!message.remote_id) throw Error("Missing remote ID in handleSDPSignal")
            let peerConnection = this.#networkManager.getPeerConnectionByRemoteConnectionId(message.remote_id)
            if (peerConnection === undefined) {
                if (confirm) {
                    if (!window.confirm(`Accept a connection request from ${message.from}?`)) {
                        return
                    }
                }
                peerConnection = this.#networkManager.addPeerConnection(
                    host,
                    self.crypto.randomUUID(),
                    message.remote_id
                )
                if (message.session_id) {
                    peerConnection.setSessionId(message.session_id)
                }
                peerConnection.setRemoteHost(message.from)
                peerConnection.addDataChannel("base", { negotiated: true, id: 0 })
            }
            await peerConnection.setRemoteDescription(sdp)
        } else if (sdp.type === "answer") {
            let peerConnection = this.#networkManager.getPeerConnectionById(message.local_id)
            peerConnection.setRemoteConnectionId(message.remote_id)
            await peerConnection.setRemoteDescription(sdp)
        }
    }

    async #handleIceCandidateSignal (message) {
        let peerConnection = this.#networkManager.getPeerConnectionById(message.local_id)
        await peerConnection.addIceCandidate(JSON.parse(message.ice))
    }

}