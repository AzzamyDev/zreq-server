import { randomInt } from 'crypto'

export function generateRandomString(): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    const characterLength = characters.length
    const stringLength = 12

    let randomString = ''

    for (let i = 0; i < stringLength; i++) {
        const randomIndex = randomInt(0, characterLength - 1)
        randomString += characters[randomIndex]
    }

    return randomString.toUpperCase()
}
