import path from 'path'
import fs from 'fs-extra'
import worker_threads from 'worker_threads'
import * as metronom from 'vv-metronom'
import * as vv from 'vv-common'
import { TServer, TMessage } from './server'
import { TWorkerResult, TWorkerOptions, TServerWorker } from './task.worker'

export type TTask = {
    key: string
    metronom: metronom.TypeMetronom
    servers: TServer[]
    query: string
    processResult: {
        allowCallbackRows?: boolean,
        allowCallbackMessages?: boolean,
        pathSaveTickets?: string,
        pathSaveRows?: string,
        pathSaveMessages?: string
    }
}

export type TServerTask = TServer & {
    idxs: string
}

export type TTicketResult = {
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
        messages: TMessage[],
        countRows: number,
        countMessages: number,
    }[]
}

export type TTaskState =
    {kind: 'start', usedWorkers: number, ticket: TTicketResult} |
    {kind: 'process', ticket: TTicketResult} |
    {kind: 'stop.worker'} |
    {kind: 'stop', ticket: TTicketResult}

export class Task {
    private _options: TTask
    private _metronom: metronom.Metronom
    private _servers: TServerTask[]
    private _state: {
        command: 'needStart' | 'needStop' | undefined
        status: ('idle' | 'buzy' | 'stopped')
    }

    private _callbackOnStateChanged: (state: TTaskState) => void
    private _callbackOnStop: () => void
    private _callbackOnError: (error: Error) => void
    maxWorkers: number

    constructor(options: TTask) {
        this._options = options
        this._metronom = metronom.Create(this._options.metronom)
        this._servers = this._options.servers.map((m,i) => { return {...m, idxs: `${i > 99 ? '' : i > 9 ? '0' : '00'}${i}`} })

        this._state = {
            command: undefined,
            status: 'stopped'
        }
        this._metronom.onTick(() => {
            this._onTick()
        })
        this.maxWorkers = this._servers.length
        this._metronom.start()
    }

    start() {
        this._state.command = 'needStart'
    }

    stop(callback?: () => void) {
        this._state.command = 'needStop'
        this._callbackOnStop = callback
    }

