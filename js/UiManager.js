export class UIManager {

    #application = null

    #dialogs = document.getElementById("dialogs")

    #serversState = document.getElementById("connection-state")
    #serversForm = document.getElementById("servers")
    #profileForm = document.getElementById("profile")
    #serversList = document.querySelector("#servers>fieldset>ul")

    #contactsForm = document.querySelector("#contacts>form")
    #contactsList = this.#contactsForm.querySelector("ul")
    #openAddContactDialogButton = document.getElementById("open-add-contact-dialog")
    #messageList = document.querySelector("#messaging>ul")

    #profile

    #templates = {
        profileSelectorDialog: {
            selector: "#profile-selector-dialog",
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
                                console.log("INSRET", insert)
                                e.target.reset()
                                e.target.avatar.previousElementSibling.style.backgroundImage = `url("images/user.svg")`
                                // this.#dialogs.removeChild(e.target.parentNode.parentNode)
                                break
                        }
                        console.log("Done handling form submission (profileSelector) in template", e)
                    }
                },
                {
                    selector: "input[type=file]",
                    event: "change",
                    listener: (e) => {
                        console.log("File input changed", e)
                        let img = e.target.previousElementSibling
                        let objectURL = URL.createObjectURL(e.target.files[0])
                        img.style.backgroundImage = `url("${objectURL}")`
                        // URL.revokeObjectURL(objectURL)
                    }
                }
            ]
        },
        profileSelectorMenuItem: {
            selector: "#profile-selector-menu-item",
            listeners: []
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
                            console.log(e)
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
        manageContactDialog: {
            selector: "#manage-contact",
            listeners: [
                {
                    selector: "form",
                    event: "submit",
                    listener: (e) => {
                        e.preventDefault()
                        console.log("Clickd", e)
                        let context = {
                            id: Number(e.target.contact_id.value),
                            profile_id: this.#profile.id,
                            name: e.target.name.value,
                            host: e.target.host.value
                        }
                        switch (e.submitter.name) {
                            case "cancel":
                                console.log("Close dialog", e)
                                this.#dialogs.removeChild(e.target.parentNode.parentNode)
                                break
                            case "save":
                                this.#application.handleEvent("saveContact", context)
                                this.#dialogs.removeChild(e.target.parentNode.parentNode)
                                break
                            case "delete":
                                if (window.confirm("Delete contact?")) {
                                    this.#application.handleEvent("deleteContact", context.id)
                                }
                                this.#dialogs.removeChild(e.target.parentNode.parentNode)
                                break
                        }
                        console.log("Handling form submission (manage) in template")
                    }
                }
            ]
        },
        messagingListItem: {
            selector: "#messaging-list-item",
            listeners: [
                {
                    selector: "form",
                    event: "submit",
                    listener: (e) => {
                        e.preventDefault()
                        console.log("Got form submission in handler", e)
                        if (e.submitter.name === "send") {
                            let context = {
                                outgoing: true,
                                connectionId: e.target.parentNode.dataset.connectionId,
                                message: e.target.message.value
                            }
                            console.log("Sending message?", context)
                            this.#application.handleEvent("sendMessage", context)
                            let li = this.runCallback("addMessage", context)
                            // // TODO: Validation
                            console.log("SUBMITD", e.submitter)
                            e.target.message.value = ""
                            e.target.message.focus()
                        }
                        if (e.submitter.name === "cancel") {
                            // this.#dialogs.removeChild(e.target.parentNode.parentNode)
                        }
                    }
                }
            ]
        },
        messagesListItem: {
            selector: "#messages-list-item",
        },
    }

    #callbacks = {
        showProfileSelectorDialog: async (profiles) => {
            let template = await this.loadTemplate("profileSelectorDialog")
            console.log("Profile selector dialog template:", template)
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
                console.log("Adding a template listener 4 ", listener)
                let target = li.querySelector(listener.selector)
                target.addEventListener(listener.event, listener.listener)
            })
            let dialog = li.querySelector("dialog")
            dialog.showModal()
            return dialog
        },
        renderProfileSelectorMenuItem: async (container, profile) => {
            const definitions = [
                { key: "id", value: profile.id },
                { key: "name", value: profile.name },
                { key: "avatar", value: profile.avatar }
            ]
            let template = await this.loadTemplate("profileSelectorMenuItem")
            console.log("PROFILE TEMPLATE", template)
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

            console.log("Rendering Servers List now", state, state.constructor)
            switch (state.constructor) {
                case Array:
                    console.log("Data is array")
                    this.#serversList.innerHTML = ""
                    console.log("Got back this template (servers):", template)
                    state.forEach(server => {
                        console.log("Looping server ", server, template)
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
                    console.log("Data is event", state)
                    // An entry was deleted, reload all
                    this.#application.handleEvent("reloadServers")
                    break
                case Object:
                    console.log("Data is objejct)", state)
                    let definitions = [
                        { key: "id", value: state.id },
                        { key: "host", value: state.host }
                    ]
                    template = this.applyViewDataToTemplate(template, definitions)
                    this.#serversList.append(template.content.firstElementChild)
                    break
            }
        },
        renderContacts: async contacts => {
            console.log("Got some contacts?", contacts)
            let fragment = document.createDocumentFragment()
            for (const contact of contacts) {
                fragment = await this.#callbacks.renderContact(fragment, contact)
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
                { key: "host", value: contact.host }
            ]
            console.log("Render contacts with defs:", definitions)
            node = this.applyViewDataToTemplate(node, definitions)
            container.append(node.content.firstElementChild)
            return container
        },
        showAddContactDialog: async () => {
            console.log("Rendering add contact dialog now!")
            let template = await this.loadTemplate("addContactDialog")
            template = template.content.firstElementChild.cloneNode(true)
            let li = document.createElement("li")
            li.append(template)
            this.#dialogs.append(li)
            this.#templates["addContactDialog"].listeners.forEach(listener => {
                console.log("Adding a template listener 4 ", listener)
                let target = template.querySelector(listener.selector)
                target.addEventListener(listener.event, listener.listener)
            })
            template.showModal()
            console.log("Done showing add contact")
        },
        openManageContactDialog: async (e) => {
            console.log("Open contact details dialog")
            let context = {
                contactId: e.submitter.parentNode.parentNode.parentNode.dataset.contactId,
                host: e.submitter.parentNode.parentNode.parentNode.dataset.host,
            }
            // Determine if contact known or unknown
            let contactId = e.submitter.parentNode.parentNode.parentNode.dataset.contactId
            if (contactId) {
                // Load contact entry
                let contact = await this.#application.get("contacts", contactId)
                console.log("Loaded contact entry in UI manager", contact)
                let template = await this.loadTemplate("manageContactDialog")
                console.log("Got this template", template)
                template = template.cloneNode(true)
                const definitions = [
                    { key: "title", value: "Manage contact"},
                    { key: "id", value: contactId },
                    { key: "name", value: contact.name },
                    { key: "host", value: contact.host },
                    { key: "connected", value: contact.connected },
                    { key: "reconnectionInterval", value: contact.reconnectionInterval ? contact.reconnectionInterval : 30 }
                ]
                template = this.applyViewDataToTemplate(template, definitions)
                let li = document.createElement("li")
                li.append(template.content.firstElementChild)
                this.#dialogs.append(li)
                this.addTemplateEventListeners("manageContactDialog", li)
                li.firstElementChild.showModal()
            } else {

            }




            //this.#application.handleEvent("manageContact", context)
        },
        handleServersFormSubmit: async (e) => {
            e.preventDefault()
            let context = {
                profile_id: Number(e.target.profile_id.value),
                host: e.target.host.value,
            }
            switch (e.submitter.name) {
                case "add":
                    console.log("add server requested", e)
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
                    console.log("Toggle server requestd", e)
                    context = {
                        host: e.submitter.parentNode.parentNode.parentNode.dataset.host,
                    }
                    this.#application.handleEvent("toggleServerConnection", context)
                    break
                case "edit":
                    console.log("edit  server requested", e)
                    // this.#application.handleEvent("updateServer", context)
                    break
                case "delete":
                    console.log("delete server requested", e)
                    context = {
                        id: e.submitter.parentNode.parentNode.parentNode.dataset.id,
                        host: e.submitter.parentNode.parentNode.parentNode.dataset.host
                    }
                    console.log("FORMATED CONTEXT", context)
                    this.#application.handleEvent("deleteServer", context)
                    break
            }
        },
        handleProfileFormSubmit: async (e) => {
            e.preventDefault()
            console.log("Form submitted@!", e)
            switch (e.submitter.name) {
                case "save":
                    console.log("Update that shit")
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
                    console.log("Delete that shit")
                    this.#application.handleEvent("deleteProfile", e.target.profile_id.value)
                    break
                case "sign-out":
                    this.#application.delete("active_profile", 1)
                    break

            }
        },
        handleContactsFormSubmit: async (e) => {
            console.log("Form submitted action:", e.submitter.name)
            e.preventDefault()
            let context
            switch (e.submitter.name) {
                case "toggle":
                    console.log("Toggle contact connection")
                    let li = e.submitter.parentNode.parentNode.parentNode
                    console.log("Got connection ID/host:", li)
                    context = {
                        connectionId: li.dataset.connectionId,
                        host: li.dataset.host
                    }
                    console.log("Context issue?", context)
                    this.#application.handleEvent("toggleContactConnection", context)
                    break
                case "delete":
                    console.log("Call nw")
                    break
                case "message":
                    console.log("Send contact a message", e)
                    if (e.submitter.parentNode.parentNode.parentNode.dataset.connectionId) {
                        let context = {
                            name: e.submitter.parentNode.parentNode.parentNode.querySelector("label>span").innerText,
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
        showUntrustedCertificateDialog: async (context) => {
            console.log("Should show dialog for untrusted cert here!!@!@!@!@!@!@!@!@!@$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$")
        },
        connectionStateChange: async (context) => {
            console.log("Running connection state change", context)

            console.log("Event type is: ", context.event.type, context)
            let url, progress
            switch (context.event.type) {

                // Handle WSS open event
                case "open":
                    url = context.signalingServer.getUrl()
                    console.log("Connection state (open) change for ", url.host, context)
                    let selector = `[data-host="${url.host}"]`
                    let instances = document.querySelectorAll(`[data-host="${url.host}"] progress`)
                    console.log("Instances", instances)
                    instances.forEach(instance => instance.value = 2)
                    if (context.local) {
                        console.log("Local state change.....")
                        this.#serversState.value = 2
                    }
                    break
                case "close":
                    url = context.signalingServer.getUrl()
                    console.log("Connection state (close) change for ", url.host, context)
                    document.querySelectorAll(`[data-host="${url.host}"] progress`)
                        .forEach(instance => instance.value = 0)
                    if (context.local) {
                        console.log("Local state change.....")
                        this.#serversState.value = 0
                    }
                    break
                case "connectionstatechange":
                    console.log("Connection state change", context, context.event.target.connectionState)

                    // RTC change, so connection ID MUST be present, check for existing contact


                    // Get contacts list item or add



                    if (context.event.target.connectionState === "connected") {
                        let contactLi = this.#contactsForm
                            .querySelector(`[data-connection-id="${context.peerConnection.getLocalConnectionId()}"]`)
                        if (!contactLi) {
                            console.log("Did not find target LI")
                            contactLi = await this.#callbacks.addContact(context)
                        }
                        console.log("Did not find target LI2", contactLi)

                        console.log("Update state for RTC connection", contactLi)
                        contactLi.querySelector("progress").value = 2
                    }
                    if (context.event.target.connectionState === "disconnected") {
                        console.log("Update state for RTC disconnection")
                        contactLi.querySelector("progress").value = 0
                    }
                    break

            }

            // let target
            // switch (true) {
            //     case Object.hasOwn(context, "contactId"):
            //         console.log("1Change state contact ID", context)
            //         target = this.#contactsList.querySelector(`[data-contact-id="${context.contactId}"]`)
            //         break
            //     case Object.hasOwn(context, "connectionId"):
            //         console.log("1Change state connection ID", context)
            //         target = this.#contactsForm.querySelector(`[data-connection-id="${context.connectionId}"]`)
            //         break
            //     default:
            //         console.log("1Change local server", context)
            //         target = this.#serversList.querySelector(`[value="${context.host}"]`)
            //         break
            // }
            // console.log("Found TARGET 4update state", `[data-connection-id="${context.connectionId}"]`, target, context)
            // if (target) {
            //     target.parentNode.querySelector("progress").value = context.state
            // }
        },
        addContact: async (context) => {

            // Attempt to locate existing unknown contact
            let existingInput = this.#contactsForm.querySelector(`ul>li[data-host="${context.peerConnection.getHost()}"]`)
            console.log("EXISTING LOOKUP:", existingInput)

            // If an existing connection from the host is added, but disconnected, use it and update connection IDs
            if (existingInput) {
                let existingConnectionId = existingInput.dataset.connectionId
                console.log("Old connection id here:", existingConnectionId)
                let instances = document.querySelectorAll(`[data-connection-id="${existingConnectionId}"]`)
                instances.forEach(instance => instance.dataset.connectionId = context.connectionId)
                console.log("Exists connect")
            } else {
                console.log("Nu connect")
                console.log("UI MANAGER ADD CONTACT UNKNKNW", context)
                let template = await this.loadTemplate("contactsListItem")
                template = template.cloneNode(true)
                console.log("Got back this template (contacts):", template, context)
                let definitions = [
                    { key: "connection-id", value: context.peerConnection.getLocalConnectionId() },
                    { key: "name", value: context.peerConnection.getHost() },
                    { key: "host", value: context.peerConnection.getHost() }
                ]
                console.log("Adding contact to list with these defs", definitions, context)
                template = this.applyViewDataToTemplate(template, definitions)
                console.log("Fetched this unknown message template: ", template)
                const ul = this.#contactsForm.querySelector("ul:nth-of-type(2)")
                ul.append(template.content.firstElementChild)
                // template.querySelector("[data-connection-id]").dataset.connectionId = context.connectionId
                console.log("JUST SET TEMPLATEZ", template)
                this.addTemplateEventListeners("serversListItem", this.#contactsForm)
                return ul.lastElementChild
            }
            return true
        },
        addUnknownContact: async (context) => {
            // Attempt to locate existing unknown contact
            let existingInput = this.#contactsForm.querySelector(`[data-host="${context.peerConnection.getHost()}"]`)
            console.log("EXISTIN GLOOKUP:", existingInput)

            // If an existing connection from the host is added, but disconnected, use it and update connection IDs
            if (existingInput) {
                let existingConnectionId = existingInput.dataset.connectionId
                console.log("Old connection id here:", existingConnectionId)
                let instances = document.querySelectorAll(`[data-connection-id="${existingConnectionId}"]`)
                instances.forEach(instance => instance.dataset.connectionId = context.peerConnection.getLocalConnectionId())
                console.log("Exists connect")
            } else {
                console.log("Nu connect")
                console.log("UI MANAGER ADD CONTACT UNKNKNW", context)
                let template = await this.loadTemplate("contactsListItem")
                template = template.cloneNode(true)
                console.log("Got back this template (contacts):", template)
                let definitions = [
                    { key: "connection-id", value: context.peerConnection.getLocalConnectionId() },
                    { key: "name", value: context.peerConnection.getHost() },
                    { key: "host", value: context.peerConnection.getHost() }
                ]
                template = this.applyViewDataToTemplate(template, definitions)
                console.log("Fetched this unknown message template: ", template)
                this.#contactsForm.querySelector("ul:nth-of-type(2)").append(template.content.firstElementChild)
                // template.querySelector("[data-connection-id]").dataset.connectionId = context.connectionId
                console.log("JUST SET TEMPLATEZ", template)
                this.addTemplateEventListeners("serversListItem", this.#contactsForm)
            }
            return true
            // this.runCallback("connectionStateChange", context)
        },
        addMessagingInterface: async (context) => {
            console.log("Add messaging interface context:", context)
            let template = await this.loadTemplate("messagingListItem")
            template = template.cloneNode(true)
            console.log("Got msg template", template)
            let definitions = [
                { key: "name", value: context.name },
                { key: "connection-id", value: context.connectionId }
            ]
            template = this.applyViewDataToTemplate(template, definitions)
            this.#messageList.append(template.content.firstElementChild)
            console.log("WUT IT BE", template.querySelector("form"))
            this.addTemplateEventListeners("messagingListItem", this.#messageList.lastElementChild)
            return this.#messageList.lastElementChild
        },
        addMessage: async (context) => {
            console.log("Adding message for:", context)
            let li = this.#messageList.querySelector(`[data-connection-id="${context.connectionId}"]`)
            if (!li) {
                // Add a messaging ting...
                console.log("Adding message for2 (did not find existing LI):", context)
                li = await this.runCallback("addMessagingInterface", context)
                console.log("Ran the callback and got new LI", li)
            } else {
                console.log("Adding message for2 (did find existing LI!):", context)
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
            console.log("DONE WIT MSGS", ul, li)
        },
        focusMessagingInterface: async (context) => {
            // Close all settings windows
            document.getElementById("settings-close").checked = true
            // Obtain existing messaging interface or add one
            let container = this.#messageList.querySelector(`[data-connection-id="${context.connectionId}"]`)
            if (!container) {
                console.log("No container detected making one")
                container = await this.runCallback("addMessagingInterface", context)
            } else {
                let clone = container.cloneNode(true)
                let parent = container.parentNode
                parent.removeChild(container)
                parent.prepend(container)
                // container = clone
                console.log("Repositioned that shit", container)
            }
            // Set focus
            container.querySelector("textarea").focus()
        }
    }

    constructor(application) {
        this.#application = application
    }

    initialize (profile) {

        this.#profile = profile

        // Hydrate profile form
        // this.#profileForm.profile_id.value = profile.id
        this.#profileForm.name.value = profile.name
        if (profile.avatar instanceof File) {
            const fileList= new DataTransfer()
            fileList.items.add(profile.avatar)
            this.#profileForm.avatar.files = fileList.files
            this.#callbacks.setAvatar(profile.avatar)
        }

        // Setup profile form listeners
        this.#profileForm.querySelector("input[type=file]").addEventListener("change", (e) => {
            console.log("File input changed", e)
            let img = e.target.nextElementSibling
            let objectURL = URL.createObjectURL(e.target.files[0])
            img.style.backgroundImage = `url("${objectURL}")`
        })

        // Hydrate servers form
        this.#serversForm.profile_id.value = profile.id

        // Setup form listeners
        this.#serversForm.addEventListener("submit", this.getCallback("handleServersFormSubmit"))
        this.#profileForm.addEventListener("submit", this.getCallback("handleProfileFormSubmit"))

        document.getElementById("open-add-contact-dialog").addEventListener("click", async (e) => {
            this.runCallback("showAddContactDialog")
        })


        this.#contactsForm.addEventListener("submit", this.getCallback("handleContactsFormSubmit"))
    }


    async loadTemplate (templateKey) {
        console.log("Examine this template:", templateKey)
        if (this.#templates[templateKey]) {
            let response = await fetch("templates.html")
            // console.log("Templates response", response)
            let html = await response.text()
            let dom = (new DOMParser()).parseFromString(html, "text/html")
            // console.log("Got a DOM", dom)
            // console.log("Trying to search with this selector: ", this.#templates[template].selector)
            let templateNode = dom.querySelector(this.#templates[templateKey].selector)
            // console.log("Got this node from templates:", node)
            // return templateNode.content.firstElementChild.cloneNode(true)
            console.log("Returning template node: ", templateNode)
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
                console.log("ListenerTarget should have event now", listenerTarget)
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
