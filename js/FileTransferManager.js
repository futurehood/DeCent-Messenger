export class FileTransferManager {

    #queue = []
    #buffer = []
    #bufferSize = 0

    constructor () {}

    queueFileTransfer (fileMetadata) {
        this.#queue.push(fileMetadata)
    }

    fillBuffer (chunk) {
        this.#buffer.push(chunk)
        this.#bufferSize += chunk.byteLength
        return this.#bufferSize / this.#queue[0].size
    }

    #joinBuffer () {
        return this.#buffer.reduce((chunk, arrayBuffer) => {
            const t = new Uint8Array(chunk.byteLength + arrayBuffer.byteLength)
            t.set(new Uint8Array(chunk), 0)
            t.set(new Uint8Array(arrayBuffer), chunk.byteLength)
            return t
        }, new Uint8Array())
    }

    generateBlob () {
        return new Blob([this.#joinBuffer()], { type: this.#queue[0].type })
    }

}