    private _onTick() {
        if (this._state.status === 'buzy') {
            this._metronom.allowNextTick()
            return
        }

        if (this._state.command === 'needStart') {
            this._state.status = 'idle'
            this._state.command = undefined
        } else if (this._state.command === 'needStop') {
            this._state.status = 'stopped'
            this._state.command = undefined
            if (this._callbackOnStop) {
                this._callbackOnStop()
                this._callbackOnStop = undefined
            }
        }

        if (this._state.status !== 'idle') {
            this._metronom.allowNextTick()
            return
        }
        this._state.status = 'buzy'

        const chunks = this._serversToWorkerChunks()
        const ticket = {
            dateStart: new Date(),
            dateStop: undefined,
            countWorkers: chunks.serverWorkers.length,
            servers: []
        } as TTicketResult
        chunks.serverWorkers.forEach((chunk, chunkId) => {
            chunk.forEach(item => {
                ticket.servers.push({
                    idxs: item.idxs,
                    workerId: chunkId,
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

        const completeIdx = [] as number[]

        this._sendChanged({kind: 'start', usedWorkers: ticket.countWorkers, ticket: ticket})
        chunks.serverWorkers.forEach((servers, serversIdx) => {
            const worker = new worker_threads.Worker(path.join(__dirname, 'task.worker.js'), {
                workerData: {
                    servers: servers,
                    query: this._options.query
                } as TWorkerOptions
            })
            worker.on('message', (result: TWorkerResult) => {
                if (result.kind === 'start') {
                    const ticketServer = ticket.servers.find(f => f.idxs === result.idxs)
                    if (ticketServer) {
                        ticketServer.state = 'process'
                        ticketServer.execSpId = result.spid
                    }
                    this._sendChanged({kind: 'process', ticket: ticket})
                    return
                }

                if (result.kind === 'rows') {
                    const ticketServer = ticket.servers.find(f => f.idxs === result.idxs)
                    if (ticketServer) {
                        ticketServer.countRows = ticketServer.countRows + result.count
                        ticketServer.rows.push(...result.data)
                    }
                    this._sendChanged({kind: 'process', ticket: ticket})
                    return
                }

                if (result.kind === 'messages') {
                    const ticketServer = ticket.servers.find(f => f.idxs === result.idxs)
                    if (ticketServer) {
                        ticketServer.countMessages = ticketServer.countMessages + result.count
                        ticketServer.messages.push(...result.data)
                    }
                    this._sendChanged({kind: 'process', ticket: ticket})
                    return
                }

                if (result.kind === 'stop') {
                    const ticketServer = ticket.servers.find(f => f.idxs === result.idxs)
                    if (ticketServer) {
                        ticketServer.execError = result.error
                        ticketServer.execDurationMsec = result.duration
                        ticketServer.state = 'stop'
                    }
                    this._sendChanged({kind: 'process', ticket: ticket})
                    return
                }

                if (result.kind === 'end') {
                    this._sendChanged({kind: 'stop.worker'})
                    result.errors.forEach(errorMessage => {
                        this._sendError(new Error (errorMessage))
                    })
                    completeIdx.push(serversIdx)
                    if (completeIdx.length === ticket.countWorkers) {
                        ticket.dateStop = new Date()
                        this._sendChanged({kind: 'stop', ticket: ticket})
                        if (chunks.fullFileNameTickets) {
                            fs.ensureDir(path.parse(chunks.fullFileNameTickets).dir, error => {
                                if (error) {
                                    this._sendError(error)
                                }
                                fs.writeFile(chunks.fullFileNameTickets, JSON.stringify({
                                    ...ticket,
                                    servers: ticket.servers.map(m => { return {
                                        idxs: m.idxs,
                                        instance: m.instance,
                                        workerId: m.workerId,
                                        execSpId: m.execSpId,
                                        execDurationMsec: m.execDurationMsec,
                                        execError: m.execError,
                                        countRows: m.countRows,
                                        countMessages: m.countMessages
                                    }})
                                }, null, 4), 'utf8', error => {
                                    if (error) {
                                        this._sendError(error)
                                    }
                                })
                            })
                        }
                        this._state.status = 'idle'
                        this._metronom.allowNextTick()
                    }
                    return
                }
            })
        })
    }

    onChanged(callback: (state: TTaskState) => void) {
        this._callbackOnStateChanged = callback
    }

    private _sendChanged(state: TTaskState) {
        if (!this._callbackOnStateChanged) return
        this._callbackOnStateChanged(state)
    }

    onError(callback: (error: Error) => void) {
        this._callbackOnError = callback
    }

    private _sendError(error: Error) {
        if (!this._callbackOnError || !error) return
        this._callbackOnError(error)
    }

    private _serversToWorkerChunks(): {fullFileNameTickets: string, serverWorkers: TServerWorker[][]} {
        const result = [] as TServerTask[][]
        const maxWorkers = this.maxWorkers && this.maxWorkers > 0 ? this.maxWorkers : 1
        if (this._servers.length <= maxWorkers) {
            result.push(...this._servers.map(m => { return [m]}))
        } else {
            const minServersInChunks = Math.floor(this._servers.length/ maxWorkers)
            const chunkCapacity = [] as number[]
            for (let i = 0; i < maxWorkers; i++) {
                chunkCapacity.push(minServersInChunks)
            }
            let chunkCapacityIdx = 0
            for (let i = maxWorkers * minServersInChunks; i < this._servers.length; i++) {
                chunkCapacity[chunkCapacityIdx]++
                chunkCapacityIdx++
            }
            let chunkIdx = 0
            chunkCapacity.forEach(cc => {
                result.push(this._servers.slice(chunkIdx, chunkIdx + cc))
                chunkIdx = chunkIdx + cc
            })
        }
        const dd = new Date()
        const pathPrefix = path.join(vv.dateFormat(dd, 'yyyymmdd'), this._options.key)
        const fileSuffix = `${this._options.key}.${vv.dateFormat(dd, 'yyyymmdd.hhmissmsec')}`

        return {
            fullFileNameTickets: this._options.processResult.pathSaveTickets ? path.join(this._options.processResult.pathSaveTickets, pathPrefix, `t.${fileSuffix}.json`) : undefined,
            serverWorkers: result.map(m => { return m.map(mm => { return {
                ...mm,
                fullFileNameRows: this._options.processResult.pathSaveRows ? path.join(this._options.processResult.pathSaveRows, pathPrefix, 'row', `r.${fileSuffix}.${mm.idxs}.json`) : undefined,
                fullFileNameMessages: this._options.processResult.pathSaveMessages ? path.join(this._options.processResult.pathSaveMessages, pathPrefix, 'msg', `m.${fileSuffix}.${mm.idxs}.json`) : undefined,
                allowCallbackRows: this._options.processResult.allowCallbackRows,
                allowCallbackMessages: this._options.processResult.allowCallbackMessages
            }})})
        }
    }


}