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
    {kind: 'chunk', table_index: number, row_list: any[], messages: TypeMessage[]} |
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
    protected spid: number

    constructor(storage: TypeServer, app_name = 'mssqltask') {
        this.options = {
            instance: storage.instance || '',
            login: storage.login || '',
            password: storage.password || '',
        }

        this.server = mssql.create({
            instance: this.options.instance.replace(/\//g, '\\'),
            login: this.options.login,
            password: this.options.password,
            beautify_instance: 'change',
            additional: {
                app_name: vvs.isEmptyString(app_name) ? 'mssqltask' : app_name
            }
        })

        this.spid = 0
    }

    exec(query: string, allow_tables: boolean, callback: (result: TypeExecResult) => void) {
        this.server.exec(query, {allow_tables: allow_tables, database: 'master', get_spid: true, stop_on_error: true, chunk: {type: 'msec', chunk: 500}}, exec_result => {
            if (exec_result.type === 'spid') {
                this.spid = exec_result.spid || 0
                callback({
                    kind: 'start',
                    spid: this.spid
                })
                return
            }
            if (exec_result.type === 'chunk') {
                callback({
                    kind: 'chunk',
                    table_index: exec_result.chunk?.table?.table_index || -1,
                    row_list: exec_result.chunk?.table?.row_list || [],
                    messages: exec_result.chunk?.message_list?.map(m => { return {text: m.message, type: m.type} }) || []
                })
                return
            }
            if (exec_result.type === 'end') {
                this.spid = 0
                callback({
                    kind: 'stop',
                    duration: exec_result.end?.duration || 0,
                    error: exec_result.end?.error,
                    messages: exec_result.end?.message_list?.map(m => { return {text: m.message, type: m.type} }) || []
                })
                return
            }
        })
    }
}