import * as mssql from 'vv-mssql'

export type TypeExecResult =
    {kind: 'spid', spid: number}

export class Server {
    private server: mssql.app
    private key: string
    protected ping_time: Date
    protected ping_error: Error
    protected server_timezone: number
    protected server_version: string

    constructor(instance: string, login: string, password: string, app_name = 'mssqltask') {
        this.key = instance
        this.server = mssql.create({
            instance: instance,
            login: login,
            password: password,
            beautify_instance: 'change',
            additional: {
                app_name: app_name || 'mssqltask'
            }
        })
    }

    ping(force: boolean, callback: () => void) {
        if (!force && this.ping_time && !this.ping_error) {
            callback()
            return
        }
        this.server.ping(error => {
            this.ping_time = new Date()
            if (error) {
                this.ping_error = error
                this.server_timezone = undefined
                this.server_version = undefined
            } else {
                this.ping_error = undefined
                this.server_timezone = this.server.server_info().ping.timezone
                this.server_version = this.server.server_info().ping.version
            }
            callback()
        })
    }

    exec(queries: string[], allow_tables: boolean, callback: (error: Error, result: TypeExecResult) => void ) {
        this.ping(false, () => {
            if (this.ping_error) {
                callback(this.ping_error, undefined)
                return
            }
            this.server.exec(queries, {allow_tables: allow_tables, chunk: {type: 'msec', chunk: 1000}, database: 'master', get_spid: true, null_to_undefined: true, stop_on_error: true}, (exec_result => {
                if (exec_result.type === 'spid') {
                    callback(undefined, {kind: 'spid', spid: exec_result.spid || 0})
                    return
                }
                // if (exec_result.type === 'chunk') {
                //     exec_result.chunk.table.
                // }
            }))
        })
    }
}