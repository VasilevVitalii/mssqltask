import path from 'path'
import worker_threads from 'worker_threads'
import * as metronom from 'vv-metronom'
import { TypeExecResult, TypeServer } from './server'
import { TypeWorkerData, TypeWorkedResult } from './task.worker'

export type TypeTaskResult = {
    allow_callback_messages?: boolean
    allow_callback_rows?: boolean,
    allow_log_messages?: boolean,
    allow_log_rows?: boolean,
    log_path?: string,
    log_key?: string
}
    // {kind: 'callback', allow_tables: boolean, allow_messages: boolean} |
    // {kind: 'save', allow_tables: boolean, allow_messages: boolean, key: string, path: string}

export type TypeTask = {
    metronom: metronom.TypeMetronom
    servers: TypeServer[]
    query: string
    result: TypeTaskResult
}

export type TypeTicketResult = {
    dateStart: Date,
    dateStop: Date,
    servers: {
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
    {kind: 'start'} |
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

    constructor(options: TypeTask) {
        this.options = options
        this.metronom = metronom.CreateMetronom(this.options.metronom)
        this.servers = this.options.servers
        this.state = {
            needStop: false,
            status: 'stopped'
        }
        this.metronom.ontick(() => {
            this.onTick()
        })
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
        const ticket = {
            dateStart: new Date(),
            dateStop: undefined,
            servers: this.servers.map(m => { return {
                instance: m.instance,
                execSpId: 0,
                execDurationMsec: 0,
                execError: '',
                countRows: 0,
                countMessages: 0,
                complete: false
            }})
        } as TypeTicketResult
        this.sendChanged({kind: 'start'})
        this.servers.forEach((server, server_idx) => {
            const ticket_server = ticket.servers.find(f => f.instance === server.instance)
            const worker = new worker_threads.Worker(path.join(__dirname, 'task.worker.js'), {
                workerData: {
                    server: server,
                    query: this.options.query,
                    result: this.options.result
                } as TypeWorkedData
            })
            worker.on('message', (result: TypeWorkerResult) => {
                if (result.kind === 'start') {
                    ticket_server.execSpId = result.spid
                }
            })
            worker.on('exit', () => {
                console.log('exit')
            })
            console.log('aaa', server.instance, server_idx)
        })
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