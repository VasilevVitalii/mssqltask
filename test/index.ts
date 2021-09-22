import * as lib from '../src'
import * as data from './data'
import * as server from '../src/server'

const servers = data.servers()
servers_ping(servers, 0, () => {
    servers.forEach(s => {
        if (s.ping_result.error) {
            console.warn(`ERROR PING SERVER ${s.storage.instance}`)
            console.warn(s.ping_result.error)
            process.exit()
        }
    })
})

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const app = lib.create(error => {
    if (error) {
        console.warn('ERROR IN CREATE DB')
        console.warn(error)
        process.exit()
    }
})

function servers_ping(servers: server.Server[], idx: number, callback: () => void) {
    if (idx >= servers.length) {
        callback()
        return
    }
    servers[idx].ping(true, () => {
        idx++
        servers_ping(servers, idx, callback)
    })
}