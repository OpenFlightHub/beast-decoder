import {parseBeastSocketData} from "../src";
import * as fs from 'fs'

const messages: Buffer<ArrayBufferLike>[] = fs.readFileSync('tests/example_messages_base64.txt', 'utf-8').split('\n').filter(line => line.length > 0).map(line => Buffer.from(line, 'base64'))

test('parsing', ()=>{
    for(const message of messages){
        const parsed = parseBeastSocketData(message)
    }
})