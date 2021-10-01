//import worker_threads from 'worker_threads'

import worker_threads from 'worker_threads'

export interface IApp {
    start(): void,
}

export function create(callback?: (error: Error | undefined) => void): IApp {
    try {
        return {
            start: () => {},
        }
    } catch (error) {
        if (typeof callback === 'function') {
            callback(error as Error)
        } else {
            throw error
        }
        return {
            start: () => {},
        }
    }
}

/*

app (facade) with task list
    worker by each task
        worker by each exec

log/yyyyddmm/task1/hhmmssmmm.json
log/yyyyddmm/task1/hhmmssmmm/rows_0.json
log/yyyyddmm/task1/hhmmssmmm/messages_0.json


log/yyyyddmm/task/tickets/     t.task.yyyyddmm.hhmmssmmm.json
log/yyyyddmm/task/rows/        r.task.yyyyddmm.hhmmssmmm.json
log/yyyyddmm/task/messages/    m.task.yyyyddmm.hhmmssmmm.json


log/task/yyyyddmm/tickets/     t.task.yyyyddmm.hhmmssmmm.json
log/task/yyyyddmm/rows/        r.task.yyyyddmm.hhmmssmmm.json
log/task/yyyyddmm/messages/    m.task.yyyyddmm.hhmmssmmm.json


ticket
    dateStart
    dateStop
    execDurationMsec
    execError
    countRows
    countMessages
*/