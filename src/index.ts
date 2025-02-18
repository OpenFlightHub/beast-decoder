export { parseBeastSocketData } from './parse'
export type { BeastParsedFrame, BeastParsedFrameType } from './parse'


export { parseADSB, ADSB_ParsedMessage, parseModeS, ModeS_ParsedMessage } from 'mode-s-adsb-parser'

import { isDevEnvironment } from './util/env'
import runExample from './example'

if(isDevEnvironment()){
    runExample()
}