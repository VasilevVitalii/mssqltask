import path from 'path'
import worker_threads from 'worker_threads'
import * as metronom from 'vv-metronom'
import { TypeServer } from './server'
import { TypeWorkerResult, TypeWorkerOptions } from './task.worker'


    // {kind: 'callback', allow_tables: boolean, allow_messages: boolean} |
    // {kind: 'save', allow_tables: boolean, allow_messages: boolean, key: string, path: string}

export type TypeTask = {
    metronom: metronom.TypeMetronom
    servers: TypeServer[]
    query: string
    process_result: {
        callback_rows?: boolean,
        callback_messages?: boolean,
        save_rows?: boolean,
        save_messages?: boolean
    }
}

export type TypeTicketResult = {
    dateStart: Date,
    dateStop: Date,
    servers: {
        worker: number,
        instance: string,
        execSpId: number,
        execDurationMsec: number,
        execError: string,
        countRows: number,
        countMessages: number,
        complete: boolean
    }[]
}

export type TypeTaskState =
    {kind: 'start', usedWorkers: number} |
    {kind: 'process', ticket: TypeTicketResult} |
    {kind: 'stop'}

export class Task {
    private options: TypeTask
    private metronom: metronom.Metronom
    private servers: TypeServer[]
    private state: {
        needStop: boolean
        status: ('idle' | 'buzy' | 'stopped')
    }

    private callback_onStateChanged: (state: TypeTaskState) => void
    private callback_onError: (error: Error) => void
    maxWorkers: number

    constructor(options: TypeTask) {
        this.options = options
        this.metronom = metronom.CreateMetronom(this.options.metronom)
        this.servers = this.options.servers
        this.state = {
            needStop: false,
            status: 'stopped'
        }
        this.metronom.onTick(() => {
            this.onTick()
        })
        this.maxWorkers = this.servers.length
    }

    start() {
        if (this.state.status !== 'stopped') return
        this.state.needStop = false
        this.state.status = 'idle'
        this.metronom.start()
    }

    stop() {
        if (this.state.status === 'stopped') return
        this.metronom.stop()
        this.state.needStop = true
    }

    private onTick() {
        if (this.state.status !== 'idle') return

        const workerServers = this.serversToWorkerChunks()
        const ticket = {
            dateStart: new Date(),
            dateStop: undefined,
            servers: []
        } as TypeTicketResult
        workerServers.forEach((chunk, chunk_id) => {
            chunk.forEach(item => {
                ticket.servers.push({
                    worker: chunk_id,
                    instance: item.instance,
                    execSpId: 0,
                    execDurationMsec: 0,
                    execError: '',
                    countRows: 0,
                    countMessages: 0,
                    complete: false
                })
            })
        })

        this.sendChanged({kind: 'start', usedWorkers: workerServers.length})
        workerServers.forEach((servers, servers_idx) => {
            const worker = new worker_threads.Worker(path.join(__dirname, 'task.worker.js'), {
                workerData: {
                    servers: servers,
                    query: this.options.query,
                    callback: {
                        messages: this.options.process_result.callback_messages,
                        rows: this.options.process_result.callback_rows,
                    },
                    save: {
                        full_file_name_messages: this.options.process_result.save_messages ? 'sss' : undefined,
                        full_file_name_rows: this.options.process_result.save_rows ? 'aaa' : undefined,
                    }
                } as TypeWorkerOptions
            })

        })

        // this.servers.forEach((server, server_idx) => {


        //     // const ticket_server = ticket.servers.find(f => f.instance === server.instance)
        //     // const worker = new worker_threads.Worker(path.join(__dirname, 'task.worker.js'), {
        //     //     workerData: {
        //     //         server: server,
        //     //         query: this.options.query,
        //     //         result: this.options.result
        //     //     } as TypeWorkedData
        //     // })
        //     // worker.on('message', (result: TypeWorkerResult) => {
        //     //     if (result.kind === 'start') {
        //     //         ticket_server.execSpId = result.spid
        //     //     }
        //     // })
        //     // worker.on('exit', () => {
        //     //     console.log('exit')
        //     // })
        //     // console.log('aaa', server.instance, server_idx)
        // })

        this.metronom.allowNextTick()
    }

