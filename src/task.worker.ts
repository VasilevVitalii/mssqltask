import { resolveNaptr } from 'dns'
import * as filestream from 'vv-filestream'
import { workerData, parentPort } from 'worker_threads'
import { Server, TypeMessage, TypeServer } from "./server"
import { full_file_names } from './z'

export type TypeWorkerOptions = {
    servers: TypeServer[],
    query: string,
    callback: {
        rows: boolean,
        messages: boolean
    },
    save: {
        full_file_name_rows: string,
        full_file_name_messages: string
    }
}

export type TypeWorkerResult =
    {kind: 'start', spid: number} |
    {kind: 'messages', data: TypeMessage[], count: number} |
    {kind: 'rows', data: any[], count: number} |
    {kind: 'stop'}

const env = {
    options: workerData as TypeWorkerOptions
}

const allow_messages = env.options.callback.messages || (env.options.save.full_file_name_messages ? true : false)
const allow_rows = env.options.callback.rows || (env.options.save.full_file_name_rows ? true : false)

env.options.servers.forEach(server => {
    (new Server(server, 'mssqltask')).exec(env.options.query, allow_rows, allow_messages, result => {
        console.log('worker result', result)
    })
})

console.log('worker')

// const server = new Server(env.workedData.server, 'mssqltask')
// const file_names = full_file_names(env.workedData.result.log_path, env.workedData.result.log_key)
// const stream = filestream.createWriteStream({prefix: '[\n', suffix: '{}\n]'})
// stream.onClose(result => {
//     parentPort.postMessage({
//         kind: 'stop'
//     } as TypeWorkerResult)
// })

// server.exec(env.workedData.query, env.workedData.result.allow_callback_rows || env.workedData.result.allow_log_rows, result => {
//     if (result.kind === 'start') {
//         parentPort.postMessage({
//             kind: 'start',
//             spid: result.spid
//         } as TypeWorkerResult)
//         return
//     }
//     if (result.kind === 'chunk') {
//         if (env.workedData.result.allow_log_rows && result.row_list.length > 0) {
//             stream.write({fullFileName: file_names.rows, data: result.row_list})
//         }
//         if (env.workedData.result.allow_log_messages && result.messages.length > 0) {
//             stream.write({fullFileName: file_names.messages, data: result.messages})
//         }
//     }
//     if (result.kind === 'stop') {
//         stream.close()
//         return
//     }
// })

// console.log(env)

//import { TypeServer } from "./task";

// export function run(servers: TypeServer, query: string, fileNameSuffix: string, fileNameSuffixStartIdx: number | undefined) {

// }

// export class TaskRun {

//     private servers: TypeServer

//     constructor(servers: TypeServer, query: string, fileNameSuffix: string, fileNameSuffixStartIdx: number | undefined) {
//         this.servers = servers

//     }

// }

//console.log('worker!')