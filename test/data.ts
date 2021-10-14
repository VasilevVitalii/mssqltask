import * as path from 'path'
import * as fs from 'fs-extra'
import * as server from '../src/server'
import { TypeMetronom } from 'vv-metronom'

export function Log(): string {
    const fullPathName = path.join(__dirname, '..', '..', 'test', 'log')
    fs.ensureDirSync(fullPathName)
    fs.emptyDirSync(fullPathName)
    return fullPathName
}

export function Servers(): server.TServer[] {
    const fullFileName = path.join(__dirname, '..', '..', 'test', 'servers.json')
    if (!fs.existsSync(fullFileName)) {
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
        ] as server.TServer[]
        fs.writeFileSync(fullFileName, JSON.stringify(servers, null, 4), 'utf8')
        return servers
    }

    const rawServers = JSON.parse(fs.readFileSync(fullFileName, 'utf8')) as server.TServer[]
    if (!rawServers || rawServers.length != 2) {
        throw new Error ('bad data in servers.json')
    }

    const servers = rawServers.map(m => { return new server.Server(m) })
    if (JSON.stringify(rawServers, null, 4) !== JSON.stringify(servers.map(m => { return m.options }), null, 4)) {
        fs.writeFileSync(fullFileName, JSON.stringify(servers.map(m => { return m.options }), null, 4), 'utf8')
    }

    return servers.map(m => { return m.options })
}

export function Metronoms(): TypeMetronom[] {
    return [
        {
            kind: 'cron',
            cron: '0 */1 * * * *'
        },
        {
            kind: 'custom',
            weekdaySun: true,
            weekdayMon: true,
            weekdayTue: true,
            weekdayWed: true,
            weekdayThu: true,
            weekdayFri: true,
            weekdaySat: true,
            periodMinutes: 1,
            periodicity: 'every'
        }
    ]
}