    onChanged(callback: (state: TypeTaskState) => void) {
        this.callback_onStateChanged = callback
    }

    private sendChanged(state: TypeTaskState) {
        if (!this.callback_onStateChanged) return
        this.callback_onStateChanged(state)
    }

    onError(callback: (error: Error) => void) {
        this.callback_onError = callback
    }

    private sendError(error: Error) {
        if (!this.callback_onError || !error) return
        this.callback_onError(error)
    }

    private serversToWorkerChunks(): TypeServer[][] {
        const maxWorkers = this.maxWorkers && this.maxWorkers > 0 ? this.maxWorkers : 1
        if (this.servers.length <= maxWorkers) {
            return this.servers.map(m => { return [m]})
        }
        const minServersInChunks = Math.floor(this.servers.length/ this.maxWorkers)
        const chunkCapacity = [] as number[]
        for (let i = 0; i < maxWorkers; i++) {
            chunkCapacity.push(minServersInChunks)
        }
        let chunkCapacityIdx = 0
        for (let i = maxWorkers * minServersInChunks; i < this.servers.length; i++) {
            chunkCapacity[chunkCapacityIdx]++
            chunkCapacityIdx++
        }

        const result = [] as TypeServer[][]
        let chunkIdx = 0
        chunkCapacity.forEach(cc => {
            result.push(this.servers.slice(chunkIdx, chunkIdx + cc))
            chunkIdx = chunkIdx + cc
        })

        return result
    }

    // private onTickTablesNo() {
    //     const ticket = {
    //         dateStart: vvs.formatDate(new Date(), 126),
    //         dateStop: '',
    //         servers: this.servers.map(m => { return {
    //             instance: m.options.instance,
    //             execSpId: 0,
    //             execDurationMsec: -1,
    //             execError: '',
    //             countRows: 0,
    //             countMessages: 0
    //         }})
    //     } as TypeResultTicket

    //     this.sendChanged({kind: 'start'})
    //     this.servers.forEach((server, server_idx) => {
    //         const ticket_server = ticket.servers.find(f => f.instance === server.options.instance)

    //         server.exec(this.options.query, false, result_exec => {
    //             if (result_exec.kind === 'start') {
    //                 ticket_server.execSpId = result_exec.spid
    //                 this.sendChanged({kind: 'process', ticket: ticket})
    //                 return
    //             }
    //             if (result_exec.kind === 'stop') {
    //                 ticket_server.execDurationMsec = result_exec.duration
    //                 ticket_server.execError = result_exec.error? result_exec.error.message : ''
    //                 ticket_server.countMessages = result_exec.messages.length
    //                 this.sendChanged({kind: 'process', ticket: ticket})
    //                 if (server_idx + 1 === this.servers.length) {
    //                     this.sendChanged({kind: 'stop'})
    //                     z.write(this.full_file_names().messages, ticket, error => {
    //                         this.sendError(error)
    //                     })
    //                 }
    //                 return
    //             }
    //             this.sendError(new Error (`onTickTablesNo() - unprocessed result_exec with kind ${result_exec?.kind}`))
    //         })
    //     })
    // }

    // private full_file_names(): {ticket: string, rows: string, messages: string} {
    //     const d = new Date()
    //     const path_prefix = path.join(this.options.log_path, this.options.log_key, vvs.formatDate(d, 112))
    //     const file_suffix = `${this.options.log_key}.${vvs.formatDate(d, 112)}.${vvs.formatDate(d,114).replace(/:/g, '')}.json`
    //     return {
    //         ticket: path.join(path_prefix, 'tickets', `t.${file_suffix}`),
    //         rows: path.join(path_prefix, 'rows', `r.${file_suffix}`),
    //         messages: path.join(path_prefix, 'messages', `m.${file_suffix}`),
    //     }
    // }
}