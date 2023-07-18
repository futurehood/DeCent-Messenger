import {PeerConnection} from "./PeerConnection.js";

export class PeerManager {

    #networkManager
    #connections = []

    constructor (networkManager) {
        this.#networkManager = networkManager
    }

    addPeerConnection (host, localConnectionId, remoteConnectionId = null) {
        let peerConnection = new PeerConnection(this, host, localConnectionId)
        if (remoteConnectionId) {
            peerConnection.setRemoteConnectionId(remoteConnectionId)
        }
        this.#connections.push(peerConnection)
        return peerConnection
    }

    getPeerConnections () {
        return this.#connections
    }

    getPeerConnectionById (id) {
        return this.#connections.find(el => el.getLocalConnectionId() === id)
    }

    sendSignalingFrame (host, frame) {
        this.#networkManager.sendSignalingFrame(host, frame)
    }

    broadcastEvent (eventName, context) {
        this.#networkManager.broadcastEvent(eventName, context)
    }

}