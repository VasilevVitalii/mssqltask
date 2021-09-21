//@ts-check
const path = require('path')
const fs = require('fs')
const full_file_name = path.join(__dirname, 'dist', 'src', 'index.js')
const data = fs.readFileSync(full_file_name, 'utf8')
const data_new = data.replace(
    "worker = new worker_threads_1.default.Worker(path_1.default.join(__dirname, 'worker.import.js'), { workerData: env });",
    "worker = new worker_threads_1.default.Worker(path_1.default.join(__dirname, 'worker.js'), { workerData: env });",
)
fs.writeFileSync(full_file_name, data_new, 'utf8')
