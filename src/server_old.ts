import * as mssql from 'vv-mssql'
import * as vvs from 'vv-shared'
import * as vvfs from 'vv-filestream'

export type TypeServer = {
    instance: string,
    login: string,
    password: string
}

export type TypeMessage = {
    text: string,
    type: 'info' | 'error'
}

export type TypeExecResult =
    {kind: 'start', spid: number} |
    {kind: 'chunk', table_index: number, row_list: any[]} |
    {kind: 'stop', duration: number, error: Error, messages: TypeMessage[]}

// export type TypeExecResultToFile =
//     {kind: 'start', spid: number} |
//     {kind: 'stop', duration: number, error: Error}

// export type TypeExecResultToSend =
//     {kind: 'start', spid: number} |
//     {kind: 'process', table_index: number, table_rows: any[], messages: TypeMessage[]} |
//     {kind: 'stop', duration: number, error: Error}

export class Server {
    private server: mssql.app

    readonly options: TypeServer
    readonly key: string
    readonly ping_result: {
        time: Date,
        error: Error,
        duration_msec: number
    }
    readonly server_info: {
        timezone: number,
        version: string
    }

    constructor(storage: TypeServer, app_name = 'mssqltask') {
        const instance = (storage.instance || '').replace(/\\/g, '/')

        this.key = instance

        this.options = {
            instance: instance,
            login: storage.login || '',
            password: storage.password || '',
        }

        this.ping_result = {
            error: undefined,
            time: undefined,
            duration_msec: undefined
        }
        this.server_info = {
            timezone: 0,
            version: ''
        }

        this.server = mssql.create({
            instance: instance.replace(/\\/g, '\\'),
            login: this.options.login,
            password: this.options.password,
            beautify_instance: 'change',
            additional: {
                app_name: vvs.isEmptyString(app_name) ? 'mssqltask' : app_name
            }
        })
    }

    ping(callback: (error: Error) => void) {
        this.pingCore(true, callback)
    }

    exec(queries: string[], allow_tables: boolean, callback: (result: TypeExecResult) => void) {
        this.pingCore(false, error => {
            if (error) {
                callback({
                    kind: 'stop',
                    duration: 0,
                    error: error,
                    messages: []
                })
                return
            }
            this.server.exec(queries, {allow_tables: allow_tables, database: 'master', get_spid: true, stop_on_error: true, chunk: {type: 'msec', chunk: 500}}, exec_result => {
                if (exec_result.type === 'spid') {
                    callback({
                        kind: 'start',
                        spid: exec_result.spid || -1
                    })
                    return
                }
                if (exec_result.type === 'chunk') {
                    callback({
                        kind: 'chunk',
                        table_index: exec_result.chunk?.table?.table_index || -1,
                        row_list: exec_result.chunk?.table?.row_list || [],
                    })
                    return
                }
                if (exec_result.type === 'end') {
                    callback({
                        kind: 'stop',
                        duration: 0,
                        error: this.ping_result.error,
                        messages: exec_result.end?.message_list?.map(m => { return {text: m.message, type: m.type} }) || []
                    })
                    return
                }
            })
        })
    }

    private pingCore(force: boolean, callback: (error: Error) => void) {
        if (!force && this.ping_result.time && !this.ping_result.error) {
            callback(undefined)
            return
        }
        this.server.ping(error => {
            this.ping_result.time = new Date()
            if (error) {
                this.ping_result.error = error
                this.ping_result.duration_msec = undefined
                this.server_info.timezone = 0
                this.server_info.version = ''
                callback(error)
            } else {
                this.ping_result.error = undefined
                this.ping_result.duration_msec = this.server.server_info().ping.ping_duration_msec
                this.server_info.timezone = this.server.server_info().ping.timezone || 0
                this.server_info.version = this.server.server_info().ping.version || ''
                callback(undefined)
            }
        })
    }
}