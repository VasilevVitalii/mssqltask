import * as filestream from 'vv-filestream'
import { workerData, parentPort } from 'worker_threads'
import { Server, TypeMessage, TypeServer } from "./server"
import { TypeTaskResult } from './task'
import { full_file_names } from './z'

export type TypeWorkerData = {
    server: TypeServer,
    query: string,
    result: TypeTaskResult
}

export type TypeWorkerResult =
    {kind: 'start', spid: number} |
    {kind: 'process', rows: any[], messages: TypeMessage[], rows_count: number, messages_count: number} |
    {kind: 'stop'}

const env = {
    workedData: workerData as TypeWorkerData
}

const server = new Server(env.workedData.server, 'mssqltask')
const file_names = full_file_names(env.workedData.result.log_path, env.workedData.result.log_key)
const stream = filestream.createWriteStream({prefix: '[\n', suffix: '{}\n]'})
stream.onClose(result => {
    parentPort.postMessage({
        kind: 'stop'
    } as TypeWorkerResult)
})

server.exec(env.workedData.query, env.workedData.result.allow_callback_rows || env.workedData.result.allow_log_rows, result => {
    if (result.kind === 'start') {
        parentPort.postMessage({
            kind: 'start',
            spid: result.spid
        } as TypeWorkerResult)
        return
    }
    if (result.kind === 'chunk') {
        if (env.workedData.result.allow_log_rows && result.row_list.length > 0) {
            stream.write({fullFileName: file_names.rows, data: result.row_list})
        }
        if (env.workedData.result.allow_log_messages && result.messages.length > 0) {
            stream.write({fullFileName: file_names.messages, data: result.messages})
        }
    }
    if (result.kind === 'stop') {
        stream.close()
        return
    }
})

console.log(env)

//import { TypeServer } from "./task";

// export function run(servers: TypeServer, query: string, fileNameSuffix: string, fileNameSuffixStartIdx: number | undefined) {

// }

// export class TaskRun {

//     private servers: TypeServer

//     constructor(servers: TypeServer, query: string, fileNameSuffix: string, fileNameSuffixStartIdx: number | undefined) {
//         this.servers = servers

//     }

// }

console.log('worker!')