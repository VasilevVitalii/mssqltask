import * as lib from '../src'
import * as data from './data'

export function Go() {
    console.log('GO!')
    const logPath = data.Log()
    const task = lib.Create({
        key: 'task1',
        metronom: {
            kind: 'cron',
            cron: '*/15 * * * * *'
        },
        servers: data.Servers(),
        queries: ["SELECT * FROM rrMasterData.dbo.Assortment WITH (NOLOCK) ORDER BY Code"],
        processResult: {
            pathSaveTickets: logPath,
            pathSaveRows: logPath,
            pathSaveMessages: logPath
        }
    })

    task.onError(error => {
        console.log(error)
    })

    task.onChanged(state => {
        if (state.kind === 'start') {
            console.log('start')
        } else if (state.kind === 'stop') {
            console.log('stop')
        } else if (state.kind === 'finish') {
            console.log('finish')
        }
    })

    task.start()
}