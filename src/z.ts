import * as fs from 'fs-extra'
import * as path from 'path'
import * as vvs from 'vv-shared'

export function full_file_names(file_path: string, file_task_key: string): {ticket: string, rows: string, messages: string} {
    const d = new Date()
    const path_prefix = path.join(file_path, file_task_key, vvs.formatDate(d, 112))
    const file_suffix = `${file_task_key}.${vvs.formatDate(d, 112)}.${vvs.formatDate(d,114).replace(/:/g, '')}.json`
    return {
        ticket: path.join(path_prefix, 'tickets', `t.${file_suffix}`),
        rows: path.join(path_prefix, 'rows', `r.${file_suffix}`),
        messages: path.join(path_prefix, 'messages', `m.${file_suffix}`),
    }
}

export function write(full_file_name: string, data: string | any, callback: (error: Error) => void) {
    if (!data) {
        callback(undefined)
        return
    }
    let data_string = ''
    try {
        if (typeof data === 'string') {
            data_string = data
        } else if (Array.isArray(data)) {
            if (data.length <= 0) {
                callback(undefined)
                return
            } else {
                data_string = JSON.stringify(data, null, 4)
            }
        } else {
            data_string = JSON.stringify(data, null, 4)
        }
    } catch (error) {
        callback(error as Error)
        return
    }

    const dir = path.parse(full_file_name).dir
    fs.ensureDir(dir, error => {
        if (error) {
            callback(error)
            return
        }
        fs.writeFile(full_file_name, data_string, {encoding: 'utf8'}, error => {
            callback(error)
            return
        })
    })
}