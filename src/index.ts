import * as path from 'path'
import worker_threads from 'worker_threads'
import { TWorkerCommand, TWorkerResult } from './index.worker'
import { TTask, TTaskState, TTicketResult, TTicketResultServer } from './task'
import { TypeMetronom } from 'vv-metronom'
export { TTask, TTaskState, TypeMetronom, TTicketResult, TTicketResultServer }

export interface IApp {
    start(): void,
    finish(): void,
    onError(callback:(error: string) => void): void,
    onChanged(callback:(state: TTaskState) => void): void
    maxWorkersSet(value: number): void
}

export function Create(options: TTask, allowMessagesInKindEnd: boolean): IApp {
    const worker = new worker_threads.Worker(path.join(__dirname, 'index.worker.js'), {
        workerData: {task: options, allowMessagesInKindEnd: allowMessagesInKindEnd},
    })
    worker.on('message', (result: TWorkerResult) => {
        switch (result.kind) {
            case 'state':
                callbackOnChanged.forEach(callback => {
                    callback(result.state)
                })
                break
            case 'error': {
                callbackOnError.forEach(callback => {
                    callback(result.error)
                })
                break
            }
            default: {
                callbackOnError.forEach(callback => {
                    callback(`unknown TypeWorkerResult ${result}`)
                })
            }
        }
    })

    const callbackOnError = [] as ((error: string) => void)[]
    const callbackOnChanged = [] as ((state: TTaskState) => void)[]

    return {
        start: () => {
            worker.postMessage({kind: 'start'} as TWorkerCommand)
        },
        finish: () => {
            worker.postMessage({kind: 'finish'} as TWorkerCommand)
        },
        onError: (callback) => {
            callbackOnError.push(callback)
        },
        onChanged: (callback) => {
            callbackOnChanged.push(callback)
        },
        maxWorkersSet(value: number) {
            worker.postMessage({kind: 'maxWorkers', maxWorkers: value} as TWorkerCommand)
        },
    }
}