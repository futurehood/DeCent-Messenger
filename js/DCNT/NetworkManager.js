import {SignalingManager} from "./SignalingManager.js";
import {PeerManager} from "./PeerManager.js";

export class NetworkManager {

    #application
    #dataStore

    #signalingManager
    #peerManager = new PeerManager(this)

    #peerConnections = []
    #pendingIceCandidates = []

    constructor (application, dataStore, signalingProtocols) {
        this.#application = application
        this.#dataStore = dataStore
        this.#signalingManager = new SignalingManager(this, signalingProtocols)
    }

    toggleConnectionState (host) {
        const server = this.#signalingManager.getSignalingServer(host)
        if (server) {
            this.#signalingManager.removeSignalingServer(host)
        } else {
            this.#signalingManager.addSignalingServer(host)
        }
    }

    broadcastEvent (eventName, context) {
        this.#application.handleEvent(eventName, context)
    }

    addSignalingServer (host) {
        this.#signalingManager.addSignalingServer(host)
    }

    removeSignalingServer (host) {
        this.#signalingManager.removeSignalingServer(host)
    }

    sendSignalingFrame (host, frame) {
        this.#signalingManager.sendSignalingFrame(host, frame)
    }

    addPeerConnection (host, id, remoteId = null) {
        return this.#peerManager.addPeerConnection(host, id, remoteId)
    }

    getSignalingServerByHost (host) {
    }

    getSignalingServers () {
        // return this.#signalingServers
    }

    getPeerConnectionById (id) {
        return this.#peerManager.getPeerConnectionById(id)
    }

    getPeerConnectionByRemoteConnectionId (id) {
        return this.#peerConnections.find(el => el.getRemoteConnectionId() === id)
    }

    disconnect () {
        this.#signalingManager.getSignalingServers().forEach(s => { console.log("S", s); this.#signalingManager.removeSignalingServer(s.host) })
        this.#peerManager.getPeerConnections().forEach(pc => { pc.disconnect() })
    }

}