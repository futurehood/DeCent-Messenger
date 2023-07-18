export class ObjectRegistry {

    #application

    #registry = []

    constructor (application) {
        this.#application = application
    }

    registerAssociation (keyObject, associatedObject) {
        this.#registry.push({
            key: keyObject,
            associated: associatedObject
        })
    }

    lookupAssociations (key, className = null) {
        if (className) {
            return this.#registry.filter(r => {
                return r.key === key &&
                    r.associated instanceof className
            })
        } else {
            return this.#registry.find(r => {
                return r.key
            })
        }
    }
}