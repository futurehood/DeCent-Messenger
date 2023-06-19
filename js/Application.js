import { StateChannelManager } from "./StateChannelManager.js";
import { DataStoreManager } from "./DataStoreManager.js";
import { UIManager } from "./UiManager.js";
import { ConnectionManager} from "./ConnectionManager.js"
import { ObjectRegistry } from "./ObjectRegistry.js";
import {Dispatcher} from "./Dispatcher.js";

export class Application {

    #stateChannelManager = new StateChannelManager()
    #uiManager = new UIManager(this)
    #data_store = new DataStoreManager(this, this.#stateChannelManager)
    #connectionManager = new ConnectionManager(this)
    #objectRegistry = new ObjectRegistry(this)
    #dispatcher = new Dispatcher(this)

    #active_profile
    #receivedBuffers = []

    #events = {
        dataStoreConnected: (e) => {
            // console.log("Data Store is connected! Yay")
            this.initializeUserInterface()
        },
        saveProfile: (context) => {
            // console.log("Saving a profile from context:", context)
            if (context.avatar instanceof File) {
                console.log("got file", context.avatar)
            }
            this.#data_store.add("profiles", context)
        },
        deleteProfile: (id) => {
            // console.log("Deleting a profile from context:", id)
            if (window.confirm("Confirm profile deletion?")) {
                this.#data_store.delete("profiles", id)
            }
        },

