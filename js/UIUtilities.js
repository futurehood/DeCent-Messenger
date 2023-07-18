export class UIUtilities {

    formatConnectionTime (connectionTime) {
        const elapsedSeconds = ((new Date()) - connectionTime) / 1000
        let totalCalculatedSeconds = 0
        const days = parseInt(elapsedSeconds / 86400)
        totalCalculatedSeconds += days * 86400
        const hours = parseInt((elapsedSeconds - totalCalculatedSeconds) / 3600)
        totalCalculatedSeconds += hours * 3600
        const minutes = parseInt((elapsedSeconds - totalCalculatedSeconds) / 60)
        totalCalculatedSeconds = (hours * 3600) + (days * 86400) + (minutes * 60)
        const seconds = parseInt(elapsedSeconds - totalCalculatedSeconds)
        return `${("00"+parseInt(hours)).slice(-2)}:${("00"+parseInt(minutes)).slice(-2)}:${("00"+parseInt(seconds)).slice(-2)}`
    }

}