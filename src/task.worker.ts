import * as filestream from 'vv-filestream'
import { workerData, parentPort } from 'worker_threads'
import { Server, TExecResult, TMessage, TServer } from "./server"

export type TServerWorker = TServer & {
    idxs: string,
    //fullFileNameTickets: string,
    fullFileNameRows: string,
    fullFileNameMessages: string,
    allowCallbackRows: boolean,
    allowCallbackMessages: boolean
}

export type TWorkerOptions = {
    servers: TServerWorker[],
    query: string
}

export type TWorkerResult =
    {kind: 'start', idxs: string, spid: number} |
    {kind: 'messages', idxs: string, data: TMessage[], count: number} |
    {kind: 'rows', idxs: string, data: any[], count: number} |
    {kind: 'stop', idxs: string, duration: number, error: string} |
    {kind: 'end', errors: string[]}

const env = {
    options: workerData as TWorkerOptions,
    complete_idxs: [] as string[],
    errors: [] as string[],
    server_results: [] as {server: TServerWorker, result: TExecResult}[]
}

const stream = filestream.Create({prefix: '[\n', suffix: '\n]'})
stream.onClose(result => {
    parentPort.postMessage({
        kind: 'end',
        errors: [...env.errors,  ...result.filter(f => f.error). map(m => { return m.error.message })]
    } as TWorkerResult)
    return
})

env.options.servers.forEach(server => {
    const allowMessages = server.allowCallbackMessages || (server.fullFileNameMessages ? true : false)
    const allowRows = server.allowCallbackRows || (server.fullFileNameRows ? true : false)
    const s = new Server(server, 'mssqltask')
    s.exec(env.options.query, allowRows, allowMessages, result => {
        env.server_results.push({server: server, result: result})
    })
})

let timerServerResult = setTimeout(function tick() {
    const serverResult = env.server_results.shift()
    if (!serverResult) {
        timerServerResult = setTimeout(tick, 100)
        return
    }
    const server = serverResult.server
    const result = serverResult.result
    if (result.kind === 'start') {
        parentPort.postMessage({
            kind: 'start',
            idxs: server.idxs,
            spid: result.spid
        } as TWorkerResult)
        timerServerResult = setTimeout(tick, 50)
        return
    }
    if (result.kind === 'rows') {
        if (server.fullFileNameRows) {
            stream.write({fullFileName: server.fullFileNameRows, data: result.data.map(m=> { return {kind: 'row',...m}  })})
        }
        parentPort.postMessage({
            kind: 'rows',
            idxs: server.idxs,
            count: result.data.length,
            data: server.allowCallbackRows ? result.data : []
        } as TWorkerResult)
        timerServerResult = setTimeout(tick, 50)
        return
    }
    if (result.kind === 'messages') {
        if (server.fullFileNameMessages) {
            stream.write({fullFileName: server.fullFileNameMessages, data: result.data.map(m => { return {kind: 'msg', ...m} })})
        }
        parentPort.postMessage({
            kind: 'messages',
            idxs: server.idxs,
            count: result.data.length,
            data: server.allowCallbackMessages ? result.data : []
        } as TWorkerResult)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        timerServerResult = setTimeout(tick, 50)
        return
    }
    if (result.kind === 'stop') {
        if (server.fullFileNameRows || server.fullFileNameMessages) {
            const lastRow = {kind: 'end', serverIdxs: server.idxs, serverInstance: server.instance, execDurationMsec: result.duration}
            if (server.fullFileNameRows) {
                stream.write({fullFileName: server.fullFileNameRows, data: JSON.stringify(lastRow)})
            }
            if (server.fullFileNameMessages) {
                stream.write({fullFileName: server.fullFileNameMessages, data: JSON.stringify(lastRow)})
            }
        }

        env.complete_idxs.push(server.idxs)
        if (env.options.servers.every(f => env.complete_idxs.includes(f.idxs))) {
            stream.close()
        }

        parentPort.postMessage({
            kind: 'stop',
            idxs: server.idxs,
            duration: result.duration,
            error: result.error ? result.error.message : ''
        } as TWorkerResult)
        return
    }
}, 100)