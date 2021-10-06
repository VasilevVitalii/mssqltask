import * as mssql from 'vv-mssql'
import * as vvs from 'vv-shared'

export type TypeServer = {
    instance: string,
    login: string,
    password: string
}

export type TypeMessage = {
    text: string,
    type: 'info' | 'error'
}

export type TypeRow = {
    table_index: number
    row: any
}

export type TypeExecResultRows = {kind: 'rows', data: TypeRow[]}
export type TypeExecResultMessages = {kind: 'messages', data: TypeMessage[]}

export type TypeExecResult =
    {kind: 'start', spid: number} |
    TypeExecResultRows |
    TypeExecResultMessages |
    {kind: 'stop', duration: number, error: Error}

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

    exec(query: string, allow_rows: boolean, allow_messages: boolean, callback: (result: TypeExecResult) => void) {
        this.server.exec(query, {allow_tables: allow_rows, database: 'master', get_spid: true, stop_on_error: true, chunk: {type: 'msec', chunk: 500}}, exec_result => {
            if (exec_result.type === 'spid') {
                this.spid = exec_result.spid || 0
                callback({
                    kind: 'start',
                    spid: this.spid
                })
                return
            }
            if (exec_result.type === 'chunk') {
                if (exec_result.chunk.table.row_list.length > 0) {
                    callback({
                        kind: 'rows',
                        data: exec_result.chunk.table.row_list.map(m => { return {table_index: exec_result.chunk.table.table_index, row: m} })
                        // [{
                        //     table_index: exec_result.chunk.table.table_index,
                        //     rows: exec_result.chunk.table.row_list
                        // }]
                    })
                }
                if (exec_result.chunk.message_list.length > 0) {
                    callback({
                        kind: 'messages',
                        data: exec_result.chunk.message_list.map(m => { return {text: m.message, type: m.type} })
                    })
                }
                return
            }
            if (exec_result.type === 'end') {
                this.spid = 0
                if (exec_result.end.table_list.some(f => f.row_list.length > 0)) {
                    callback({
                        kind: 'rows',
                        data: exec_result.end.table_list.filter(f => f.row_list.length > 0).map(m => { return {table_index: m.table_index, rows: m.row_list} })
                    })
                }
                if (exec_result.end.message_list.length > 0) {
                    callback({
                        kind: 'messages',
                        data: exec_result.end.message_list.map(m => { return {text: m.message, type: m.type} })
                    })
                }
                callback({
                    kind: 'stop',
                    duration: Math.round(exec_result.end.duration || 0),
                    error: exec_result.end.error
                })
                return
            }
        })
    }
}