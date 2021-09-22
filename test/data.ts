import * as path from 'path'
import * as fs from 'fs'
import * as server from '../src/server'

export function servers(): server.Server[] {
    const full_file_name = path.join(__dirname, '..', '..', 'test', 'servers.json')
    if (!fs.existsSync(full_file_name)) {
        const servers = [
            new server.Server({
                title: 'server 1',
                note: 'note for server 1',
                instance: 'instance 1',
                login: 'sa',
                password: '123456789',
                tags: ['tag1', 'tag2']
            }),
            new server.Server({
                title: 'server 2',
                note: 'note for server 2',
                instance: 'instance 2',
                login: 'sa',
                password: '123456789',
                tags: ['tag2', 'tag3']
            }),
        ]
        fs.writeFileSync(full_file_name, JSON.stringify(servers.map(m => { return m.storage }), null, 4), 'utf8')
        return servers
    }

    const raw_servers = JSON.parse(fs.readFileSync(full_file_name, 'utf8')) as server.TypeStorage[]
    if (!raw_servers || raw_servers.length != 2) {
        throw new Error ('bad data in servers.json')
    }

    const servers = raw_servers.map(m => { return new server.Server(m) })
    if (JSON.stringify(raw_servers, null, 4) !== JSON.stringify(servers.map(m => { return m.storage }), null, 4)) {
        fs.writeFileSync(full_file_name, JSON.stringify(servers.map(m => { return m.storage }), null, 4), 'utf8')
    }

    return servers
}






