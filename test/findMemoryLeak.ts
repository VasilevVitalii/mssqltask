import * as lib from '../src'
import * as data from './data'
import * as vv from 'vv-common'




export function Go() {
    const logPath = data.Log()
    const task = lib.Create({
        key: 'task1',
        metronom: {
            kind: 'cron',
            cron: '*/15 * * * * *'
        },
        servers: data.Servers(),
        queries: ["SELECT * FROM rrMasterData.dbo.Assortment WITH (NOLOCK)"],
        processResult: {
            pathSaveTickets: logPath,
            pathSaveRows: logPath,
            pathSaveMessages: logPath
        }
    })
}