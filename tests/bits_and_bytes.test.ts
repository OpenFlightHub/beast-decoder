import { byteToShortBitString, byteToFullBitString, bytesToFullBitString } from "../src/util/bits_and_bytes";

test('byteToShortBitString', ()=>{
    expect(byteToShortBitString(4)).toStrictEqual('100')
    expect(byteToShortBitString(37)).toStrictEqual('100101')
})

test('byteToFullBitString', ()=>{
    expect(byteToFullBitString(4)).toStrictEqual('00000100')
    expect(byteToFullBitString(37)).toStrictEqual('00100101')
})

test('bytesToFullBitString', ()=>{
    expect(bytesToFullBitString([4, 37])).toStrictEqual('00000100' + '00100101')
})
