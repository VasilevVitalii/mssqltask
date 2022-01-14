import path from 'path'
import fs from 'fs-extra'
import worker_threads from 'worker_threads'
import * as metronom from 'vv-metronom'
import * as vv from 'vv-common'
import { TServer } from './server'
import { TWorkerResult, TWorkerOptions, TServerWorker } from './task.worker'

export type TTask = {
    key: string
    metronom: metronom.TypeMetronom
    servers: TServer[]
    queries: string[]
    processResult: {
        pathSaveTickets?: string,
        pathSaveRows?: string,
        pathSaveMessages?: string
    }
}

export type TServerTask = TServer & {
    idxs: string
}

export type TTicketResult = {
    dateStart: string,
    dateStop: string,
    countWorkers: number
    servers: {
        idxs: string,
        instance: string,
        state: 'idle' | 'process' | 'stop'
        workerId: number,
        execSpId: number,
        execDurationMsec: number,
        execError: string,
        countRows: number,
        countMessages: number,
    }[]
}

export type TTaskState =
    {kind: 'start', usedWorkers: number, ticket: TTicketResult} |
    {kind: 'process', ticket: TTicketResult} |
    {kind: 'stop', ticket: TTicketResult} |
    {kind: 'finish'}

export class Task {
    private _options: TTask
    private _metronom: metronom.Metronom
    private _servers: TServerTask[]
    private _state: {
        isStarted: boolean,
        needFinish: boolean,
        status: 'idle' | 'buzy' | 'finish'
    }

    private _callbackOnStateChanged: (state: TTaskState) => void
    private _callbackOnFinish: () => void
    private _callbackOnError: (error: Error) => void
    maxWorkers: number

    constructor(options: TTask) {
        this._options = options
        this._metronom = metronom.Create(this._options.metronom)
        this._servers = this._options.servers.map((m,i) => { return {...m, idxs: `${i > 99 ? '' : i > 9 ? '0' : '00'}${i}`} })

        this._state = {
            isStarted: false,
            needFinish: false,
            status: 'idle'
        }
        this._metronom.onTick(() => {
            this._onTick()
        })
        this.maxWorkers = this._servers.length
    }

    start() {
        if (this._state.isStarted) return
        this._state.isStarted = true
        this._metronom.start()
    }

    finish(callback?: () => void) {
        if (this._state.needFinish || this._state.status === 'finish') return
        this._state.needFinish = true
        this._callbackOnFinish = callback
        this.finishProcess()
    }

    finishProcess(): boolean {
        if (this._state.needFinish && this._state.status === 'idle') {
            this._state.status = 'finish'
            if (this._callbackOnFinish) {
                this._callbackOnFinish()
                this._callbackOnFinish = undefined
            }
            this._metronom.stop()
            return true
        }
        return false
    }

    private _onTick() {
        if (this.finishProcess() || this._state.status === 'finish') {
            return
        }
        if (this._state.status === 'buzy') {
            this._metronom.allowNextTick()
            return
        }

        this._state.status = 'buzy'

        let chunks = this._serversToWorkerChunks()
        let ticket = {
            dateStart: vv.dateFormat(new Date(),'126'),
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
                    countRows: 0,
                    countMessages: 0
                })
            })
        })

        const completeIdx = [] as number[]

        this._sendChanged({kind: 'start', usedWorkers: ticket.countWorkers, ticket: ticket})
        chunks.serverWorkers.forEach((servers, serversIdx) => {
            let worker = new worker_threads.Worker(path.join(__dirname, 'task.worker.js'), {
                workerData: {
                    servers: servers,
                    queries: this._options.queries
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
                    }
                    this._sendChanged({kind: 'process', ticket: ticket})
                    return
                }

                if (result.kind === 'messages') {
                    const ticketServer = ticket.servers.find(f => f.idxs === result.idxs)
                    if (ticketServer) {
                        ticketServer.countMessages = ticketServer.countMessages + result.count
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
                    result.errors.forEach(errorMessage => {
                        this._sendError(new Error (errorMessage))
                    })
                    completeIdx.push(serversIdx)
                    if (completeIdx.length === ticket.countWorkers) {
                        ticket.dateStop = vv.dateFormat(new Date(), '126'),
                        this._sendChanged({kind: 'stop', ticket: ticket})
                        if (chunks.fullFileNameTickets) {
                            fs.ensureDir(path.parse(chunks.fullFileNameTickets).dir, error => {
                                if (error) {
                                    this._sendError(error)
                                }
                                fs.writeFile(chunks.fullFileNameTickets, JSON.stringify({
                                    ...ticket,
                                    servers: ticket.servers.map(m => { return {
                                        ...m, state: undefined
                                    }})
                                }, null, 4), 'utf8', error => {
                                    if (error) {
                                        this._sendError(error)
                                    }
                                    ticket = null
                                    chunks = null
                                })
                            })
                        }
                        this._state.status = 'idle'
                        this._metronom.allowNextTick()
                    }
                    worker.removeAllListeners()
                    worker.terminate()
                    worker = null
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
                fullFileNameMessages: this._options.processResult.pathSaveMessages ? path.join(this._options.processResult.pathSaveMessages, pathPrefix, 'msg', `m.${fileSuffix}.${mm.idxs}.json`) : undefined
            }})})
        }
    }
}