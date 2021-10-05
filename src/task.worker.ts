import * as filestream from 'vv-filestream'
import { workerData, parentPort } from 'worker_threads'
import { Server, TypeMessage, TypeServer } from "./server"

export type TypeServerWorker = TypeServer & {
    idxs: string,
    full_file_name_rows: string,
    full_file_name_messages: string,
    allow_callback_rows: boolean,
    allow_callback_messages: boolean
}

export type TypeWorkerOptions = {
    servers: TypeServerWorker[],
    query: string
}

export type TypeWorkerResult =
    {kind: 'start', idxs: string, spid: number} |
    {kind: 'messages', idxs: string, data: TypeMessage[], count: number} |
    {kind: 'rows', idxs: string, data: any[], count: number} |
    {kind: 'stop', idxs: string, duration: number, error: string} |
    {kind: 'end', errors: string[]}

const env = {
    options: workerData as TypeWorkerOptions,
    complete_idxs: [] as string[]
}

const stream = filestream.createWriteStream({prefix: '[\n', suffix: '{}\n]'})
stream.onClose(result => {
    parentPort.postMessage({
        kind: 'end',
        errors: result.filter(f => f.error). map(m => { return m.error.message })
    } as TypeWorkerResult)
    return
})

env.options.servers.forEach(server => {
    const allow_messages = server.allow_callback_messages || (server.full_file_name_messages ? true : false)
    const allow_rows = server.allow_callback_rows || (server.full_file_name_rows ? true : false)
    const s = new Server(server, 'mssqltask')
    s.exec(env.options.query, allow_rows, allow_messages, result => {
        if (result.kind === 'start') {
            parentPort.postMessage({
                kind: 'start',
                idxs: server.idxs,
                spid: result.spid
            } as TypeWorkerResult)
            return
        }
        if (result.kind === 'rows') {
            if (server.full_file_name_rows) {
                stream.write({fullFileName: server.full_file_name_rows, data: result.data})
            }
            parentPort.postMessage({
                kind: 'rows',
                idxs: server.idxs,
                count: result.data.length,
                data: server.allow_callback_rows ? result.data : []
            } as TypeWorkerResult)
            return
        }
        if (result.kind === 'messages') {
            if (server.full_file_name_messages) {
                stream.write({fullFileName: server.full_file_name_messages, data: result.data})
            }
            parentPort.postMessage({
                kind: 'messages',
                idxs: server.idxs,
                count: result.data.length,
                data: server.allow_callback_messages ? result.data : []
            } as TypeWorkerResult)
            return
        }
        if (result.kind === 'stop') {
            parentPort.postMessage({
                kind: 'stop',
                idxs: server.idxs,
                duration: result.duration,
                error: result.error ? result.error.message : ''
            } as TypeWorkerResult)
            env.complete_idxs.push(server.idxs)
            if (env.options.servers.every(f => env.complete_idxs.includes(f.idxs))) {
                stream.close()
            }
            return
        }
    })
})