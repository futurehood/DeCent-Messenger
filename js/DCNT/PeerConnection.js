import {DataChannel} from "./DataChannel.js";
import {MediaStream} from "./MediaStream.js";
import {DataChannelManager} from "./DataChannelManager.js";

export class PeerConnection {

    #peerManager
    #signalingHost
    #rtc
    #dataChannelManager = new DataChannelManager(this)

    #id
    #remoteHost
    #remoteConnectionId
    #sessionId
    #signalingRequired = true
    #pendingIceCandidates = []
    #dataChannels = []
    #mediaStreams = []

    #connectionEvents = {
        negotiationNeeded: async (e) => {
            if (this.#signalingRequired) {
                let sdp = await this.createOffer()
                await this.setLocalDescription(sdp)
            }
        },
        signalingStateChange: async (e) => {
            if (e.target.signalingState === "have-local-offer") {
                let signalingFrame = {
                    // local_id: this.#remoteConnectionId,
                    remote_id: this.#id,
                    sdp: JSON.stringify(this.#rtc.localDescription)
                }
                if (this.#sessionId) {
                    signalingFrame.session_id = this.#sessionId
                }
                this.#peerManager.sendSignalingFrame(this.#signalingHost, signalingFrame)
            }
            if (e.target.signalingState === "have-remote-offer") {
                let sdp = await this.createAnswer()
                await this.setLocalDescription(sdp)
                let signalingFrame = {
                    local_id: this.#remoteConnectionId,
                    remote_id: this.#id,
                    sdp: JSON.stringify(sdp)
                }
                if (this.#sessionId) {
                    signalingFrame.session_id = this.#sessionId
                }
                this.#peerManager.sendSignalingFrame(this.#signalingHost, signalingFrame)
            }
            if (e.target.signalingState === "stable") {
                this.flushPendingIceCandidates()
            }
            // this.#peerManager.broadcastEvent("signalingStateChange", e)
        },
        connectionStateChange: (e) => {
            if (e.target.connectionState === "connected") {
                this.setConnectionTime(new Date())
            }
            let context = {
                peerConnection: this,
                event: e.type
            }
            this.#peerManager.broadcastEvent("connectionStateChange", context)

        },
        dataChannel: (e) => {
            this.#peerManager.broadcastEvent("dataChannelReceived", e)
        },
        track: (e) => {
            let context = {
                peerConnection: this,
                event: e
            }
            e.streams[0].addEventListener("removetrack", (e) => {
                this.#peerManager.broadcastEvent("trackRemoved", context)
                this.#rtc.close()
            })
            e.track.addEventListener("mute", () => {
                this.close()
            })
            e.track.addEventListener("ended", () => {
                this.close()
            })
            this.#peerManager.broadcastEvent("trackReceived", context)
        }
    }

