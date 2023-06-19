export class PeerConnection {

    #connectionManager = null
    #signalingServer = null
    #id = null
    #host = null
    #remoteConnectionId = null
    #sessionId = null
    #signalingRequired = true
    #rtc = new RTCPeerConnection()
    #pendingIceCandidates = []
    #dataChannels = []

    #connectionEvents = {
        negotiationNeeded: async (e) => {
            console.log("Negotiation needed", this.#id, e, this.#rtc.signalingState)
            console.log("Tracks exist?", this.#rtc.getSenders())
            if (this.#signalingRequired) {
                console.log("Signaling requird", this.#id)
                let sdp = await this.createOffer()
                await this.setLocalDescription(sdp)
            } else {
                console.log("SIgnaling not required", this.#id)

            }
        },
        signalingStateChange: async (e) => {
            console.log("Signaling State change", this.#id, e.target.signalingState, e)
            if (e.target.signalingState === "have-local-offer") {
                console.log("Send an offer!")
                let signalingFrame = {
                    // local_id: this.#remoteConnectionId,
                    remote_id: this.#id,
                    sdp: JSON.stringify(this.#rtc.localDescription)
                }
                if (this.#sessionId) {
                    signalingFrame.session_id = this.#sessionId
                }
                this.#signalingServer.send(signalingFrame)
            }
            if (e.target.signalingState === "have-remote-offer") {
                // Send answer
                console.log("Send an answer!")
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
                this.#signalingServer.send(signalingFrame)
                console.log("Sent an answer!", signalingFrame)
            }
            if (e.target.signalingState === "stable") {
                console.log("Turn loose the ICEs!", this.#id, this.#pendingIceCandidates)
                this.flushPendingIceCandidates()
            }
            // this.#connectionManager.getApplication().handleEvent("signalingStateChange", e)
        },
        connectionStateChange: (e) => {
            console.log("RTC Connection state change", e.target.connectionState)
            let context = {
                peerConnection: this,
                event: e
            }
            this.#connectionManager.getApplication().handleEvent("peerConnectionStateChange", context)
            console.log("RTC Connection state change2 ", context)

        },
        dataChannel: (e) => {
            console.log("Data channel added by peer", e)
            this.#connectionManager.getApplication().handleEvent("dataChannelReceived", e)
        },
        track: (e) => {
            let context = {
                peerConnection: this,
                event: e
            }
            e.streams[0].addEventListener("removetrack", (e) => {
                console.log("Removed track on stream", this.#id, e)
                this.#connectionManager.getApplication().handleEvent("trackRemoved", context)
                this.#rtc.close()
            })
            e.track.addEventListener("mute", () => {
                console.log("STREAM MUTED", this.#id, e)
                this.close()
            })
            e.track.addEventListener("ended", () => {
                console.log("STREAM ENDED", this.#id, e)
                this.close()
            })
            this.#connectionManager.getApplication().handleEvent("trackReceived", context)
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
            console.log("Error generating ice candidates", e)
            // this.#connectionManager.getApplication().handleEvent("iceError", e)
        },
        iceConnectionStateChange: (e) => {
            // console.log("Ice connection state change,", this.getLocalConnectionId(), e.target.iceConnectionState,  e)
            let context = {
                peerConnection: this,
                event: e
            }
            if (e.target.iceConnectionState === "failed") {
                // this.#connectionManager.getApplication().handleEvent("iceFailed", context)
            }
            if (e.target.iceConnectionState === "connected") {
                // this.#connectionManager.getApplication().handleEvent("iceConnected", context)
            }
            if (e.target.iceConnectionState === "disconnected") {
                this.#connectionManager.getApplication().handleEvent("iceDisconnected", context)
            }
            if (e.target.iceConnectionState === "closed") {
                this.#connectionManager.getApplication().handleEvent("iceClosed", context)
            }
        },
        iceGatheringStateChange: (e) => {
            // console.log("Ice gathering state change", e)
            this.#connectionManager.getApplication().handleEvent("iceGatheringStateChange", e)
        },
    }

    #dataChannelEvents = {
        error: (e) => {
            let context = {
                peerConnection: this,
                event: e,
                dataChannel: e.target
            }
            this.#connectionManager.getApplication().handleEvent("dataChannelError", context)
        },
        bufferedamountlow: (e) => {
            let context = {
                peerConnection: this,
                event: e,
                dataChannel: e.target
            }
            this.#connectionManager.getApplication().handleEvent("dataChannelBufferedAmountLow", context)
        },
        open: (e) => {
            let context = {
                peerConnection: this,
                event: e,
                dataChannel: e.target
            }
            this.#connectionManager.getApplication().handleEvent("dataChannelOpened", context)
        },
        message: (e) => {
            let context = {
                peerConnection: this,
                event: e,
                dataChannel: e.target
            }
            this.#connectionManager.getApplication().handleEvent("dataChannelMessage", context)
        },
        closing: (e) => {
            let context = {
                peerConnection: this,
                event: e,
                dataChannel: e.target
            }
            this.#connectionManager.getApplication().handleEvent("dataChannelClosing", context)
        },
        close: (e) => {
            let context = {
                peerConnection: this,
                event: e,
                dataChannel: e.target
            }
            this.#connectionManager.getApplication().handleEvent("dataChannelClosed", context)
        },
    }

    #mediaStreamEvents = {
        addTrack: (e) => {
            console.log("Track added", e)
            this.#connectionManager.getApplication().handleEvent("trackAdded", e)
        },
        removeTrack: (e) => {
            console.log("Track removed", e)
            this.#connectionManager.getApplication().handleEvent("trackRemoved", e)
        }
    }

    #mediaStreamTrackEvents = {
        ended: (e) => {
            console.log("Track added by peer", e)
            this.#connectionManager.getApplication().handleEvent("trackEnded", e)
        },
        mute: (e) => {
            console.log("Track added by peer", e)
            this.#connectionManager.getApplication().handleEvent("trackMuted", e)
        },
        unmute: (e) => {
            console.log("Track added by peer", e)
            this.#connectionManager.getApplication().handleEvent("trackUnmuted", e)
        }
    }

    constructor (connectionManager, signalingServer, id) {
        this.#connectionManager = connectionManager
        this.#signalingServer = signalingServer
        this.#id = id
        this.setUpRtcConnectionObject()
    }
    setUpRtcConnectionObject () {
        console.log("Creating a rtc with this signaling server:", this.#signalingServer)
        let config= {
            iceServers: [
                {
                    urls: "stun:iphone-stun.strato-iphone.de:3478"
                },
            ]
        }
        this.#rtc = new RTCPeerConnection(config)
        this.#rtc.addEventListener("signalingstatechange", this.#connectionEvents.signalingStateChange)
        this.#rtc.addEventListener("connectionstatechange", this.#connectionEvents.connectionStateChange)
        this.#rtc.addEventListener("negotiationneeded", this.#connectionEvents.negotiationNeeded)
        this.#rtc.addEventListener("datachannel", this.#dataChannelEvents.dataChannel)
        this.#rtc.addEventListener("track", this.#connectionEvents.track)
        this.#rtc.addEventListener("icecandidate", this.#iceEvents.iceCandidate)
        this.#rtc.addEventListener("icecandidateerror", this.#iceEvents.iceCandidateError)
        this.#rtc.addEventListener("iceconnectionstatechange", this.#iceEvents.iceConnectionStateChange)
        this.#rtc.addEventListener("icegatheringstatechange", this.#iceEvents.iceGatheringStateChange)
    }

    refreshConnectionObject () {
        console.log("Refreshing connection object", this.#id)
        this.#dataChannels.forEach(dataChannel => dataChannel.close())
        this.#dataChannels = []
        this.#rtc = null
        this.setUpRtcConnectionObject()
    }

    addDataChannel (name, options = {}) {
        console.log("Creating a data channel (name/id):", name, options)
        let dataChannel = this.#rtc.createDataChannel(name, options)
        dataChannel.addEventListener("error", this.#dataChannelEvents.error)
        dataChannel.addEventListener("bufferedamountlow", this.#dataChannelEvents.bufferedamountlow)
        dataChannel.addEventListener("open", this.#dataChannelEvents.open)
        dataChannel.addEventListener("message", this.#dataChannelEvents.message)
        dataChannel.addEventListener("closing", this.#dataChannelEvents.closing)
        dataChannel.addEventListener("close", this.#dataChannelEvents.close)
        if (options["binaryType"]) {
            console.log("binaryType is set, setting it on dc", options.binaryType)
            dataChannel.binaryType = options.binaryType
        }
        console.log("Check binaryType:", dataChannel.binaryType)
        this.#dataChannels.push(dataChannel)
        return dataChannel
    }

    getDataChannel (name) {
        return this.#dataChannels.find(c => c.label === name)
    }

    removeDataChannel (label) {
        let index = this.#dataChannels.findIndex(dataChannel => dataChannel.label === label)
        this.#dataChannels[index].close()
        this.#dataChannels.splice(index, 1)
    }
    sendDataChannelMessage (id, message) {
        console.log("DATA CHANNELS:", this.#id, this.#dataChannels)
        let dataChannel = this.#dataChannels.find(dc => dc.label === id)
        if (dataChannel.readyState === "open") {
            console.log("Ready and sending... now")
            dataChannel.send(message)
        } else {
            console.log("DataChannel not ready", dataChannel.readyState)
        }
    }

    addMediaStream (mediaStream) {
        console.log("Adding media stream to peer connection", this.#id, mediaStream)
        mediaStream.getTracks().forEach(track => this.#rtc.addTrack(track, mediaStream))
    }

    removeTrack (sender) {
        console.log("")
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
                this.#signalingServer.send(signalingFrame)
            })
            this.#pendingIceCandidates = []
        }
    }

    getConnectionState () {
        return this.#rtc.iceConnectionState
    }

    close () {
        console.log("Closing connection", this.#id)
        this.#signalingRequired = true
        this.#rtc.close()
    }

    disconnect () {
        console.log("Disconnecting connection", this.#id)
        this.#signalingRequired = true
        this.#rtc.close()
    }

    setSignalingRequired (bool) {
        this.#signalingRequired = bool
    }

    getSignalingRequired () {
        return this.#signalingRequired
    }

    getSignalingServer () {
        return this.#signalingServer
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

    setHost (host) {
        this.#host = host
    }

    getHost () {
        return this.#host
    }

    async createOffer () {
        return this.#rtc.createOffer()
    }

    async createAnswer () {
        return this.#rtc.createAnswer()
    }

    async setLocalDescription (sdp) {
        console.log("Setting local desc", sdp)
        return this.#rtc.setLocalDescription(sdp)
    }

    async setRemoteDescription (sdp) {
        console.log("Setting remote desc", sdp)
        return this.#rtc.setRemoteDescription(sdp)
    }

    async addIceCandidate (candidate) {
        console.log("Adding ICE candidate to peer connection")
        return this.#rtc.addIceCandidate(candidate)
    }
}
