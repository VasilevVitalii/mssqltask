// import * as lib from '../src'
import * as data from './data'
import { Task } from '../src/task'
// import * as server from '../src/server'
// import * as metronom from '../src/metronom'

// const q = `PRINT 'Hello'; SELECT * FROM rrMasterData.dbo.Assortment /*WHERE Code = 14280*/; WAITFOR DELAY '00:00:01';SELECT * FROM rrGoodsMovement.dbo.Income`
// //const q = `SELECT * FROM [master].sys.objects; WAITFOR DELAY '00:00:05';SELECT * FROM [master].sys.objects`

const task = new Task({
    key: 'task1',
    metronom: data.metronoms()[0],
    query: "print 'hello'  --select * from sys.objects",
    servers: [
        // ...data.servers().map(m => { return {...m, instance: '1'}}),
        // ...data.servers().map(m => { return {...m, instance: '2'}}),
        // ...data.servers().map(m => { return {...m, instance: '3'}}),
        // ...data.servers().map(m => { return {...m, instance: '4'}}),
        // ...data.servers().map(m => { return {...m, instance: '5'}}),
        data.servers()[0]
    ],
    process_result: {
        allow_callback_messages: true,
        allow_callback_rows: true
    }
})
task.maxWorkers = 3
task.onError(error => {
    console.warn(error)
})
task.onChanged(state => {
    console.log(JSON.parse(JSON.stringify(state)))
    if (state.kind === 'stop') {
        console.log('================================')
    }
})
task.start()

// const servers = data.servers()
// servers_ping(servers, 0, () => {
//     servers.forEach(s => {
//         if (s.ping_result.error) {
//             console.warn(`ERROR PING SERVER ${s.storage.instance}`)
//             console.warn(s.ping_result.error)
//             process.exit()
//         }
//         // s.exec_to_send([q], result => {
//         //     console.log(result)
//         // })
//         s.exec_to_file([q], 'd:/111.txt', 'd:/222.txt', result => {
//             console.log(result)
//             if (result.kind === 'stop') {
//                 //process.exit()
//             }
//         })
//     })
// })

// const metronom1 = new metronom.Metronom({kind: 'cron', cron: '0 */1 * * * *'})
// metronom1.ontick(() => {
//     console.log(`metronom1 tick with crop ${metronom1.cron().cron}`)
//     //metronom1.stop()
// })
// const metronom1_started = metronom1.start()
// console.log(`metronom1 started? - ${metronom1_started}`)

// const metronom2 = new metronom.Metronom({kind: 'scheduler', period_minutes: 1, periodicity: 'every', weekday_sun: true, weekday_mon: true, weekday_wed: true, weekday_thu: true, weekday_fri: true, weekday_tue: true, weekday_sat: true})
// metronom2.ontick(() => {
//     console.log(`metronom2 tick with crop ${metronom2.cron().cron}`)
//     metronom2.stop()
// })
// const metronom2_started = metronom2.start()
// console.log(`metronom2 started? - ${metronom2_started}`)

// const metronom3 = new metronom.Metronom({kind: 'cron', cron: 'xxx'})
// metronom3.ontick(() => {
//     console.log(`metronom3 tick with crop ${metronom3.cron().cron}`)
//     metronom3.stop()
// })
// const metronom3_started = metronom3.start()
// console.log(`metronom3 started? - ${metronom3_started}`)



// //'0 */5 * * * *'

// // eslint-disable-next-line @typescript-eslint/no-unused-vars
// const app = lib.create(error => {
//     if (error) {
//         console.warn('ERROR IN CREATE DB')
//         console.warn(error)
//         process.exit()
//     }
// })

// function servers_ping(servers: server.Server[], idx: number, callback: () => void) {
//     if (idx >= servers.length) {
//         callback()
//         return
//     }
//     servers[idx].ping(true, () => {
//         idx++
//         servers_ping(servers, idx, callback)
//     })
// }