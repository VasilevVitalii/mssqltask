import * as lib from '../src'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const app = lib.create(error => {
    if (error) {
        console.warn('ERROR IN CREATE DB')
        console.warn(error)
        process.exit()
    }
})