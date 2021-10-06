import path from 'path'
import fs from 'fs-extra'
import worker_threads from 'worker_threads'
import * as metronom from 'vv-metronom'
import * as vvs from 'vv-shared'
import { TypeServer, TypeMessage } from './server'
import { TypeWorkerResult, TypeWorkerOptions, TypeServerWorker } from './task.worker'

export type TypeTask = {
    key: string
    metronom: metronom.TypeMetronom
    servers: TypeServer[]
    query: string
    process_result: {
        allow_callback_rows?: boolean,
        allow_callback_messages?: boolean,
        path_save_rows?: string,
        path_save_messages?: string,
        path_save_tickets?: string
    }
}

export type TypeServerTask = TypeServer & {
    idxs: string
}

export type TypeTicketResult = {
    dateStart: Date,
    dateStop: Date,
    countWorkers: number
    servers: {
        idxs: string,
        instance: string,
        state: 'idle' | 'process' | 'stop'
        workerId: number,
        execSpId: number,
        execDurationMsec: number,
        execError: string,
        rows: any[],
        messages: TypeMessage[],
        countRows: number,
        countMessages: number,
    }[]
}

export type TypeTaskState =
    {kind: 'start', usedWorkers: number, ticket: TypeTicketResult} |
    {kind: 'process', ticket: TypeTicketResult} |
    {kind: 'stop.worker'} |
    {kind: 'stop', ticket: TypeTicketResult}

export class Task {
    private options: TypeTask
    private metronom: metronom.Metronom
    private servers: TypeServerTask[]
    private state: {
        command: 'needStart' | 'needStop' | undefined
        status: ('idle' | 'buzy' | 'stopped')
    }

    private callback_onStateChanged: (state: TypeTaskState) => void
    private callback_onError: (error: Error) => void
    maxWorkers: number

    constructor(options: TypeTask) {
        this.options = options
        this.metronom = metronom.CreateMetronom(this.options.metronom)
        this.servers = this.options.servers.map((m,i) => { return {...m, idxs: `${i > 99 ? '' : i > 9 ? '0' : '00'}${i}`} })

        this.state = {
            command: undefined,
            status: 'stopped'
        }
        this.metronom.onTick(() => {
            this.onTick()
        })
        this.maxWorkers = this.servers.length
        this.metronom.start()
    }

    start() {
        this.state.command = 'needStart'
    }

    stop() {
        this.state.command = 'needStop'
    }

