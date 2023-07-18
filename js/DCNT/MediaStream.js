export class MediaStream {

    #peerConnection
    #mediaStream

    #mediaStreamEvents = {
        addTrack: (e) => {
            this.#peerConnection.broadcastEvent("trackAdded", e)
        },
        removeTrack: (e) => {
            this.#peerConnection.broadcastEvent("trackRemoved", e)
        }
    }

    #mediaStreamTrackEvents = {
        ended: (e) => {
            this.#peerConnection.broadcastEvent("trackEnded", e)
        },
        mute: (e) => {
            this.#peerConnection.broadcastEvent("trackMuted", e)
        },
        unmute: (e) => {
            this.#peerConnection.broadcastEvent("trackUnmuted", e)
        }
    }

    constructor (peerConnection, mediaStream) {
        this.#peerConnection = peerConnection
        this.#addEventListeners()
        this.#peerConnection.addTracks(mediaStream)
    }

    #addEventListeners () {

    }

}