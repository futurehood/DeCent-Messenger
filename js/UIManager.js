import {UIUtilities} from "./UIUtilities.js";

export class UIManager {

    #application = null
    #utilities = new UIUtilities()

    #dialogs = document.getElementById("dialogs")

    #profile
    #profile_id = document.getElementById("profile-id")

    #serversState = document.getElementById("connection-state")
    #serversForm = document.getElementById("servers")
    #profileForm = document.getElementById("profile")
    #serversList = document.querySelector("#servers>fieldset>ul")

    #contactsForm = document.querySelector("#contacts>form")
    #contactsList = this.#contactsForm.querySelector("ul")
    #messageList = document.querySelector("#messaging>ul")
    #messagingWindows = document.getElementById("messaging-windows")

    #connectionsForm = document.querySelector("#connections>form")


    getProfile () {
        return this.#profile
    }

    #templates = {
        profileSelectorDialog: {
            selector: "#profile-selector-form",
            listeners: [
                {
                    selector: "form",
                    event: "submit",
                    listener: async (e) => {
                        e.preventDefault()
                        let context = {}
                        switch (e.submitter.name) {
                            case "sign-in":
                                // Check for remember auth setting
                                if (e.target.remember_profile.checked) {
                                    // Set active profile entry
                                    const entry = {
                                        id: 1,
                                        profile_id: e.submitter.value
                                    }
                                    this.#application.update("active_profile", entry)
                                }
                                // Close dialog
                                e.target.parentNode.close()
                                this.#dialogs.removeChild(e.target.parentNode.parentNode)
                                // Hydrate UI
                                let profile = await this.#application.get("profiles", e.submitter.value)
                                await this.#application.initializeProfile(profile)
                                break
                            case "save":
                                context.name = e.target.name.value
                                context.avatar = e.target.avatar.files[0]
                                let insert = await this.#application.add("profiles", context)
                                e.target.reset()
                                e.target.avatar.previousElementSibling.style.backgroundImage = `url("images/user.svg")`
                                // this.#dialogs.removeChild(e.target.parentNode.parentNode)
                                break
                        }
                    }
                },
                {
                    selector: "input[type=file]",
                    event: "change",
                    listener: (e) => {
                        let img = e.target.previousElementSibling
                        let objectURL = URL.createObjectURL(e.target.files[0])
                        img.style.backgroundImage = `url("${objectURL}")`
                    }
                }
            ]
        },
        profileSelectorMenuItem: {
            selector: "#profile-selector-menu-item",
            listeners: []
        },
        profileFigure: {
            selector: "#profile-figure"
        },
        serversListItem: {
            selector: "#servers-list-item",
            listeners: []
        },
        contactsListItem: {
            selector: "#contacts-list-item",
        },
        addContactDialog: {
            selector: "#add-contact",
            listeners: [
                {
                    selector: "form",
                    event: "submit",
                    listener: (e) => {
                        if (e.submitter.name === "save") {
                            e.preventDefault()
                            // TODO: Extra validation?
                            let context = {
                                profile_id: this.#profile.id,
                                name: e.target.name.value,
                                host: e.target.host.value
                            }
                            this.#application.handleEvent("addContact", context)
                            this.#dialogs.removeChild(e.target.parentNode.parentNode)
                        }
                        if (e.submitter.name === "cancel") {
                            this.#dialogs.removeChild(e.target.parentNode.parentNode)
                        }
                    }
                }
            ]
        },
        dialog: {
            selector: "#dialog",
        },
        manageContactFieldset: {
            selector: "#manage-contact-fieldset",
            listeners: [
                {
                    selector: "form",
                    event: "submit",
                    listener: (e) => {
                        e.preventDefault()
                        const context = {
                            profile_id: this.#profile.id,
                            name: e.submitter.parentNode.querySelector("h3").innerText,
                            host: e.submitter.parentNode.querySelector("ul>li:nth-of-type(3)").innerText
                        }
                        switch (e.submitter.name) {
                            case "cancel":
                                this.#dialogs.removeChild(e.target.parentNode.parentNode)
                                break
                            case "add":

                                this.#application.handleEvent("addContact", context)
                                this.#dialogs.removeChild(e.target.parentNode.parentNode)
                                break
                            case "save":
                                this.#application.handleEvent("saveContact", context)
                                this.#dialogs.removeChild(e.target.parentNode.parentNode)
                                break
                            case "delete":
                                if (window.confirm(`Delete contact? ${e.target.contact_id.value}`)) {
                                    this.#application.handleEvent("deleteContact", e.target.contact_id.value)
                                }
                                this.#dialogs.removeChild(e.target.parentNode.parentNode)
                                break
                        }
                    }
                }
            ]
        },
        windowManagerListItem: {
            selector: "#window-manager-list-item",
        },
        messagingListItem: {
            selector: "#messaging-list-item",
        },
        messagesListItem: {
            selector: "#messages-list-item",
        },
    }

    #callbacks = {
        showProfileSelectorDialog: async (profiles) => {
            let template = await this.loadTemplate("profileSelectorDialog")
            template = template.cloneNode(true)
            let fragment = document.createDocumentFragment()
            for (const profile of profiles) {
                fragment = await this.#callbacks["renderProfileSelectorMenuItem"](fragment, profile)
            }
            template.content.firstElementChild.querySelector("form>section>fieldset>menu").append(fragment)
            let li = document.createElement("li")
            li.append(template.content.firstElementChild)
            this.#dialogs.append(li)
            this.#templates["profileSelectorDialog"].listeners.forEach(listener => {
                let target = li.querySelector(listener.selector)
                target.addEventListener(listener.event, listener.listener)
            })
            let dialog = li.querySelector("dialog")
            dialog.showModal()
            dialog.addEventListener("close", e => {
                if (e.target.isConnected){ dialog.showModal() }
            })
            return dialog
        },
        renderProfileSelectorMenuItem: async (container, profile) => {
            const definitions = [
                { key: "id", value: profile.id },
                { key: "name", value: profile.name },
                { key: "avatar", value: profile.avatar }
            ]
            let template = await this.loadTemplate("profileSelectorMenuItem")
            template = template.cloneNode(true)
            template = await this.applyViewDataToTemplate(template, definitions)
            if (profile.avatar instanceof File) {
                template.content.firstElementChild.querySelector("img").style.backgroundImage =
                    `url("${URL.createObjectURL(profile.avatar)}")`
            }
            container.append(template.content.firstElementChild)
            return container
        },
        addCreatedProfileToProfileSelectorMenu: async (profile) => {
            const container = this.#dialogs.querySelector("#profile-selector>form>section>fieldset>menu")
            await this.#callbacks["renderProfileSelectorMenuItem"](container, profile)
        },
        setAvatar: (avatar) => {
            let objectURL = URL.createObjectURL(avatar)
            let style_sheet = document.styleSheets[0]
            let root = style_sheet.cssRules[0] // Fragile!
            root.style.setProperty("--profile-img-url", `url("${objectURL}")`)
        },
        renderServers: async (state) => {
            let template = await this.loadTemplate("serversListItem")
            let fragment = document.createDocumentFragment()
            switch (state.constructor) {
                case Array:
                    this.#serversList.innerHTML = ""
                    state.forEach(server => {
                        let node = template.cloneNode(true)
                        let definitions = [
                            { key: "id", value: server.id },
                            { key: "host", value: server.host }
                        ]
                        node = this.applyViewDataToTemplate(node, definitions)
                        fragment.append(node.content.firstElementChild)
                    })
                    this.#serversList.append(fragment)
                    break
                case Event:
                    // An entry was deleted, reload all
                    this.#application.handleEvent("reloadServers", { profileId: this.#profile_id.value })
                    break
                case Object:
                    let definitions = [
                        { key: "id", value: state.id },
                        { key: "host", value: state.host }
                    ]
                    template = this.applyViewDataToTemplate(template, definitions)
                    this.#serversList.append(template.content.firstElementChild)
                    break
            }
        },
        renderContacts: async data => {
            let fragment = document.createDocumentFragment()
            if (data instanceof Array) {
                for (const contact of data) {
                    fragment = await this.#callbacks.renderContact(fragment, contact)
                }
            } else {
                const existingLi = this.#contactsForm.querySelector(`li[data-host="${data.host}"]`)
                if (existingLi) {
                    existingLi.dataset.contactId = data.id
                    return
                }
            }
            this.#contactsForm.querySelector("ul:nth-of-type(1)").append(fragment)
        },
        renderContact: async (container, contact) => {
            let template = await this.loadTemplate("contactsListItem")
            let node = template.cloneNode(true)
            let definitions = [
                { key: "index", value: Number },
                { key: "id", value: contact.id },
                { key: "name", value: contact.name },
                { key: "host", value: contact.host },
                { key: "remoteHost", value: contact.host },
            ]
            node = this.applyViewDataToTemplate(node, definitions)
            if (contact.id) {
                node.content.firstElementChild.dataset.contactId = contact.id
            }
            container.append(node.content.firstElementChild)
            return container
        },
        showAddContactDialog: async () => {
            let template = await this.loadTemplate("addContactDialog")
            template = template.content.firstElementChild.cloneNode(true)
            let li = document.createElement("li")
            li.append(template)
            this.#dialogs.append(li)
            this.#templates["addContactDialog"].listeners.forEach(listener => {
                let target = template.querySelector(listener.selector)
                target.addEventListener(listener.event, listener.listener)
            })
            template.showModal()
        },
        openManageContactDialog: async (e) => {

            // Load container template HTML
            let dialogTemplate = await this.loadTemplate("dialog")
            dialogTemplate = dialogTemplate.cloneNode(true)
            // Get connection status
            const contactLi = e.submitter.parentNode.parentNode.parentNode
            const progress = contactLi.querySelector("progress")
            switch (Number(progress.getAttribute("value"))) {
                case 0:
                    break
                case 1:
                    break
                case 2:
                    break
                // Add profile figure
                case 3:
                    // Load profile template
                    let profileTemplate = await this.loadTemplate("profileFigure")
                    profileTemplate = profileTemplate.cloneNode(true)
                    // Display connection stuffs
                    const connectionTime = this.#application.getConnectionTime(contactLi.dataset.connectionId)
                    const signalingHost = contactLi.dataset.host
                    const remoteHost = contactLi.dataset.remoteHost
                    const displayName = contactLi.querySelector("label>span").innerText
                    let avatar = contactLi.querySelector("label>img")
                    if (avatar.style.backgroundImage) {
                        avatar = avatar.style.backgroundImage.replace(`url("`, "").replace(`")`, "")
                    }
                    // Remove add contact option if necessary
                    if (signalingHost === remoteHost) {
                        let button = profileTemplate.content.querySelector(`button[name="add"]`)
                        button.parentNode.removeChild(button)
                    }
                    // Prepare template definitions
                    const profileDefinitions = [
                        { key: "avatarUrl", value: avatar ? avatar : "images/user.svg" },
                        { key: "connectionState", value: 3 },
                        { key: "connectionTime", value: this.#utilities.formatConnectionTime(connectionTime) },
                        { key: "displayName", value: displayName },
                        { key: "signalingHost", value: signalingHost },
                        { key: "remoteHost", value: remoteHost },
                    ]
                    // Add profile figure to dialog template
                    this.applyViewDataToTemplate(profileTemplate, profileDefinitions)
                    dialogTemplate.content.firstElementChild.firstElementChild.append(profileTemplate.content.firstElementChild)
                    break
            }


            // Check for stored contact id
            if (contactLi.dataset.contactId) {
                const fieldsetDefinitions = []
                const contact = await this.#application.get("contacts", contactLi.dataset.contactId)
                fieldsetDefinitions.push(
                    { key: "id", value: contact.id },
                    { key: "name", value: contact.name },
                    { key: "host", value: contact.host },
                    { key: "connected", value: contact.connected },
                    { key: "reconnectionInterval", value: contact.reconnectionInterval ? contact.reconnectionInterval : 30 }
                )
                const fieldsetTemplate = await this.loadTemplate("manageContactFieldset")
                this.applyViewDataToTemplate(fieldsetTemplate.content.firstElementChild, fieldsetDefinitions)
                dialogTemplate.content.firstElementChild.firstElementChild.append(fieldsetTemplate.content.firstElementChild)
            }

            // Render template and show
            let li = document.createElement("li")
            li.append(dialogTemplate.content.firstElementChild)
            this.#dialogs.append(li)
            this.addTemplateEventListeners("manageContactFieldset", li)
            li.firstElementChild.showModal()

            if (Number(progress.getAttribute("value")) === 3) {
                const connectionTime = this.#application.getConnectionTime(contactLi.dataset.connectionId)
                let context = {
                    connectionTime: connectionTime,
                    target: li.querySelector("time")
                }
                this.runCallback("updateConnectionTimer", context)
            }



            // Grab avatar and name from event


            // Handle contact id presence
            // if (e.submitter.parentNode.parentNode.parentNode.dataset.contactId) {
            //     const contactId = e.submitter.parentNode.parentNode.parentNode.dataset.contactId
            //     const contact = await this.#application.get("contacts", contactId)
            //     definitions.push(
            //         { key: "id", value: contactId },
            //         { key: "connected", value: contact.connected },
            //         { key: "reconnectionInterval", value: contact.reconnectionInterval ? contact.reconnectionInterval : 30 }
            //     )
            // }



        },
        updateConnectionTimer: async (context) => {
            if (context.target &&
                context.target.isConnected &&
                context.target.parentNode.previousElementSibling.getAttribute("value") === "3"
            ) {
                const formattedConnectionTime = this.#utilities.formatConnectionTime(context.connectionTime)
                const [h,m,s] = formattedConnectionTime.split(":")
                const uiTime = new Date(context.connectionTime)
                uiTime.setHours(uiTime.getHours() + h, uiTime.getMinutes() + m, uiTime.getSeconds() + s)
                const uiTimeDiscrepancy = (uiTime - context.connectionTime) / 1000
                if (parseInt(uiTimeDiscrepancy) >= 1) {
                    context.target.innerText = this.#utilities.formatConnectionTime(context.connectionTime)
                }
                window.requestAnimationFrame(() => {
                    this.#callbacks.updateConnectionTimer(context)
                })
            }
        },
        handleServersFormSubmit: async (e) => {
            e.preventDefault()
            let context = {
                profile_id: Number(e.target.profile_id.value),
                host: e.target.host.value,
            }
            switch (e.submitter.name) {
                case "add":
                    context = {
                        profile_id: Number(e.target.profile_id.value),
                        host: e.target.host.value,
                        connected: e.target.connected.checked,
                        reconnectionInterval: e.target.reconnection_interval.value
                    }
                    this.#application.handleEvent("addServer", context)
                    this.#serversForm.reset()
                    break
                case "toggle":
                    context = {
                        host: e.submitter.parentNode.parentNode.parentNode.dataset.host,
                    }
                    this.#application.handleEvent("toggleConnectionState", context)
                    break
                case "edit":
                    // this.#application.handleEvent("updateServer", context)
                    break
                case "delete":
                    context = {
                        id: e.submitter.parentNode.parentNode.parentNode.dataset.id,
                        host: e.submitter.parentNode.parentNode.parentNode.dataset.host
                    }
                    this.#application.handleEvent("deleteServer", context)
                    break
            }
        },
        handleProfileFormSubmit: async (e) => {
            e.preventDefault()
            switch (e.submitter.name) {
                case "save":
                    let context = {
                        id: Number(this.#profile.id),
                        name: e.target.name.value,
                        avatar: e.target.avatar.files[0]
                    }
                    // update UI avatar
                    if (e.target.avatar.files[0] && e.target.avatar.files[0] instanceof File) {
                        this.runCallback("setAvatar", e.target.avatar.files[0])
                    } else {
                        context.avatar = e.submitter.previousElementSibling.style.backgroundImage
                    }
                    this.#application.update("profiles", context)
                    break
                case "delete":
                    this.#application.handleEvent("deleteProfile", e.target.profile_id.value)
                    break
                case "sign-out":
                    this.#application.handleEvent("signOut", e)
                    break

            }
        },
        handleContactsFormSubmit: async (e) => {
            e.preventDefault()
            let context
            switch (e.submitter.name) {
                case "toggle":
                    let li = e.submitter.parentNode.parentNode.parentNode
                    context = {
                        name: li.querySelector("label>span").innerText,
                        host: li.dataset.host
                    }
                    if (li.dataset.connectionId) {
                        context.connectionId = li.dataset.connectionId
                    }
                    this.#application.handleEvent("toggleConnectionState", context)
                    break
                case "delete":
                    break
                case "message":
                    if (e.submitter.parentNode.parentNode.parentNode.dataset.connectionId) {
                        let context = {
                            name: e.submitter.parentNode.parentNode.parentNode.querySelector("label>span").innerText,
                            remoteHost: e.submitter.parentNode.parentNode.parentNode.dataset.remoteHost,
                            connectionId: e.submitter.parentNode.parentNode.parentNode.dataset.connectionId
                        }
                        this.runCallback("focusMessagingInterface", context)
                    } else {
                        // Reconnect?
                    }
                    break
                case "manage":
                    this.#callbacks.openManageContactDialog(e)
                    break
            }
        },
        showUntrustedCertificateDialog: async (context) => {},
        connectionStateChange: async (context) => {
            switch (context.event) {
                // Handle WSS open event
                case "open":
                    let instances = document.querySelectorAll(`[data-host="${context.host}"] progress`)
                    instances.forEach(instance => instance.value = 3)
                    if (context.host.includes("127.0.0.1:4201")) {
                        this.#serversState.value = 2
                    }
                    break
                case "close":
                    document.querySelectorAll(`[data-host="${context.host}"] progress`)
                        .forEach(instance => instance.value = 0)
                    if (context.host.includes("127.0.0.1:4201")) {
                        this.#serversState.value = 0
                    }
                    break
                case "connectionstatechange":
                    // RTC change, so connection ID MUST be present, check for existing contact
                    // Get contacts list item or add
                    // const selector = `[data-host="${context.peerConnection.getSignalingHost()}"]`
                    const selector = `[data-remote-host="${context.peerConnection.getRemoteHost()}"]`
                    let li = this.#contactsForm.querySelector(selector)
                    switch (context.peerConnection.getConnectionState()) {
                        case "connecting":
                            if (!li) {
                                li = await this.#callbacks.addUnknownContactsListItem(context)
                            }
                            document.querySelectorAll(selector).forEach(el => {
                                el.dataset.connectionId = context.peerConnection.getLocalConnectionId()
                                el.querySelector("progress").value = 2
                            })
                            break
                        case "connected":
                            document.querySelectorAll(selector).forEach(el => {
                                el.dataset.connectionId = context.peerConnection.getLocalConnectionId()
                                el.querySelector("progress").value = 3
                            })
                            break
                        case "disconnected":
                            document.querySelectorAll(selector).forEach(el => {
                                el.querySelector("progress").value = 0
                                delete el.dataset.connectionId
                            })
                            break
                    }
                    break

            }
        },
        addUnknownContactsListItem: async (context) => {
            let template = await this.loadTemplate("contactsListItem")
            template = template.cloneNode(true)
            let definitions = [
                { key: "connection-id", value: context.peerConnection.getLocalConnectionId() },
                { key: "name", value: context.peerConnection.getRemoteHost() },
                { key: "host", value: context.peerConnection.getSignalingHost() },
                { key: "remoteHost", value: context.peerConnection.getRemoteHost() }
            ]
            template = this.applyViewDataToTemplate(template, definitions)
            this.#contactsList.append(template.content.firstElementChild)
            // template.querySelector("[data-connection-id]").dataset.connectionId = context.connectionId
            this.addTemplateEventListeners("serversListItem", this.#contactsForm)
            return this.#contactsList.lastElementChild
        },
        addMessagingInterface: async (context) => {
            // Add window manager option
            let menuLi = this.#messagingWindows.querySelector(`[data-connection-id="${context.connectionId}"]`)
            if (!menuLi) {
                const menuLiTemplate = await this.loadTemplate("windowManagerListItem")
                const menuLiDefinitions = [
                    { key: "connectionId", value: context.connectionId },
                    { key: "displayName", value: context.name }
                ]
                this.applyViewDataToTemplate(menuLiTemplate, menuLiDefinitions)
                this.#messagingWindows.append(menuLiTemplate.content.firstElementChild.cloneNode(true))

            }

            let template = await this.loadTemplate("messagingListItem")
            template = template.cloneNode(true)
            // Do name lookup here
            const existingContact = await this.#application.getContactByHost(context.remoteHost)
            let definitions = [
                { key: "name", value: existingContact[0] ? existingContact[0].name : context.remoteHost },
                { key: "remoteHost", value: context.remoteHost },
                { key: "connection-id", value: context.connectionId }
            ]
            template = this.applyViewDataToTemplate(template, definitions)
            this.#messageList.append(template.content.firstElementChild)
            this.addTemplateEventListeners("messagingListItem", this.#messageList.lastElementChild)
            return this.#messageList.lastElementChild
        },
        addMessage: async (context) => {
            let li = this.#messageList.querySelector(`[data-connection-id="${context.connectionId}"]`)
            if (!li) {
                // Add a messaging ting...
                li = await this.runCallback("addMessagingInterface", context)
            }
            let ul = li.querySelector("ul")
            let template = await this.loadTemplate("messagesListItem")
            template = template.cloneNode(true)
            let datetime = new Date()
            let datetimeOptions = {
                year: "numeric", month: "short",
                day: "numeric", hour: "2-digit", minute: "2-digit"
            }
            let definitions = [
                { key: "datetime", value: datetime.toLocaleString("en-us", datetimeOptions) },
                { key: "message", value: context.message }
            ]
            template = this.applyViewDataToTemplate(template, definitions)
            if (context.outgoing) {
                template.content.firstElementChild.classList.add("o")
            }
            ul.append(template.content.firstElementChild)
            this.addTemplateEventListeners("messagesListItem", template)
            ul.lastElementChild.scrollIntoView({ behavior: 'smooth' })
        },
        focusMessagingInterface: async (context) => {
            // Close all settings windows
            document.getElementById("settings-close").checked = true
            // Obtain existing messaging interface or add one
            let container = this.#messageList.querySelector(`[data-remote-host="${context.remoteHost}"]`)
            if (!container) {
                container = await this.runCallback("addMessagingInterface", context)
            } else {
                let clone = container.cloneNode(true)
                let parent = container.parentNode
                parent.removeChild(container)
                parent.prepend(container)
            }
            container.classList.remove("minimized")
            container.querySelector("textarea").focus()
        },
        signOut: async (profiles) => {
            this.#profile_id.removeAttribute("value")
            this.runCallback("showProfileSelectorDialog", profiles)
        },
        handleConnectionsFormSubmit: async (e) => {
            e.preventDefault()
            switch (e.submitter.name) {
                case "minimize":
                    e.submitter.parentNode.parentNode.parentNode.parentNode.classList.add("minimized")
                    break
                case "close":
                    let selector
                    if (e.submitter.parentNode.dataset.connectionId) {
                        selector = `[data-connection-id="${e.submitter.parentNode.dataset.connectionId}"]`
                    } else {
                        selector = `[data-connection-id="${e.submitter.parentNode.parentNode.parentNode.parentNode.dataset.connectionId}"]`
                    }
                    const messagingLi = this.#messageList.querySelector(selector)
                    const windowLi = this.#messagingWindows.querySelector(selector)
                    messagingLi.parentNode.removeChild(messagingLi)
                    windowLi.parentNode.removeChild(windowLi)
                    break
                case "show":
                    // Remove "minimized" class to show window
                    if (e.submitter.parentNode.dataset.connectionId){
                        // Relocate window to primary position
                        const selector = `[data-connection-id="${e.submitter.parentNode.dataset.connectionId}"]`
                        const li = this.#messageList.querySelector(selector)
                        this.#messageList.removeChild(li)
                        this.#messageList.prepend(li)
                        li.classList.remove("minimized")
                    }
                    break
                case "send":
                    const messageContext = {
                        outgoing: true,
                        connectionId: e.submitter.parentNode.dataset.connectionId,
                        message: e.submitter.previousElementSibling.value
                    }
                    this.#callbacks.addMessage(messageContext)
                    this.#application.handleEvent("sendMessage", messageContext)
                    e.submitter.previousElementSibling.value = ""
                    e.submitter.previousElementSibling.focus()
                    break

            }

        }
    }

    constructor(application) {
        this.#application = application
    }

    initialize (profile) {

        this.#profile = profile
        this.#profile_id.value = profile.id

        // Hydrate profile form
        this.#profileForm.name.value = profile.name
        if (profile.avatar instanceof File) {
            const fileList= new DataTransfer()
            fileList.items.add(profile.avatar)
            this.#profileForm.avatar.files = fileList.files
            this.#callbacks.setAvatar(profile.avatar)
        }

        // Setup profile form listeners
        this.#profileForm.querySelector("input[type=file]").addEventListener("change", (e) => {
            let img = e.target.nextElementSibling
            let objectURL = URL.createObjectURL(e.target.files[0])
            img.style.backgroundImage = `url("${objectURL}")`
        })

        // Hydrate servers form
        this.#serversForm.profile_id.value = profile.id

        // Setup form listeners
        this.#serversForm.addEventListener("submit", this.getCallback("handleServersFormSubmit"))
        this.#profileForm.addEventListener("submit", this.getCallback("handleProfileFormSubmit"))
        this.#connectionsForm.addEventListener("submit", this.#callbacks.handleConnectionsFormSubmit)

        document.getElementById("open-add-contact-dialog").addEventListener("click", async (e) => {
            this.runCallback("showAddContactDialog")
        })


        this.#contactsForm.addEventListener("submit", this.getCallback("handleContactsFormSubmit"))
    }


    async loadTemplate (templateKey) {
        if (this.#templates[templateKey]) {
            let response = await fetch("templates.html")
            let html = await response.text()
            let dom = (new DOMParser()).parseFromString(html, "text/html")
            let templateNode = dom.querySelector(this.#templates[templateKey].selector)
            return templateNode
        }
        return null
    }
    applyViewDataToTemplate(template, definitions) {
        definitions.forEach((definition, index) => {
            if (definition.key === "index"){
                if (definition.value === Number) {
                    definition.value = index
                }
            }
            if (definition.value instanceof Function) {
                definition.value(template, index)
            } else {
                template.innerHTML = template.innerHTML.replaceAll(`\$\{${definition.key}\}`, definition.value)
            }
        })
        return template
    }

    addTemplateEventListeners (templateName, template) {
        // Add event listeners
        if (this.#templates[templateName].listeners) {
            this.#templates[templateName].listeners.forEach(listener => {
                let listenerTarget = template.querySelector(listener.selector)
                listenerTarget.addEventListener(listener.event, listener.listener)
            })
        }
    }

    getCallback (key) {
        return this.#callbacks[key]
    }

    runCallback (key, data) {
        return this.#callbacks[key](data)
    }

}