    private onTick() {
        if (this.state.status === 'buzy') {
            this.metronom.allowNextTick()
            return
        }

        if (this.state.command === 'needStart') {
            this.state.status = 'idle'
            this.state.command = undefined
        } else if (this.state.command === 'needStop') {
            this.state.status = 'stopped'
            this.state.command = undefined
        }

        if (this.state.status !== 'idle') {
            this.metronom.allowNextTick()
            return
        }
        this.state.status = 'buzy'

        const servers_workers = this.serversWorkers()
        const ticket = {
            dateStart: new Date(),
            dateStop: undefined,
            countWorkers: servers_workers.items.length,
            servers: []
        } as TypeTicketResult
        servers_workers.items.forEach((chunk, chunk_id) => {
            chunk.forEach(item => {
                ticket.servers.push({
                    idxs: item.idxs,
                    workerId: chunk_id,
                    instance: item.instance,
                    state: 'idle',
                    execSpId: 0,
                    execDurationMsec: 0,
                    execError: '',
                    rows: [],
                    messages: [],
                    countRows: 0,
                    countMessages: 0
                })
            })
        })

        const worker_results = [] as TypeWorkerResult[]
        const worker_results_complete_idxs = [] as string[]
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this
        let worker_results_timer = setTimeout(function tick () {
            const result = worker_results.shift()
            if (!result) {
                worker_results_timer = setTimeout(tick, 100)
                return
            }
            if (result.kind === 'start') {
                const ticket_server = ticket.servers.find(f => f.idxs === result.idxs)
                if (ticket_server) {
                    ticket_server.state = 'process'
                    ticket_server.execSpId = result.spid
                }
                self.sendChanged({kind: 'process', ticket: ticket})
                worker_results_timer = setTimeout(tick, 10)
                return
            }

            if (result.kind === 'rows') {
                const ticket_server = ticket.servers.find(f => f.idxs === result.idxs)
                if (ticket_server) {
                    ticket_server.countRows = ticket_server.countRows + result.count
                    ticket_server.rows.push(...result.data)
                }
                self.sendChanged({kind: 'process', ticket: ticket})
                worker_results_timer = setTimeout(tick, 10)
                return
            }

            if (result.kind === 'messages') {
                const ticket_server = ticket.servers.find(f => f.idxs === result.idxs)
                if (ticket_server) {
                    ticket_server.countMessages = ticket_server.countMessages + result.count
                    ticket_server.messages.push(...result.data)
                }
                self.sendChanged({kind: 'process', ticket: ticket})
                worker_results_timer = setTimeout(tick, 10)
                return
            }

            if (result.kind === 'stop') {
                const ticket_server = ticket.servers.find(f => f.idxs === result.idxs)
                if (ticket_server) {
                    ticket_server.execError = result.error
                    ticket_server.execDurationMsec = result.duration
                    ticket_server.state = 'stop'
                }
                self.sendChanged({kind: 'process', ticket: ticket})
                worker_results_timer = setTimeout(tick, 10)
                return
            }

            if (result.kind === 'end') {
                self.sendChanged({kind: 'stop.worker'})
                result.errors.forEach(error_message => {
                    self.sendError(new Error (error_message))
                })
                worker_results_complete_idxs.push('XXX')
                if (worker_results_complete_idxs.length === servers_workers.items.length) {
                    ticket.dateStop = new Date()
                    self.sendChanged({kind: 'stop', ticket: ticket})
                    self.state.status = 'idle'
                    self.metronom.allowNextTick()
                    if (servers_workers.full_file_name_tickets) {
                        fs.ensureDir(path.parse(servers_workers.full_file_name_tickets).dir, () => {
                            fs.writeFile(servers_workers.full_file_name_tickets, JSON.stringify({
                                dateStart: vvs.formatDate(ticket.dateStart, 126),
                                dateStop: vvs.formatDate(ticket.dateStop, 126),
                                countWorkers: ticket.countWorkers,
                                servers: ticket.servers.map(m => { return {
                                    idxs: m.idxs,
                                    instance: m.instance,
                                    workerId: m.workerId,
                                    execSpId: m.execSpId,
                                    execDurationMsec: m.execDurationMsec,
                                    execError: m.execError,
                                    countRows: m.countRows,
                                    countMessages: m.countMessages
                                } })
                            }, null, 4), {encoding: 'utf8'}, error => {
                                if (error) {
                                    self.sendError(error)
                                }
                            })
                        })
                    }
                } else {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    worker_results_timer = setTimeout(tick, 10)
                }
                return
            }
        }, 100)

        this.sendChanged({kind: 'start', usedWorkers: servers_workers.items.length, ticket: ticket})
        servers_workers.items.forEach((servers, i) => {
            const worker = new worker_threads.Worker(path.join(__dirname, 'task.worker.js'), {
                workerData: {
                    servers: servers,
                    query: this.options.query
                } as TypeWorkerOptions
            })
            worker.on('message', (result: TypeWorkerResult) => {
                worker_results.push(result)
            })
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

    private serversWorkers(): {full_file_name_tickets: string, items: TypeServerWorker[][]} {
        const result = [] as TypeServerTask[][]
        const maxWorkers = this.maxWorkers && this.maxWorkers > 0 ? this.maxWorkers : 1
        if (this.servers.length <= maxWorkers) {
            result.push(...this.servers.map(m => { return [m]}))
        } else {
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
            let chunkIdx = 0
            chunkCapacity.forEach(cc => {
                result.push(this.servers.slice(chunkIdx, chunkIdx + cc))
                chunkIdx = chunkIdx + cc
            })
        }

        const dd = new Date()
        const path_prefix = path.join(vvs.formatDate(dd, 112), this.options.key)
        const file_suffix = `${vvs.formatDate(dd, 112)}.${vvs.formatDate(dd, 114).replace(/:/g, '')}`

        return {
            full_file_name_tickets: this.options.process_result.path_save_tickets ? path.join(this.options.process_result.path_save_tickets, path_prefix, 'tickets', `t.${this.options.key}.${file_suffix}.json`) : undefined,
            items: result.map(m => { return m.map(mm => { return {
                ...mm,
                full_file_name_rows: this.options.process_result.path_save_rows ? path.join(this.options.process_result.path_save_rows, path_prefix, 'rows', `r.${this.options.key}.${file_suffix}.${mm.idxs}.json`) : undefined,
                full_file_name_messages: this.options.process_result.path_save_messages ? path.join(this.options.process_result.path_save_messages, path_prefix, 'messages', `m.${this.options.key}.${file_suffix}.${mm.idxs}.json`) : undefined,
                allow_callback_rows: this.options.process_result.allow_callback_rows,
                allow_callback_messages: this.options.process_result.allow_callback_messages
            } }) })
        }
    }


}