    #iceEvents = {
        iceCandidate: (e) => {
            if (e.candidate !== null) {
                this.#pendingIceCandidates.push(e.candidate)
            }
            if (this.#rtc.signalingState === "stable") {
                this.flushPendingIceCandidates()
            }
        },
        iceCandidateError: (e) => {
            this.#peerManager.broadcastEvent("iceError", e)
        },
        iceConnectionStateChange: (e) => {
            let context = {
                peerConnection: this,
                event: e
            }
            if (e.target.iceConnectionState === "failed") {
                this.#peerManager.broadcastEvent("iceFailed", context)
            }
            if (e.target.iceConnectionState === "connected") {
                this.#peerManager.broadcastEvent("iceConnected", context)
            }
            if (e.target.iceConnectionState === "disconnected") {
                this.#peerManager.broadcastEvent("iceDisconnected", context)
            }
            if (e.target.iceConnectionState === "closed") {
                this.#peerManager.broadcastEvent("iceClosed", context)
            }
        },
        iceGatheringStateChange: (e) => {
            this.#peerManager.broadcastEvent("iceGatheringStateChange", e)
        },
    }
    #connectionTime

    constructor (peerManager, signalingHost, id) {
        this.#peerManager = peerManager
        this.#signalingHost = signalingHost
        this.#id = id
        this.#rtc = this.#createRTCPeerConnection()
        this.#addEventListeners()
    }

    #createRTCPeerConnection () {
        let config= {
            iceServers: [
                {
                    urls: "stun:iphone-stun.strato-iphone.de:3478"
                },
            ]
        }
        return new RTCPeerConnection(config)
    }

    #addEventListeners () {
        this.#rtc.addEventListener("signalingstatechange", this.#connectionEvents.signalingStateChange)
        this.#rtc.addEventListener("connectionstatechange", this.#connectionEvents.connectionStateChange)
        this.#rtc.addEventListener("negotiationneeded", this.#connectionEvents.negotiationNeeded)
        this.#rtc.addEventListener("datachannel", this.#connectionEvents.dataChannel)
        this.#rtc.addEventListener("track", this.#connectionEvents.track)
        this.#rtc.addEventListener("icecandidate", this.#iceEvents.iceCandidate)
        this.#rtc.addEventListener("icecandidateerror", this.#iceEvents.iceCandidateError)
        this.#rtc.addEventListener("iceconnectionstatechange", this.#iceEvents.iceConnectionStateChange)
        this.#rtc.addEventListener("icegatheringstatechange", this.#iceEvents.iceGatheringStateChange)
    }

    broadcastEvent (eventName, context) {
        this.#peerManager.broadcastEvent(eventName, context)
    }

    async createOffer () {
        return this.#rtc.createOffer()
    }

    async createAnswer () {
        return this.#rtc.createAnswer()
    }

    async setLocalDescription (sdp) {
        return this.#rtc.setLocalDescription(sdp)
    }

    async setRemoteDescription (sdp) {
        return this.#rtc.setRemoteDescription(sdp)
    }

    async addIceCandidate (candidate) {
        return this.#rtc.addIceCandidate(candidate)
    }

    setConnectionTime (date) {
        this.#connectionTime = date
    }

    getConnectionTime () {
        return this.#connectionTime
    }

    getDataChannelManager () {
        return this.#dataChannelManager
    }

    addDataChannel (label, options = {}) {
        return this.#dataChannelManager.addDataChannel(label, options)
    }

    createDataChannel (label, options) {
        return this.#rtc.createDataChannel(label, options)
    }

    getDataChannel (label) {
        return this.#dataChannelManager.getDataChannel(label)
    }

    removeDataChannel (label) {
        let index = this.#dataChannels.findIndex(dataChannel => dataChannel.label === label)
        this.#dataChannels[index].close()
        this.#dataChannels.splice(index, 1)
    }

    send (label, data) {
        return this.#dataChannelManager.send(label, data)
    }

    addMediaStream (mediaStream) {
        this.#mediaStreams.push(new MediaStream(this, mediaStream))
        return this.#mediaStreams[this.#mediaStreams.length - 1]
    }

    addTracks (mediaStream) {
        mediaStream.getTracks().forEach(track => this.#rtc.addTrack(track, mediaStream))
    }

    removeTrack (sender) {
        return this.#rtc.removeTrack(sender)
    }

    getTracks () {
        return this.#rtc.getSenders()
    }

    removeLocalTracks () {
        this.#rtc.getSenders().forEach(sender => {
            this.#rtc.removeTrack(sender)
        })
    }

    flushPendingIceCandidates () {
        if (this.#remoteConnectionId) {
            this.#pendingIceCandidates.forEach((candidate) => {
                let signalingFrame = {
                    local_id: this.#remoteConnectionId,
                    remote_id: this.#id,
                    ice: JSON.stringify(candidate)
                }
                if (this.#sessionId) {
                    signalingFrame.session_id = this.#sessionId
                }
                this.#peerManager.sendSignalingFrame(this.#signalingHost, signalingFrame)
            })
            this.#pendingIceCandidates = []
        }
    }

    close () {
        this.#signalingRequired = true
        this.#rtc.close()
    }

    disconnect () {
        this.#signalingRequired = true
        this.#rtc.close()
    }

    getConnectionState () {
        return this.#rtc.connectionState
    }

    setSignalingRequired (bool) {
        this.#signalingRequired = bool
    }

    getSignalingRequired () {
        return this.#signalingRequired
    }

    getSignalingServer () {
        return this.#signalingHost
    }

    setSessionId(id) {
        this.#sessionId = id
    }

    getSessionId() {
        return this.#sessionId
    }

    getLocalConnectionId () {
        return this.#id
    }

    setRemoteConnectionId (id) {
        this.#remoteConnectionId = id
    }

    getRemoteConnectionId () {
        return this.#remoteConnectionId
    }

    getSignalingHost () {
        return this.#signalingHost
    }

    setRemoteHost (host) {
        this.#remoteHost = host
    }

    getRemoteHost () {
        return this.#remoteHost
    }

}