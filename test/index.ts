import * as lib from '../src'
import * as data from './data'
import * as vv from 'vv-common'

const logPath = data.Log()

const task1 = lib.Create({
    key: 'task1',
    metronom: data.Metronoms()[0],
    servers: data.Servers(),
    queries: ["print 'hello1'; select * from sys.objects; select * from sys.objects; print 'bye1'"],
    processResult: {
        allowCallbackMessages: false,
        allowCallbackRows: false,
        pathSaveTickets: logPath,
        pathSaveRows: logPath,
        pathSaveMessages: logPath
    }
})

const task2 = lib.Create({
    key: 'task2',
    metronom: data.Metronoms()[1],
    servers: data.Servers(),
    queries: ["print 'hello2'; select top 10 * from sys.objects; select top 5 * from sys.objects; print 'bye2'; declare @p int", "decpare @p bit"],
    processResult: {
        allowCallbackMessages: true,
        allowCallbackRows: true,
        pathSaveTickets: logPath,
        pathSaveRows: logPath,
        pathSaveMessages: logPath
    }
})

const task3 = lib.Create({
    key: 'task3',
    metronom: data.Metronoms()[0],
    servers: data.Servers(),
    queries: ["print 'hello2'; select top 1 * from sys.objects; select top 1 * from sys.objects; print 'bye2'"],
    processResult: {
        allowCallbackMessages: true,
        allowCallbackRows: true,
        pathSaveTickets: logPath,
    }
})

let task1CountTick = 0
let task2CountTick = 0
let task3CountTick = 0

task1.onChanged(state => {
    console.log('task1', state)
    if (state.kind === 'stop') {
        task1CountTick++
        if (task1CountTick >= 2) {
            task1.stop()
        }
    }
})
task1.maxWorkersSet(-42)
task2.onChanged(state => {
    task2.stop()
    console.log('task2', state)
    if (state.kind === 'stop') {
        task2CountTick++
    }
})
task2.maxWorkersSet(999)
task3.onChanged(state => {
    console.log('task3', state)
    if (state.kind === 'stop') {
        task3CountTick++
        if (task3CountTick >= 2) {
            task3.stop()
        }
    }
})

const errors = [] as {taskKey: string, error: string}[]

task1.onError(error => {
    errors.push({taskKey: 'task1', error: error})
})
task2.onError(error => {
    errors.push({taskKey: 'task2', error: error})
})
task3.onError(error => {
    errors.push({taskKey: 'task3', error: error})
})
task1.start()
task2.start()
task3.start()

setTimeout(() => {
    errors.forEach(error => {
        console.warn(`ERROR IN "${error.taskKey}" - ${error.error}`)
    })

    if (errors.length > 0) {
        console.warn('TEST FAIL, TASK WORK WITH ERROR')
        process.exit()
    } else if (task1CountTick != 2) {
        console.warn(`TEST FAIL, task1CountTick = ${task1CountTick}`)
        process.exit()
    } else if (task2CountTick != 1) {
        console.warn(`TEST FAIL, task2CountTick = ${task2CountTick}`)
        process.exit()
    } else if (task3CountTick != 2) {
        console.warn(`TEST FAIL, task3CountTick = ${task3CountTick}`)
        process.exit()
    }

    vv.dir(logPath, {mode: 'all'}, (error, result) => {
        if (error) {
            console.warn(error)
            return
        }
        const countFiles = result.filter(f => !vv.isEmpty(f.file)).length
        if (countFiles !== 17) {
            console.warn(`TEST FAIL, countFiles = ${countFiles}`)
            process.exit()
        }
        console.log('TEST PASSED')
        process.exit()
    })
}, 1000 * 60 * 4)