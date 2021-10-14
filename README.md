# mssqltask
## Features
1. Cron-style scheduler
2. Running at the same time on the server list
3. Can save result to json files to disk
4. Run in workers
## License
*MIT*
## Install
```
npm i mssqltask
```
## Example
```javascript
import * as mssqltask from 'mssqltask'
const task = mssqltask.Create({
    key: 'task1',
    metronom: {kind: 'cron', cron: '0 */1 * * * *'},
    servers: [
        {
            "instance": "./EXPRESS2017",
            "login": "sa",
            "password": "123456789"
        },
    ],
    query: "print 'hello'; select * from sys.objects; select * from sys.objects; print 'bye'",
    processResult: {
        pathSaveTickets: 'c:/log',
        pathSaveRows: 'c:/log',
        pathSaveMessages: 'c:/log'
    }
})
task.maxWorkersSet(5) //if need - set limit, default = each mssql server run in individual worker
task.onError(error => {
    console.log(error)
})
task.onChanged(state => {
    console.log('task1', state)
    if (state.kind === 'stop') {
        //task worked on all servers
    }
})
task.start()
```