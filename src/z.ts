import * as fs from 'fs-extra'
import * as path from 'path'

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