import { StateChannelManager } from "./StateChannelManager.js";
import { DataStoreManager } from "./DataStoreManager.js";
import { UIManager } from "./UIManager.js";
import { NetworkManager} from "./DCNT/NetworkManager.js"
import { FileTransferManager } from "./FileTransferManager.js";

export class Application {

    #stateChannelManager = new StateChannelManager()
    #uiManager = new UIManager(this)
    #dataStore = new DataStoreManager(this, this.#stateChannelManager)
    #networkManager = new NetworkManager(this, this.#dataStore, ["messenger"])
    #fileTransferManager = new FileTransferManager()

    #receivedBuffers = []

    #events = {
        dataStoreConnected: (e) => {
            this.initializeUserInterface()
        },
        signaling: (e) => {
            switch (e.event) {
                case "open":
                    this.#uiManager.runCallback("connectionStateChange", e)
                    break
                case "close":
                    // Do UI updates for connection state change...
                    this.#uiManager.runCallback("connectionStateChange", e)
                    break
                case "message":
                    break
            }
        },
        connectionStateChange: async (e) => {
            // If the connection was just established, send profile data
            this.#uiManager.runCallback("connectionStateChange", e)
        },
        toggleConnectionState: async (context) => {
            if (!context.host && !context.connectionId) {
                throw Error("Host or connection ID is required")
            }
            // Get status of connection
            return this.#networkManager.toggleConnectionState(context.host)
        },
        dataChannelMessage: context => {
            let message = context.event.data
            if (context.dataChannel.getLabel() !== "file") {
                message = JSON.parse(message)
            }
            switch (context.dataChannel.getLabel()) {
                // Handle base channel message
                case "base":
                    // Handle base channel request message
                    if (message.request) {
                        switch (message.request) {
                            // Handle request for user metadata
                            case "avatar":
                                const profile = this.#uiManager.getProfile()
                                const fileChannelOptions = { negotiated: true, id: 1, binaryType: "arraybuffer" }
                                context.dataChannelManager.addDataChannel("file", fileChannelOptions)
                                // Send base channel message with filename?
                                const fileMetadata = {
                                    name: "avatar."+profile.avatar.name.split(".").pop(),
                                    size: profile.avatar.size,
                                    type: profile.avatar.type
                                }
                                context.dataChannel.send({ file: fileMetadata }, true)
                                context.dataChannelManager.send("file", profile.avatar)
                                break
                            // Handle request for messaging channel
                            case "messaging":
                                context.dataChannelManager.addDataChannel("messaging", { negotiated: true, id: 2})
                                break
                            case "call":
                                context.dataChannelManager.addDataChannel("call", { negotiated: true, id: 2})
                                break
                        }
                    }
                    // Handle base channel confirm message
                    if (message.confirm) {
                        // Process queue for channel
                        const targetChannel = context.dataChannelManager.getDataChannel(message.confirm)
                        targetChannel.setConfirmed(true)
                        context.dataChannelManager.processQueue(message.confirm)
                        if (message.confirm === "base") {
                            context.dataChannel.send({ request: "avatar" })
                        }
                    }
                    if (message.file) {
                        this.#fileTransferManager.queueFileTransfer(message.file)
                        break
                    }
                    break
                case "messaging":
                    const messageContext = {
                        remoteHost: context.peerConnection.getRemoteHost(),
                        connectionId: context.peerConnection.getLocalConnectionId(),
                        message: (JSON.parse(context.event.data)).message
                    }
                    this.#uiManager.runCallback("addMessage", messageContext)
                    break

                case "file":
                    const progress = this.#fileTransferManager.fillBuffer(context.event.data)
                    if (progress === 1) {
                        const blob = this.#fileTransferManager.generateBlob()
                        let objectURL = URL.createObjectURL(blob)
                        let target = document.querySelector(`[data-connection-id="${context.peerConnection.getLocalConnectionId()}"]>label>img`)
                        if (target) {
                            target.style.backgroundImage = `url("${objectURL}")`
                        }
                    }
                    break
            }
        },
        dataChannelOpened: context => {
            let baseChannel = context.dataChannelManager.getDataChannel("base")
            // Send channel open confirmation
            baseChannel.send({ confirm: context.dataChannel.getLabel() })
        },
        addServer: async (context) => {
            let serverEntryId = await this.#dataStore.add("servers", context)
        },
        deleteServer: async (context)  => {
            if (window.confirm("Confirm server deletion?")) {
                // Attempt disconnect first, then delete entry record
                let signalingServer = this.#networkManager.getSignalingServerByHost(context.host)
                if (signalingServer) {
                    signalingServer.disconnect()
                }
                const result = await this.#dataStore.delete("servers", context.id)
                if (result[0] && result[0].type === "success") {
                    this.#uiManager.runCallback
                }
            }
        },
        reloadServers: async (context) => {
            let servers = await this.#dataStore.getWhere("servers", (s) => { return s.profile_id === Number(context.profileId) })
            this.#stateChannelManager.pushState("servers", servers)
        },
        addContact: async (context) => {
            let result = await this.#dataStore.add("contacts", context)
        },
        saveContact: async (context) => {
            let result = await this.#dataStore.update("contacts", context)
        },
        deleteContact: async (id) => {
            let result = await this.#dataStore.delete("contacts", id)
        },
        sendMessage: async (context) => {
            // Obtain messaging channel
            let connection = this.#networkManager.getPeerConnectionById(context.connectionId)
            let messagingChannel = connection.getDataChannel("messaging")
            if (!messagingChannel) {
                let baseChannel = connection.getDataChannel("base")
                let request = {
                    request: "messaging"
                }
                baseChannel.send(request)
                messagingChannel = connection.addDataChannel("messaging", { negotiated: true, id: 2})
            }
            connection.getDataChannelManager().send("messaging", { message: context.message })

            // this.#dispatcher.dispatch(messageContext)
        },
        saveProfile: (context) => {
            this.#dataStore.add("profiles", context)
        },
        deleteProfile: (id) => {
            if (window.confirm("Confirm profile deletion?")) {
                this.#dataStore.delete("profiles", id)
            }
        },
        signOut: async (e) => {
            await this.#dataStore.delete("active_profile", 1)
            const profiles = await this.#dataStore.get("profiles")
            this.#networkManager.disconnect()
            this.#uiManager.runCallback("signOut", profiles)
        }
    }

    constructor () {}

    async initializeUserInterface () {
        // Get active profile state from data store
        const activeProfile = await this.#dataStore.get("active_profile", 1)
        // Determine active profile or show sign in modal
        if (!activeProfile) {
            // Load all profiles
            let profiles = await this.#dataStore.get("profiles")
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
            let profile = await this.#dataStore.get("profiles", activeProfile.profile_id)
            await this.initializeProfile(profile)
        }
    }

    async initializeProfile (profile) {
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
        let servers = await this.#dataStore.getWhere("servers", c => c.profile_id === profile.id)
        this.#stateChannelManager.pushState("servers", servers)
        servers.forEach(server => {
            this.#networkManager.addSignalingServer(server.host)
        })
        // Init contacts
        let contacts = await this.#dataStore.getWhere("contacts", c => c.profile_id === profile.id)
        this.#stateChannelManager.pushState("contacts", contacts)
        contacts.forEach(contact => {
            this.#networkManager.addSignalingServer(contact.host)
        })
        // Init UI
        this.#uiManager.initialize(profile)
    }

    getContactByHost (host) {
        return this.#dataStore.getWhere("contacts", c => {  return c.host === host })
    }

    getConnectionTime(connectionId) {
        const peerConnection = this.#networkManager.getPeerConnectionById(connectionId)
        return peerConnection.getConnectionTime()
    }

    async add (storeId, entry) {
        return this.#dataStore.add(storeId, entry)
    }

    async get (storeId, id) {
        return await this.#dataStore.get(storeId, id)
    }

    async update (storeId, entry) {
        return await this.#dataStore.update(storeId, entry)
    }

    async delete (storeId, id) {
        return await this.#dataStore.delete(storeId, id)
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







