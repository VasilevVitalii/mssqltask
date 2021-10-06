import * as lib from '../src'
import * as data from './data'

const log_path = data.log()

//(local)\EXPRESS2017

const task1 = lib.createTask({
    key: 'task1',
    metronom: data.metronoms()[0],
    servers: data.servers(),
    query: "print 'hello'; select * from sys.objects; print 'bye'",
    process_result: {
        allow_callback_messages: false,
        allow_callback_rows: false,
        path_save_rows: log_path,
        path_save_messages: log_path,
        path_save_tickets: log_path
    }
})

task1.onChanged(state => {
    console.log(state)
    // if (state.kind === 'stop') {
    //     task1.stop()
    // }
})
task1.onError(error => {
    console.warn(error)
})
task1.start()