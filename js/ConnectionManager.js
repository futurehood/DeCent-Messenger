import { SignalingServer } from "./SignalingServer.js";
import { PeerConnection } from "./PeerConnection.js";

export class ConnectionManager {

    #application = null
    #signalingProtocols = []
    #signalingServers = []

    #peerConnections = []
    #pendingIceCandidates = []

    constructor (application, signalingProtocols) {
        this.#application = application
        this.#signalingProtocols = signalingProtocols
    }

    broadcastEvent (eventName, context) {
        this.#application.handleEvent(eventName, context)
    }

    getApplication () {
        return this.#application
    }

    addSignalingServer (config) {
        console.log("Add signlaing server config: ", config)
        let signalingServer = null
        if (!this.#signalingServers.find(e => e.getUrl() === config.host)) {
            signalingServer = new SignalingServer(this, config)
            this.#signalingServers.push(signalingServer)
            return signalingServer
        }
        return signalingServer
    }

    removeSignalingServer (host) {
        let index = this.#signalingServers.findIndex((e) => e.getUrl() === host)
        if (index >= 0) {
            // Do disconnect
            let signalingServer = this.getSignalingServerByIndex(index)
            signalingServer.disconnect()
            // Remove from array
            this.#signalingServers.splice(index, 1)
            return true
        }
        return false
    }

    getSignalingServerByIndex (index) {
        return this.#signalingServers[index]
    }

    getSignalingServerById (id) {
        return this.#signalingServers.find(s => { console.log("Looping signaling servers for id match", s, s.id); s.id === Number(id)})
    }

    getSignalingServerByHost (host) {
        return this.#signalingServers.find(e => e.getUrl().host.includes(host))
    }

    disconnectSignalingServer (id) {
        if (this.#signalingServers[0].getReadyState() === 1) {
            this.#signalingServers[0].disconnect()
        }
    }

    getSignalingServers () {
        return this.#signalingServers
    }

    addPeerConnection (signalingServer, localConnectionId) {
        let peerConnection = new PeerConnection(this, signalingServer, localConnectionId)
        this.#peerConnections.push(peerConnection)
        return peerConnection
    }

    getPeerConnectionById (id) {
        return this.#peerConnections.find(el => el.getLocalConnectionId() === id)
    }

    getPeerConnectionByRemoteConnectionId (id) {
        console.log("Looking for remote connection wit id", id, this.#peerConnections)
        return this.#peerConnections.find(el => el.getRemoteConnectionId() === id)
    }

    disconnectPeerConnection (id) {
        let peerConnection = this.#peerConnections.find(pc => pc.getLocalConnectionId() === id)

        peerConnection.removeLocalTracks()

        // peerConnection.close()
    }

    getPeerConnections () {
        return this.#peerConnections
    }

    removePeerConnection (peerConnection) {
        peerConnection.close()
        let index = this.#peerConnections.findIndex(pc => pc === peerConnection)
        this.#peerConnections.splice(index, 1)
    }

    signalPendingPeerConnections (signalingServer) {
        this.#peerConnections.forEach(async (peerConnection) => {
            if (peerConnection.getSignalingServer() === signalingServer &&
                peerConnection.getSignalingRequired()) {
                console.log("TIME TO SIGNAL THEN!!!!!!!")
                // Compose signaling frame and send
                let sdp = await peerConnection.createOffer()
                peerConnection.addMediaStream(mediaStream)
                await peerConnection.setLocalDescription(sdp)
            }
        })
    }

}
