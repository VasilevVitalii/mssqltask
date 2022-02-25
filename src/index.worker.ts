import { workerData, parentPort } from 'worker_threads'
import { Task, TTask, TTaskState } from './task'

const options = workerData as {task: TTask, allowMessagesInKindEnd: boolean}

export type TWorkerCommand =
    { kind: 'start'} |
    { kind: 'finish' } |
    { kind: 'maxWorkers', maxWorkers: number}


export type TWorkerResult =
    { kind: 'state', state: TTaskState } |
    { kind: 'error', error: string }

const task = new Task(options.task, options.allowMessagesInKindEnd)

parentPort.on('message', (command: TWorkerCommand) => {
    switch (command.kind) {
        case 'start':
            task.start()
            break
        case 'finish':
            task.finish(() => {
                parentPort.postMessage({
                    kind: 'state', state: {kind: 'finish'}
                } as TWorkerResult)
            })
            break
        case 'maxWorkers':
            task.maxWorkers = command.maxWorkers
            break
        default:
            parentPort.postMessage({
                kind: 'error',
                error: `unknown TypeWorkerCommand ${command}`
            } as TWorkerResult)
    }
})

task.onChanged(state => {
    parentPort.postMessage({
        kind: 'state',
        state: state
    } as TWorkerResult)
})

task.onError(error => {
    parentPort.postMessage({
        kind: 'error',
        error: error?.message
    } as TWorkerResult)
})

