import * as vvs from 'vv-shared'
import { Metronom, TypeMetronom } from './metronom'
import { Server, TypeServer } from './server'

export type TypeTask = {
    metronom: TypeMetronom
    servers: TypeServer[]
    query: string
    allow_tables: boolean
    log_path: string
}

export type TypeResultTicket = {
    dateStart: string,
    dateStop: string,
    servers: {
        instance: string,
        execSpId: number,
        execDurationMsec: number,
        execError: string,
        countRows: number,
        countMessages: number
    }[]
}

export type TypeTaskState =
    {kind: 'start'} |
    {kind: 'spid', server_instance: string, spid: number}

export class Type {
    private options: TypeTask
    private metronom: Metronom
    private servers: Server[]
    private needStop: boolean

    private callback_onStateChanged: (state: TypeTaskState) => void
    private callback_onError: (error: Error) => void

    constructor(options: TypeTask) {
        this.options = options
        this.metronom = new Metronom(this.options.metronom)
        this.servers = this.options.servers.map(m => { return new Server(m) })
        this.metronom.ontick(() => {
            if (this.options.allow_tables) {
                console.log('a')
            } else {
                this.onTickTablesNo()
            }
        })
        this.metronom.start()
    }

    stop() {
        this.metronom.stop()
        this.needStop = true
    }

    onChanged(callback: (state: TypeTaskState) => void) {
        this.callback_onStateChanged = callback
    }

    onError(callback: (error: Error) => void) {
        this.callback_onError = callback
    }

    private sendChanged(state: TypeTaskState) {
        if (!this.callback_onStateChanged) return
        this.callback_onStateChanged(state)
    }

    private sendError(error: Error) {
        if (!this.callback_onError || !error) return
        this.callback_onError(error)
    }

    private onTickTablesNo() {
        const ticket = {
            dateStart: vvs.formatDate(new Date(), 126),
            dateStop: '',
            servers: this.servers.map(m => { return {
                instance: m.options.instance,
                execSpId: 0,
                execDurationMsec: -1,
                execError: '',
                countRows: 0,
                countMessages: 0
            }})
        } as TypeResultTicket

        this.sendChanged({kind: 'start'})
        this.servers.forEach(server => {
            const ticket_server = ticket.servers.find(f => f.instance === server.options.instance)

            server.exec(this.options.query, false, result_exec => {
                if (result_exec.kind === 'start') {
                    ticket_server.execSpId = result_exec.spid
                    this.sendChanged({kind: 'spid', server_instance: server.options.instance, spid: result_exec.spid})
                    return
                }
                if (result_exec.kind === 'stop') {
                    ticket_server.execDurationMsec = result_exec.duration
                    ticket_server.execError = result_exec.error? result_exec.error.message : ''
                    ticket_server.countMessages = result_exec.messages.length

                    //result_exec.
                }
            })
        })
    }
}