        signOut: async (context) => {
            console.log("Signing out!", context)
        },
        toggleServerConnection: async (context) => {
            console.log("Toggling server in aPPL", context)
            let server = this.#connectionManager.getSignalingServerByHost(context.host)
            if (server) {
                console.log("Got this server", server.getReadyState())
                switch (server.getReadyState()) {
                    case 1:
                        return server.disconnect()
                    case 3:
                        return server.connect()
                }
            } else {
                // No server, make one?
                let serverConfig = {
                    host: context.host,
                    applicationProtocols: ["messenger"]
                }
                this.#connectionManager.addSignalingServer(serverConfig)
            }
        },
        toggleContactConnection: async (context) => {
            console.log("Caught toggle peer in APPL", context)

            if (context.connectionId.length) {
                console.log("connection has length", context)
                let signalingServer = this.#connectionManager.getSignalingServerByHost(context.host)
                if (signalingServer) {
                    signalingServer.disconnect()
                }
                let peerConnection = this.#connectionManager.getPeerConnectionById(context.connectionId)
                peerConnection.disconnect()
                console.log("All done", peerConnection)
                // Remove connection ID!
            } else {

            }

            // Disconnect signaling server

        },
        signalingServerError: async (context) => {
            console.log("Signaling server error received!")
        },
        signalingServerConnected: async (context) => {
            console.log("Signaling server connected!", context)
            // Update UI
            // Determine whether the signaling server is a local server or remote connection
            const serverQuery = await this.#data_store.getWhere("servers", s => {
                return s.host === context.signalingServer.getUrl().host
            })
            // Local server
            if (serverQuery[0]) {
                context["local"] = true
            } else {
                // Determine if the connection is known or unknown
                const associatedContact = this.#objectRegistry.lookupAssociations(context.signalingServer)
                console.log("Associated contact lookup:", associatedContact)
                if (associatedContact) {
                    let peer = this.#connectionManager.addPeerConnection(context.signalingServer, self.crypto.randomUUID())
                    peer.setHost(associatedContact.associated.host)
                    peer.addDataChannel("base", { negotiated: true, id: 0 })
                    let selector = `[data-host="${associatedContact.associated.host}"]`
                    let contactLi = document.querySelector(selector)
                    contactLi.dataset.connectionId = peer.getLocalConnectionId()
                    console.log("Contact LI lookup[", contactLi)
                    context.contactId = associatedContact.associated.id
                }
            }
            console.log("HT query res", serverQuery)
            this.#uiManager.runCallback("connectionStateChange", context)
        },
        signalingServerDisconnected: async (context) => {
            console.log("Signaling Server disconnect in appl", context)
            // Check for TLS issue, potentially caused by untrusted cert
            if (context.event.code === 1015) {
                console.log("bad cert....!")
                this.#uiManager.runCallback("showUntrustedCertificateDialog", context)
            }
            // Determine whether the signaling server is a local server or remote connection
            const serverQuery = await this.#data_store.getWhere("servers", s => {
                return s.host === context.signalingServer.getUrl().host
            })
            if (serverQuery[0]) {
                context["local"] = true
            }
            this.#uiManager.runCallback("connectionStateChange", context)
        },
        signalingServerMessageReceived: async (context) => {
            if (context.message.sdp) {
                return this.#events.handleSdpSignal(context)
            }
            if (context.message.ice) {
                return this.#events.handleIceCandidateSignal(context)
            }
        },
        handleSdpSignal: async (context, confirm = false) => {
            let sdp = JSON.parse(context.message.sdp)
            if (sdp.type === "offer") {
                let remoteConnectionId = context.message.remote_id
                if (!remoteConnectionId) throw Error("Missing remote ID in handleSDPSignal")
                let peerConnection = this.#connectionManager.getPeerConnectionByRemoteConnectionId(remoteConnectionId)
                if (peerConnection === undefined) {
                    let confirm = false
                    if (confirm) {
                        if (!window.confirm(`Accept a connection request from ${context.message.from}?`)) {
                            return
                        }
                    }
                    peerConnection = this.#connectionManager.addPeerConnection(
                        context.signalingServer,
                        self.crypto.randomUUID()
                    )
                    if (context.message.session_id) {
                        peerConnection.setSessionId(context.message.session_id)
                    }
                    peerConnection.setHost(context.message.from)
                    peerConnection.setRemoteConnectionId(context.message.remote_id)
                    peerConnection.addDataChannel("base", { negotiated: true, id: 0 })
                }
                await peerConnection.setRemoteDescription(sdp)
            } else if (sdp.type === "answer") {
                let peerConnection = this.#connectionManager.getPeerConnectionById(context.message.local_id)
                peerConnection.setRemoteConnectionId(context.message.remote_id)
                await peerConnection.setRemoteDescription(sdp)
            }
        },
        handleIceCandidateSignal: async (context) => {
            let peerConnection = this.#connectionManager.getPeerConnectionById(context.message.local_id)
            await peerConnection.addIceCandidate(JSON.parse(context.message.ice))
        },
        peerConnectionStateChange: async (context) => {
            // console.log("Caught peer connection state change in APPL", context)
            this.#uiManager.runCallback("connectionStateChange", context)
        },
        dataChannelReceived: (context) => {
            console.log("Received remotely added DataChannel in application", context)
        },
        dataChannelOpened: async (context) => {
            console.log("Data channel opened:", context.dataChannel.label)

            // Supposed to add the data channel, yesh?


            switch (context.dataChannel.label) {
                case "base":
                    console.log("Base data channel opened", this.#active_profile.name)
                    let confirmationFrame = {
                        connected: true
                    }
                    context.peerConnection.sendDataChannelMessage("base", JSON.stringify(confirmationFrame))
                    break
                case "avatar":
                    console.log("Avatar data channel opened", context)
                    console.log("Initial Blob check:", this.#active_profile.avatar, this.#active_profile.avatar instanceof Blob)
                    if (this.#active_profile.avatar instanceof File) {
                        let arrayBuffer = await this.#active_profile.avatar.arrayBuffer()
                        console.log("Sending avatar data now...", arrayBuffer)
                        for (let i = 0; i < arrayBuffer.byteLength; i += 65535) {
                            let chunk = arrayBuffer.slice(i, i + 65535)
                            context.peerConnection.sendDataChannelMessage("avatar", chunk)
                        }
                        context.peerConnection.sendDataChannelMessage("avatar", "EOF")
                        console.log("Sent array buffer chunked", arrayBuffer)
                    }
                    // context.peerConnection.addDataChannel(context.dataChannel.label, )
                    break
                case "messaging":
                    console.log("Messaging DATA channel opened...", context)
                    // Give that shit a min to get caught up or first message drops...
                    setTimeout(() => {
                        this.#dispatcher.processQueue(context.dataChannel)
                    }, 200)
                    break
            }
        },
        dataChannelMessage: (context) => {
            console.log("Data channel message received in application:", context)
            let {data} = context.event
            console.log("Got this data!!!!!!!!!!!!!!!!@", data)
            switch (context.event.target.label) {
                case "base":
                    console.log("Got a base message", data)
                    let json = JSON.parse(data)
                    if (json["request"]) {
                        console.log("Message has a request:", json)
                        switch (json.request) {
                            case "messaging":
                                // Confirmation?
                                let messagingChannel = context.peerConnection.getDataChannel("messaging")
                                if (!messagingChannel) {
                                    context.peerConnection.addDataChannel("messaging", { negotiated: true, id: 2})
                                    let callbackContext = {
                                        name: context.peerConnection.getHost(),
                                        connectionId: context.peerConnection.getLocalConnectionId()
                                    }
                                    // this.#uiManager.runCallback("addMessagingInterface", callbackContext)
                                }
                                console.log("Request messagingn accepted")
                                break
                        }

                    }
                    break
                case "avatar":
                    console.log("Got an avatar message:", context)
                    try {
                        if (data !== "EOF") {
                            console.log("FLOWING !")
                            this.#receivedBuffers.push(data)
                        } else {
                            let arrayBuffer = this.#receivedBuffers.reduce((chunk, arrayBuffer) => {
                                const t = new Uint8Array(chunk.byteLength + arrayBuffer.byteLength)
                                t.set(new Uint8Array(chunk), 0)
                                t.set(new Uint8Array(arrayBuffer), chunk.byteLength)
                                return t
                            }, new Uint8Array())
                            const blob = new Blob([arrayBuffer], { type: "image/gif" })
                            let objectURL = URL.createObjectURL(blob)
                            let host = context.peerConnection.getSignalingServer().getUrl()
                            let target = document.querySelector(`[data-connection-id="${context.peerConnection.getLocalConnectionId()}"]>label>img`)
                            console.log("Done transferring file", blob, this.#receivedBuffers.length)
                            if (target) {
                                target.style.backgroundImage = `url("${objectURL}")`
                            }
                            console.log("TRAGET ACQUIRED", target)
                            // const a = document.createElement('a');
                            // a.href = objectURL;
                            // a.download = "avatar.gif";
                            // a.click();
                        }
                    } catch (e) {
                        console.log("Error in file transfer", e, context)
                    }
                    break
                case "messaging":
                    console.log("Got a messaging message in APPL", context,  context.event.data)
                    // TODO: Do a Contacts lookup here to get name, otherwise use host. Unknown contact should have already been added to Contacts list ul when the RTC was established
                    let messageContext = {
                        connectionId: context.peerConnection.getLocalConnectionId(),
                        name: context.peerConnection.getHost(),
                        message: context.event.data
                    }
                    this.#uiManager.runCallback("addMessage", messageContext)
                    break
            }
        },
        addServer: async (context) => {
            console.log("Caught addServer in Application")
            let serverEntryId = await this.#data_store.add("servers", context)
            console.log("Added server entry success!", serverEntryId)
        },
        deleteServer: async (context)  => {
            console.log("Delete server requested!", context)
            if (window.confirm("Confirm server deletion?")) {
                // Attempt disconnect first, then delete entry record
                let signalingServer = this.#connectionManager.getSignalingServerByHost(context.host)
                if (signalingServer) {
                    console.log("SIgnalingserver lookup result: ", signalingServer, context.host)
                    signalingServer.disconnect()
                }
                this.#data_store.delete("servers", context.id)
            }
        },
        reloadServers: async () => {
            let servers = await this.#data_store.get("servers")
            this.#stateChannelManager.pushState("servers", servers)
            console.log("ServerQuery:", servers)
        },
        addContact: async (context) => {
            await this.#data_store.add("contacts", context)
        },
        saveContact: async (context) => {
            let result = await this.#data_store.update("contacts", context)
        },
        deleteContact: async (id) => {
            let result = await this.#data_store.delete("contacts", id)
            console.log("Result fomr DELETE:", result)
        },
        openMessagingInterface: async (context) => {
            console.log("Open messaging interface>?")
        },
        sendMessage: async (context) => {
            console.log("Caught send message in APPl", context)
            // Obtain messaging channel
            let connection = this.#connectionManager.getPeerConnectionById(context.connectionId)
            console.log("RESULTZ", connection, context)
            let messagingChannel = connection.getDataChannel("messaging")
            if (!messagingChannel) {
                let baseChannel = connection.getDataChannel("base")
                let json = {
                    request: "messaging"
                }
                baseChannel.send(JSON.stringify(json))
                messagingChannel = connection.addDataChannel("messaging", { negotiated: true, id: 2})
            }
            let messageContext = {
                channel: messagingChannel,
                message: context.message
            }
            this.#dispatcher.dispatch(messageContext)
        }
    }
    constructor () {}

    getActiveProfile () {
        return this.#active_profile
    }

    async initializeUserInterface () {
        // Get active profile state from data store
        const activeProfile = await this.#data_store.get("active_profile", 1)
        // Determine active profile or show sign in modal
        if (!activeProfile) {
            // Load all profiles
            let profiles = await this.#data_store.get("profiles")
            // Register profiles state channel and add listener to update profiles list on change
            this.#stateChannelManager.addStateChannel("profiles")
            this.#stateChannelManager.addStateChangeListener(
                "profiles",
                this.#uiManager.getCallback("addCreatedProfileToProfileSelectorMenu")
            )
            // Show profile selector dialog and set callback to remove state change listener
            let dialog = await this.#uiManager.runCallback("showProfileSelectorDialog", profiles)
            dialog.onclose = e => {
                this.#stateChannelManager.removeStateChangeListener(
                    "profiles",
                    this.#uiManager.getCallback("addCreatedProfileToProfileSelectorMenu")
                )
            }
        } else {
            // Active profile was set, proceed without signing in
            let profile = await this.#data_store.get("profiles", activeProfile.profile_id)
            await this.initializeProfile(profile)
        }
    }

    async initializeProfile (profile) {
        this.#active_profile = profile
        let states = this.#stateChannelManager
        // Setup state channels
        states.addStateChannel("activeProfile")
        states.addStateChannel("servers")
        states.addStateChannel("contacts")
        // states.addStateChangeListener("activeProfile", this.#uiManager.getCallback("renderProfile"))
        states.addStateChangeListener("servers", this.#uiManager.getCallback("renderServers"))
        states.addStateChangeListener("contacts", this.#uiManager.getCallback("renderContacts"))
        // Hydrate UI profile stuffs
        states.pushState("activeProfile", profile)
        // Initialize servers
        let servers = await this.#data_store.getWhere("servers", c => c.profile_id === profile.id)
        this.#stateChannelManager.pushState("servers", servers)
        servers.forEach(server => {
            let serverConfig = {
                host: server.host,
                applicationProtocols: ["messenger"]
            }
            this.#connectionManager.addSignalingServer(serverConfig)
        })
        // Init contacts
        let contacts = await this.#data_store.getWhere("contacts", c => c.profile_id === profile.id)
        this.#stateChannelManager.pushState("contacts", contacts)
        contacts.forEach(contact => {
            let config = {
                host: contact.host,
                applicationProtocols: ["messenger"]
            }
            let peerSignalingServer = this.#connectionManager.addSignalingServer(config)
            this.#objectRegistry.registerAssociation(peerSignalingServer, contact)
        })
        // Init UI
        this.#uiManager.initialize(profile)
    }

    async add (storeId, entry) {
        return this.#data_store.add(storeId, entry)
    }

    async get (storeId, id) {
        return await this.#data_store.get(storeId, id)
    }

    async update (storeId, entry) {
        return await this.#data_store.update(storeId, entry)
    }

    async delete (storeId, id) {
        return await this.#data_store.delete(storeId, id)
    }

    getEventCallback (eventName) {
        if (this.#events[eventName]) {
             return this.#events[eventName]
        }
        return null
    }

    handleEvent (eventName, context) {
        let callback = this.getEventCallback(eventName)
        if (callback !== null) {
            callback.call(this, context)
        }
    }

}




// peerConnected: async (context) => {
//     console.log("Peer connected yay", context)
//
//     // this.#uiManager.runCallback("connectionStateChange", context)
//
//     // Refresh user meta
//
//     // Try to find matching contact list item by host
//
//     // Do lookup here
//     // let contactKnown = await this.#data_store.getWhere("contacts", (c => c.host === context.peerConnection.getUrl()))
//     // console.log("Is contact known>?", context, contactKnown)
//     //
//     // if (!contactKnown[0]) {
//     //     console.log("Contact is unknown!", context)
//     //     let callbackContext = {
//     //         connectionId: context.peerConnection.getLocalConnectionId(),
//     //         host: context.peerConnection.getUrl(),
//     //         state: 1
//     //     }
//     //     let ret = await this.#uiManager.runCallback("addUnknownContact", callbackContext)
//     //     console.log("REEET", ret)
//     //     // setTimeout(() => {
//     //     //     this.#uiManager.runCallback("connectionStateChange", callbackContext)
//     //     //     console.log("OKOK",callbackContext)
//     //     // },200)
//     // }
// },
// peerDisconnected: async (context) => {
//     console.log("Peer disconnected caught in APPL", context)
//     // this.#uiManager.runCallback("connectionStateChange", context)
// },
