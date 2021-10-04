import * as path from 'path'
import * as fs from 'fs-extra'
import * as server from '../src/server'
import { TypeMetronom } from 'vv-metronom'

export function log(): string {
    const full_path_name = path.join(__dirname, '..', '..', 'test', 'log')
    fs.ensureDirSync(full_path_name)
    fs.emptyDirSync(full_path_name)
    return full_path_name
}

export function servers(): server.TypeServer[] {
    const full_file_name = path.join(__dirname, '..', '..', 'test', 'servers.json')
    if (!fs.existsSync(full_file_name)) {
        const servers = [
            {
                instance: 'instance 1',
                login: 'sa',
                password: '123456789',
            },
            {
                instance: 'instance 2',
                login: 'sa',
                password: '123456789',
            },
        ] as server.TypeServer[]
        fs.writeFileSync(full_file_name, JSON.stringify(servers, null, 4), 'utf8')
        return servers
    }

    const raw_servers = JSON.parse(fs.readFileSync(full_file_name, 'utf8')) as server.TypeServer[]
    if (!raw_servers || raw_servers.length != 2) {
        throw new Error ('bad data in servers.json')
    }

    const servers = raw_servers.map(m => { return new server.Server(m) })
    if (JSON.stringify(raw_servers, null, 4) !== JSON.stringify(servers.map(m => { return m.options }), null, 4)) {
        fs.writeFileSync(full_file_name, JSON.stringify(servers.map(m => { return m.options }), null, 4), 'utf8')
    }

    return servers.map(m => { return m.options })
}

export function metronoms(): TypeMetronom[] {
    return [
        {
            kind: 'cron',
            cron: '0 */1 * * * *'
        }
    ]
}