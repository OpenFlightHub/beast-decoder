import {addMissingProperties, assignObject, ComputeRange} from './util'
import {decodeGrayCode} from './gray_code'

// docs see https://wiki.jetvision.de/wiki/Mode-S_Beast:Data_Output_Formats

type BeastBinaryFrame<T extends BeastBinaryFrameFormat> = {
    format: T,
    bytes: number[]
}

type BeastParsedFrameType = BeastParsedFrameType_Mode_AC | BeastParsedFrameType_Mode_S_Short | BeastParsedFrameType_Mode_S_Long | BeastParsedFrameType_Debug
type BeastParsedFrameType_Mode_AC = 'MODE_AC'
type BeastParsedFrameType_Mode_S_Short = 'MODE_S_SHORT'
type BeastParsedFrameType_Mode_S_Long = 'MODE_S_LONG'
type BeastParsedFrameType_Debug = 'DEBUG'

type BeastParsedFrame<T extends BeastParsedFrameType> = (T extends 'MODE_AC' ? {
    ac: string
} : T extends 'MODE_S_SHORT' ? {
    sShort: string
} : T extends 'MODE_S_LONG' ? {
    sLong: string
} : T extends 'DEBUG' ? {
    debug: string
} : unknown) & {
    type: T,
    mlatTimestamp: number
    signalLevel: number // 0-1
}

export function parseBeastBinaryMessage(message: Buffer<ArrayBufferLike>) {
    //TODO
}




const ESCAPE_BYTE = 0x1a

const BEAST_BINARY_FRAME_FORMAT_MODE_AC: BeastBinaryFrameFormat_Mode_AC = 0x31
const BEAST_BINARY_FRAME_FORMAT_MODE_S_SHORT: BeastBinaryFrameFormat_Mode_S_Short = 0x32
const BEAST_BINARY_FRAME_FORMAT_MODE_S_LONG: BeastBinaryFrameFormat_Mode_S_Long = 0x33
const BEAST_BINARY_FRAME_FORMAT_DEBUG: BeastBinaryFrameFormat_Debug = 0x34

// just the content, no escape bytes, no frame format bytes
const BEAST_BINARY_FRAME_CONTENT_LENGTHS: Record<BeastBinaryFrameFormat, number>=  {
    0x31: 6 + 1 + 2,
    0x32: 6 + 1 + 7,
    0x33: 6 + 1 + 14,
    0x34: 6 + 1 + 1 //TODO is this correct? documentation is unclear https://wiki.jetvision.de/wiki/Mode-S_Beast:Data_Output_Formats
}

type BeastBinaryFrameFormat = BeastBinaryFrameFormat_Mode_AC | BeastBinaryFrameFormat_Mode_S_Short | BeastBinaryFrameFormat_Mode_S_Long | BeastBinaryFrameFormat_Debug
type BeastBinaryFrameFormat_Mode_AC = 0x31
type BeastBinaryFrameFormat_Mode_S_Short = 0x32
type BeastBinaryFrameFormat_Mode_S_Long = 0x33
type BeastBinaryFrameFormat_Debug = 0x34


class FormatError extends Error {
    constructor(message: string){
        super(message)
    }
}

class FormatErrorWithByteIndex extends Error {
    constructor(message: string, byteIndex: number){
        super(message + ' at byte ' + byteIndex)
    }
}


/**
 *
 * @returns messages contained in that line (already unescaped)
 */
function parseBeastLine(bytes: Buffer<ArrayBufferLike>){

    /* for documentation see

        https://wiki.jetvision.de/wiki/Mode-S_Beast:Data_Output_Formats
        https://github.com/denzen84/dump1090/blob/master/sdr_beast.c @ static int copyBinMessageSafe()
    */


    const frames: BeastBinaryFrame<BeastBinaryFrameFormat>[] = [] // TODO is this efficient? shouldnt we use some kind of Buffer?

    if(bytes[0] !== ESCAPE_BYTE){
        throw new FormatErrorWithByteIndex('first byte is not an escape byte', 0)
    }

    let currentFrameBytes: number[] = []
    let currentFrameFormat: BeastBinaryFrameFormat

    for(let byteIndex = 0; byteIndex < bytes.length; byteIndex++){
        const byte = bytes[byteIndex]

        if(currentFrameBytes.length === 0 && typeof currentFrameFormat !== 'number' && byte !== ESCAPE_BYTE){
            throw new FormatErrorWithByteIndex('first byte of frame is not an escape byte', byteIndex)
        }

        if(byte === ESCAPE_BYTE){
            const nextByteIndex = byteIndex+1
            if(bytes.length <= nextByteIndex){
                throw new FormatErrorWithByteIndex('unexpected escape byte at the very end', byteIndex)
            }

            const nextByte = bytes[nextByteIndex]

            if(nextByte === ESCAPE_BYTE){
                currentFrameBytes.push(nextByte)
            } else if(nextByte === BEAST_BINARY_FRAME_FORMAT_MODE_AC || nextByte === BEAST_BINARY_FRAME_FORMAT_MODE_S_SHORT || nextByte === BEAST_BINARY_FRAME_FORMAT_MODE_S_LONG || nextByte === BEAST_BINARY_FRAME_FORMAT_DEBUG){
                // new message starts

                if(currentFrameBytes.length > 0){
                    makeFrameAndCleanup()
                }

                currentFrameFormat = nextByte
            } else {
                throw new FormatErrorWithByteIndex('unexpected escape byte (the following byte ' + (byteIndex+1) + ' does not need escaping)', byteIndex)
            }

            byteIndex += 1 //skip processing of next byte
        } else {
            currentFrameBytes.push(byte)
        }
    }

    if(currentFrameBytes.length > 0){
        makeFrameAndCleanup()
    }

    function makeFrameAndCleanup(){
        if(typeof currentFrameFormat !== 'number'){
            throw new FormatError('can not make message, currentFrameFormat is undefined')
        }

        const expectedFrameContentLength = BEAST_BINARY_FRAME_CONTENT_LENGTHS[currentFrameFormat]
        if(currentFrameBytes.length !== expectedFrameContentLength){
            throw new FormatError('invalid content byte length for frame type "' + String.fromCharCode(currentFrameFormat) + '": ' + currentFrameBytes.length + ' (expected ' + expectedFrameContentLength + ')')
        }

        frames.push({
            format: currentFrameFormat,
            bytes: currentFrameBytes
        })

        currentFrameBytes = []
        currentFrameFormat = undefined
    }

    return frames
}


function parseBeastFrame(frame: BeastBinaryFrame<BeastBinaryFrameFormat>) : BeastParsedFrame<BeastParsedFrameType> {

    const dataBytes = frame.bytes.slice(7)
    const mlatTimestamp = bitStringToUnsignedIntegerSafeRangeFromBits(bytesToBitString(frame.bytes.slice(0, 6)), 6, 'mlatTimestamp')
    const signalLevel = frame.bytes[6] / 255

    if(frame.format === BEAST_BINARY_FRAME_FORMAT_MODE_AC){

        const ac = 'TODO'//TODO

        return {
            type: 'MODE_AC',
            mlatTimestamp,
            signalLevel,
            ac
        }

    } else if(frame.format === BEAST_BINARY_FRAME_FORMAT_MODE_S_SHORT){

        const sShort = 'TODO'//TODO

        return {
            type: 'MODE_S_SHORT',
            mlatTimestamp,
            signalLevel,
            sShort
        }

    } else if(frame.format === BEAST_BINARY_FRAME_FORMAT_MODE_S_LONG){

        const sLong = 'TODO'//TODO

        const data = parseModeSLong(dataBytes)

        return {
            type: 'MODE_S_LONG',
            mlatTimestamp,
            signalLevel,
            sLong
        }

    } else if(frame.format === BEAST_BINARY_FRAME_FORMAT_DEBUG){

        const debug = 'TODO'//TODO
        return {
            type: 'DEBUG',
            mlatTimestamp,
            signalLevel,
            debug
        }
    } else {
        throw new Error('unexpected frame.format: ' + frame.format)
    }
}


type ModeSMessage = {
    downlinkFormat: number // 17 = civilian Mode S Extended Squitter, 18 = civilian Mode S Extended Squitter (non interogable equipment)
    transponderCapability: number /*
        0 = level 1 transponder
        1-3 = reserved
        4 = level 2+ transponder, with ability to set transponderCapability to 7, ON GROUND
        5 = level 2+ transponder, with ability to set transponderCapability to 7, AIRBORNE
        6 = level 2 transponder, with ability to set transponderCapability to 7, either ON GROUND or AIRBONE
        7 = Signifies the Downlink Request value is 0, or the Flight Status is 2, 3, 4, or 5, either airborne or on the ground
    */
   icaoAddress: string //hex encoded address
}


//TODO ModeSLong should be named ModeS Extended Squitter
function parseModeSLong(bytes: number[]){

    // see https://mode-s.org/1090mhz/content/ads-b/1-basics.html

    const bits = bytesToBitString(bytes)

    const struct = parseBitStructure(bits, [{
        name: 'downlinkFormat',
        bits: 5
    }, {
        name: 'transponderCapability',
        bits: 3
    }, {
        name: 'icaoAircraftAddress',
        bits: 24
    }, {
        name: 'message',
        bits: 56
    }])

    const downlinkFormat = bitStringToUnsignedIntegerSafeRangeFromBits(struct.get('downlinkFormat'), 5, 'downlinkFormat')

    const transponderCapability = bitStringToUnsignedIntegerSafeRangeFromBits(struct.get('transponderCapability'), 3, 'transponderCapability')

    const icaoAircraftAddress = bitStringToUnsignedIntegerSafeRangeFromBits(struct.get('icaoAircraftAddress'), 24, 'icaoAircraftAddress').toString(16)

    const message = parseExtendedSquitterMessage(struct.get('message'))

    //const parity = todo
}

type ModeSExtendedSquitterMessage = ModeSExtendedSquitterMessage_AircraftIdentificationAndCategory | ModeSExtendedSquitterMessage_SurfacePosition | ModeSExtendedSquitterMessage_AirbornePosition | ModeSExtendedSquitterMessage_OperationStatus

type ModeSExtendedSquitterMessage_Base = {
    typeCode: number /*
        1–4 	Aircraft identification
        5–8 	Surface position
        9–18 	Airborne position (w/Baro Altitude)
        19 	Airborne velocities
        20–22 	Airborne position (w/GNSS Height)
        23–27 	Reserved
        28 	Aircraft status
        29 	Target state and status information
        31 	Aircraft operation status
    */
}

interface ModeSExtendedSquitterMessage_AircraftIdentificationAndCategory extends ModeSExtendedSquitterMessage_Base {
    typeCode: 1 | 2 | 3 | 4
}

interface ModeSExtendedSquitterMessage_SurfacePosition extends ModeSExtendedSquitterMessage_Base, CprData {
    groundSpeedAvailable: boolean
    groundSpeedAbove175kt: boolean
    groundSpeed: number
    groundTrackAvailable: boolean
    groundTrack: number // true north (the point on the Earth's surface that intersects the Earth's rotational axis.)
    time: boolean
}

type ModeSExtendedSquitterMessage_AirbornePosition = ModeSExtendedSquitterMessage_AirbornePosition_AltitudeBarometric | ModeSExtendedSquitterMessage_AirbornePosition_AltitudeGnss

interface ModeSExtendedSquitterMessage_AirbornePosition_Base extends ModeSExtendedSquitterMessage_Base, CprData {
    surveilanceStatus: 'no_condition' | 'permanent_alert' | 'temporary_alert' | 'spi_condition'
    singleAntennaFlag: boolean
    time: boolean
}
interface ModeSExtendedSquitterMessage_AirbornePosition_AltitudeBarometric extends ModeSExtendedSquitterMessage_AirbornePosition_Base {
    typeCode: 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18
    altitudeInFeetBarometric: number
}

interface ModeSExtendedSquitterMessage_AirbornePosition_AltitudeGnss extends ModeSExtendedSquitterMessage_AirbornePosition_Base {
    typeCode: 20 | 21 | 22
    altitudeInMetersGnss: number
}

type ModeSExtendedSquitterMessage_OperationStatus = ModeSExtendedSquitterMessage_OperationStatus_v1 | ModeSExtendedSquitterMessage_OperationStatus_v2

type ModeSExtendedSquitterMessage_OperationStatus_v1 = ModeSExtendedSquitterMessage_OperationStatus_v1_Airborne | ModeSExtendedSquitterMessage_OperationStatus_v1_Surface

interface ModeSExtendedSquitterMessage_OperationStatus_v1_Base extends ModeSExtendedSquitterMessage_Base {
    typeCode: 31
    subType: 'airborne' | 'surface'
    operationalMode: number
    adsbVersion: 0 | 1
    nicSuplement: boolean
    navigationalAccuracyCategoryPosition: number
    surveilanceIntegrityLevel: number
    horizontalReferenceDirection: boolean
}

interface ModeSExtendedSquitterMessage_OperationStatus_v1_Airborne extends ModeSExtendedSquitterMessage_OperationStatus_v1_Base {
    airborneCapacityClass: number
    barometricAltitudeQuality: number
    barometricAltitudeIntegrity: number
}

interface ModeSExtendedSquitterMessage_OperationStatus_v1_Surface extends ModeSExtendedSquitterMessage_OperationStatus_v1_Base {
    surfaceCapacityClass: number
    lengthWidthCode: number
    trackAngleOrHeading: number
}

type ModeSExtendedSquitterMessage_OperationStatus_v2 = ModeSExtendedSquitterMessage_OperationStatus_v2_Airborne | ModeSExtendedSquitterMessage_OperationStatus_v2_Surface

interface ModeSExtendedSquitterMessage_OperationStatus_v2_Base extends ModeSExtendedSquitterMessage_Base {
    typeCode: 31
    subType: 'airborne' | 'surface'
    adsbVersion: 0 | 1 | 2
    nicSuplement: boolean
    horizontalReferenceDirection: boolean
    sourceIntegrityLevel: number
    silSupplement: boolean
}


interface ModeSExtendedSquitterMessage_OperationStatus_v2_Airborne extends ModeSExtendedSquitterMessage_OperationStatus_v2_Base {
    airborneCapacityClass: number
    airborneOperationalMode: number
    geometricVerticalAccuracy: number
    barometricAltitudeIntegrity: boolean
}

interface ModeSExtendedSquitterMessage_OperationStatus_v2_Surface extends ModeSExtendedSquitterMessage_OperationStatus_v2_Base {
    surfaceCapacityClass: number
    lengthWidthCode: number
    surfaceOperationalMode: number
    trackAngleOrHeading: number
}


type CprData = {
    cprFormat: 'odd' | 'even'
    cprEncodedPosition: {
        latitude: number
        longitude: number
    }
}


function parseExtendedSquitterMessage(bitString: string): ModeSExtendedSquitterMessage {
    const structGeneral = parseBitStructure(bitString, [{
        name: 'typeCode',
        bits: 5
    }, {
        name: 'rest',
        bits: -1
    }])

    const typeCode = bitStringToUnsignedIntegerSafeRangeFromBits(structGeneral.get('typeCode'), 5, 'typeCode')

    if(typeCode >= 1 && typeCode <= 4){
        // identification and category, see https://mode-s.org/1090mhz/content/ads-b/2-identification.html

        const structIdentificationAndCategory = parseBitStructure(structGeneral.get('rest'), [{
            name: 'category',
            bits: 3
        }, {
            name: 'callsign_0',
            bits: 6
        }, {
            name: 'callsign_1',
            bits: 6
        }, {
            name: 'callsign_2',
            bits: 6
        }, {
            name: 'callsign_3',
            bits: 6
        }, {
            name: 'callsign_4',
            bits: 6
        }, {
            name: 'callsign_5',
            bits: 6
        }])

        const category = bitStringToUnsignedIntegerSafeRangeFromBits(structIdentificationAndCategory.get('category'), 3, 'category')

        const callsignChars = []

        for(let i = 0; i < 6; i++){
            const callsignCharNumber = bitStringToUnsignedIntegerSafeRangeFromBits(structIdentificationAndCategory.get(
                // @ts-ignore
                'callsign_' + i
            ), 6, 'callsign_' + i)

            const char = '#ABCDEFGHIJKLMNOPQRSTUVWXYZ##### ###############0123456789######'.charAt(callsignCharNumber)
            callsignChars.push(char)
        }


        //TODO implement detailed category from https://mode-s.org/1090mhz/content/ads-b/2-identification.html#tb:adsb_id_wake_category

    } else if(typeCode >= 5 && typeCode <= 8){
        // surface position https://mode-s.org/1090mhz/content/ads-b/4-surface-position.html

        const structSurfacePosition = parseBitStructure(structGeneral.get('rest'), [{
            name: 'groundSpeed',
            bits: 7
        }, {
            name: 'groundTrackStatus',
            bits: 1
        }, {
            name: 'groundTrack',
            bits: 7
        }, {
            name: 'time',
            bits: 1
        }, {
            name: 'cprFormat',
            bits: 1
        }, {
            name: 'cprEncodedLatitude',
            bits: 17
        }, {
            name: 'cprEncodedLongitude',
            bits: 17
        }])


        const gspeed = bitStringToUnsignedIntegerSafeRangeFromBits(structSurfacePosition.get('groundSpeed'), 7, 'groundSpeed')
        const g = convertQuantizedGroundSpeed(gspeed)

        const groundTrackAvailable = structSurfacePosition.get('groundTrackStatus') === '1'

        const ret: ModeSExtendedSquitterMessage_SurfacePosition = {
            typeCode,
            groundSpeedAvailable: g.groundSpeedAvailable,
            groundSpeedAbove175kt: g.groundSpeedAbove175kt,
            groundSpeed: g.groundSpeed,
            groundTrackAvailable,
            groundTrack: groundTrackAvailable ? bitStringToUnsignedIntegerSafeRangeFromBits(structSurfacePosition.get('groundTrack'), 7, 'groundTrack') * 360 / 128 : 0,
            time: convertIntegerTo(
                bitStringToUnsignedIntegerSafeRangeFromBits(structSurfacePosition.get('time'), 1, 'time'),
                {
                    '0': false,
                    '1': true
                }, 'time'
            ),
            cprFormat: convertIntegerTo(
                bitStringToUnsignedIntegerSafeRangeFromBits(structSurfacePosition.get('cprFormat'), 1, 'cprFormat'),
                {
                    '0': 'even',
                    '1': 'odd'
                }, 'time'
            ),
            cprEncodedPosition: {
                latitude: bitStringToUnsignedIntegerSafeRangeFromBits(structSurfacePosition.get('cprEncodedLatitude'), 17, 'cprEncodedLatitude'),
                longitude: bitStringToUnsignedIntegerSafeRangeFromBits(structSurfacePosition.get('cprEncodedLongitude'), 17, 'cprEncodedLongitude')
            }
        }

        return ret

    } else if((typeCode >= 9 && typeCode <= 18) || (typeCode >= 20 && typeCode <= 22)){
        // airborne position https://mode-s.org/1090mhz/content/ads-b/3-airborne-position.html

        const structAirbornePosition = parseBitStructure(structGeneral.get('rest'), [{
            name: 'surveilanceStatus',
            bits: 2
        }, {
            name: 'singleAntennaFlag',
            bits: 1
        }, {
            name: 'encodedAltitude',
            bits: 12
        }, {
            name: 'time',
            bits: 1
        }, {
            name: 'cprFormat',
            bits: 1
        }, {
            name: 'cprEncodedLatitude',
            bits: 17
        }, {
            name: 'cprEncodedLongitude',
            bits: 17
        }])

        const base: ModeSExtendedSquitterMessage_AirbornePosition_Base = {
            typeCode,
            surveilanceStatus: convertIntegerTo(
                bitStringToUnsignedIntegerSafeRangeFromBits(structAirbornePosition.get('surveilanceStatus'), 2, 'surveilanceStatus'),
                {
                    '0': 'no_condition',
                    '1': 'permanent_alert',
                    '2': 'temporary_alert',
                    '3': 'spi_condition',
                }, 'surveilanceStatus'),
            singleAntennaFlag: convertIntegerTo(
                bitStringToUnsignedIntegerSafeRangeFromBits(structAirbornePosition.get('singleAntennaFlag'), 1, 'singleAntennaFlag'),
                {
                    '0': false,
                    '1': true
                }, 'singleAntennaFlag'),
            time: convertIntegerTo(
                bitStringToUnsignedIntegerSafeRangeFromBits(structAirbornePosition.get('time'), 1, 'time'),
                {
                    '0': false,
                    '1': true
                }, 'time'
            ),
            cprFormat: convertIntegerTo(
                bitStringToUnsignedIntegerSafeRangeFromBits(structAirbornePosition.get('cprFormat'), 1, 'cprFormat'),
                {
                    '0': 'even',
                    '1': 'odd'
                }, 'time'
            ),
            cprEncodedPosition: {
                latitude: bitStringToUnsignedIntegerSafeRangeFromBits(structAirbornePosition.get('cprEncodedLatitude'), 17, 'cprEncodedLatitude'),
                longitude: bitStringToUnsignedIntegerSafeRangeFromBits(structAirbornePosition.get('cprEncodedLongitude'), 17, 'cprEncodedLongitude')
            }
        }


        if(typeCode <= 18){
            // Barometric altitude

            const struct = parseBitStructure(structAirbornePosition.get('encodedAltitude'), [{
                name: 'beforeQbit',
                bits: 7
            }, {
                name: 'qBit',
                bits: 1
            }, {
                name: 'afterQbit',
                bits: 4
            }])

            const qBit = struct.get('qBit') === '1'

            const numb = bitStringToUnsignedIntegerSafeRangeFromBits(struct.get('beforeQbit') + struct.get('afterQbit'), 7 + 4, 'encodedAltitudeWithoutQbit')

            const altitudeInFeetBarometric = qBit ? (25 * numb - 1000) : (decodeGrayCode(numb) * 100)

            const ret = addMissingProperties<ModeSExtendedSquitterMessage_AirbornePosition_Base, ModeSExtendedSquitterMessage_AirbornePosition_AltitudeBarometric>(base, {
                altitudeInFeetBarometric
            })

            return ret
        } else {

            const altitudeInMetersGnss = bitStringToUnsignedIntegerSafeRangeFromBits(structAirbornePosition.get('encodedAltitude'), 12, 'encodedAltitudeAsMetersInGnss')

            const ret = addMissingProperties<ModeSExtendedSquitterMessage_AirbornePosition_Base, ModeSExtendedSquitterMessage_AirbornePosition_AltitudeGnss>(base, {
                altitudeInMetersGnss
            })

            return ret
        }


    } else if(typeCode === 19){
        // airborne velocity see https://mode-s.org/1090mhz/content/ads-b/5-airborne-velocity.html

        //TODO
    } else if(typeCode === 28){
        // aircraft status

        //TODO
    } else if(typeCode === 29){
        // target state and status information

        //TODO
    } else if(typeCode === 31){
        // operation status see https://mode-s.org/1090mhz/content/ads-b/6-operation-status.html

        const structOperationStatus = parseBitStructure(structGeneral.get('rest'), [{
            name: 'subType',
            bits: 3
        }, {
            name: 'capacityClassCodes',
            bits: 16
        }, {
            name: 'operationalModeCodes',
            bits: 16
        }, {
            name: 'adsbVersion',
            bits: 3
        }, {
            name: 'rest',
            bits: 1 + 4 + 2 + 2 + 1 + 1 + 2
        }])

        const adsbVersion = bitStringToUnsignedIntegerSafe(structOperationStatus.get('adsbVersion'), [0, 1, 2], 'adsbVersion')

        if(adsbVersion === 0){
            throw new Error('invalid adsbVersionNumber, version 0 does not send messages')
        } else if(adsbVersion === 1){

            const structOperationStatus_v1 = parseBitStructure(structGeneral.get('rest'), [{
                name: 'subType',
                bits: 3
            }, {
                name: 'capacityClassCodes',
                bits: 16
            }, {
                name: 'operationalModeCodes',
                bits: 16
            }, {
                name: 'adsbVersion',
                bits: 3
            }, {
                name: 'nicSupplement',
                bits: 1
            }, {
                name: 'navigationalAccuracyCategoryPosition',
                bits: 4
            }, {
                name: 'barometricAltitudeQuality_or_reserved',
                bits: 2
            }, {
                name: 'surveilanceIntegrityLevel',
                bits: 2
            }, {
                name: 'barometricAltitudeIntegrity_or_trackAngleOrHeading',
                bits: 2
            }, , {
                name: 'horizontalReferenceDirection',
                bits: 1
            }, {
                name: 'reserved',
                bits: 2
            }])

            const subType = convertIntegerTo<'airborne' | 'surface'>(bitStringToUnsignedIntegerSafeRangeFromBits(structOperationStatus_v1.get('subType'), 3, 'subType'), {
                '0': 'airborne',
                '1': 'surface'
            })

            const base: ModeSExtendedSquitterMessage_OperationStatus_v1_Base = {
                typeCode,
                subType,
                adsbVersion: bitStringToUnsignedIntegerSafeRangeFromBits(structOperationStatus_v1.get('adsbVersion'), 3, 'adsbVersion'),
                operationalMode: bitStringToUnsignedIntegerSafeRangeFromBits(structOperationStatus_v1.get('operationalModeCodes'), 16, 'operationalModeCodes'),
                nicSuplement: convertIntegerTo(bitStringToUnsignedIntegerSafeRangeFromBits(structOperationStatus_v1.get('nicSupplement'), 1, 'nicSuplement'), {
                    '0': false,
                    '1': true
                }),
                navigationalAccuracyCategoryPosition: bitStringToUnsignedIntegerSafeRangeFromBits(structOperationStatus_v1.get('navigationalAccuracyCategoryPosition'), 4, 'navigationalAccuracyCategoryPosition'),

                surveilanceIntegrityLevel: bitStringToUnsignedIntegerSafeRangeFromBits(structOperationStatus_v1.get('surveilanceIntegrityLevel'), 2, 'surveilanceIntegrityLevel'),

                horizontalReferenceDirection: bitStringToUnsignedIntegerSafeRangeFromBits(structOperationStatus_v1.get('horizontalReferenceDirection'), 1, 'horizontalReferenceDirection'),
            }

            if(subType == 'airborne'){

                return addMissingProperties<typeof base, ModeSExtendedSquitterMessage_OperationStatus_v1_Airborne>(base, {
                    airborneCapacityClass: bitStringToUnsignedIntegerSafeRangeFromBits(structOperationStatus_v1.get('capacityClassCodes'), 16, 'capacityClassCodes'),

                    barometricAltitudeQuality: bitStringToUnsignedIntegerSafeRangeFromBits(structOperationStatus_v1.get('barometricAltitudeQuality_or_reserved'), 2, 'barometricAltitudeQuality_or_reserved'),

                    barometricAltitudeIntegrity: bitStringToUnsignedIntegerSafeRangeFromBits(structOperationStatus_v1.get('barometricAltitudeIntegrity_or_trackAngleOrHeading'), 1, 'barometricAltitudeIntegrity_or_trackAngleOrHeading'),
                })

            } else if(subType === 'surface'){

                const structSurfaceCapacityClass = parseBitStructure(structOperationStatus_v1.get('capacityClassCodes'), [{
                    name: 'capacityCode',
                    bits: 12
                }, {
                    name: 'lengthWidthCode',
                    bits: 4
                }])

                return addMissingProperties<typeof base, ModeSExtendedSquitterMessage_OperationStatus_v1_Surface>(base, {
                    surfaceCapacityClass: bitStringToUnsignedIntegerSafeRangeFromBits(structSurfaceCapacityClass.get('capacityCode')
                        , 12, 'capacityCode'),

                    lengthWidthCode: bitStringToUnsignedIntegerSafeRangeFromBits(structSurfaceCapacityClass.get('lengthWidthCode'), 4, 'lengthWidthCode'),

                    trackAngleOrHeading: bitStringToUnsignedIntegerSafeRangeFromBits(structOperationStatus_v1.get('barometricAltitudeIntegrity_or_trackAngleOrHeading'), 1, 'trackAngleHeading'),
                })
            }

        } else if(adsbVersion === 2){
            //TODO
        }

    } else {
        throw Error('invalid typeCode: ' + typeCode)
    }

}

/**
 *
 * @param speed any integer between 0 and 127 (including 0 and 127)
 * @returns
 */
function convertQuantizedGroundSpeed(speed: ComputeRange<128>[number]): {groundSpeedAvailable: boolean, groundSpeedAbove175kt: boolean, groundSpeed: number} {

    // see https://mode-s.org/1090mhz/content/ads-b/4-surface-position.html#tb:adsb-surf-pos-mov

    const quantizations: {from: number, to: number, beginSpeed: number, step: number}[] = [{
        from: 2,
        to: 8,
        beginSpeed: 0.125,
        step: 0.125
    },{
        from: 9,
        to: 12,
        beginSpeed: 1,
        step: 0.25
    },{
        from: 13,
        to: 38,
        beginSpeed: 2,
        step: 0.5
    },{
        from: 39,
        to: 93,
        beginSpeed: 15,
        step: 1
    },{
        from: 94,
        to: 108,
        beginSpeed: 70,
        step: 2
    },{
        from: 109,
        to: 123,
        beginSpeed: 100,
        step: 5
    }]

    const ret = {
        groundSpeedAvailable: true,
        groundSpeedAbove175kt: false,
        groundSpeed: 0
    }

    if(speed === 0){
        ret.groundSpeedAvailable = false
    } else if(speed === 1){
        ret.groundSpeed = 0
    } else if(speed === 124){
        ret.groundSpeedAbove175kt = true
        ret.groundSpeed = 175
    } else if(speed >= 125){
        throw new Error('invalid groundSpeed for quantization: ' + speed)
    } else {
        const quantization = quantizations.find(a => {
            return speed >= a.from && speed <= a.to
        })

        if(!quantization){
            throw new Error('could not find quantization definition for speed: ' + speed)
        }

        ret.groundSpeed = quantization.beginSpeed + (speed - quantization.from) * quantization.step
    }

    return ret
}

function convertIntegerTo<D extends any>(int: number, definitions: {[key: string]: D}, debugLabel?: string){
    if(int > Number.MAX_SAFE_INTEGER || int < Number.MIN_SAFE_INTEGER || Math.floor(int) !== int){
        throw new Error('int is not an integer')
    }

    const intString = '' + int

    if(!Object.hasOwnProperty(intString)){
        throw new Error('int ' + (debugLabel ? debugLabel + ' ' : '') + 'does not fit any definition: ' + int)
    }

    return definitions[intString]
}

type OnlyAdditionalKeys<A extends Record<AK, any>, AK extends string, B extends Record<BK, any>, BK extends string> = Record<Exclude<AK, BK>, any>

type BitStructureDefinition<N extends string> = BitStructureDefinitionEntry<N>[]

type BitStructureDefinitionEntry<N extends string> = {
    name: N
    bits: number // -1 for all remaining bits (only last entry can do that!)
}

type Unboxed<T> = T extends (infer U)[] ? U : T

type BitStructure<N extends string, D extends BitStructureDefinition<N>> = Map<Unboxed<D>['name'], string>

function parseBitStructure<N extends string, D extends BitStructureDefinition<N>, FN extends Unboxed<D>['name'], >(bitString: string, structureDefinition: D): BitStructure<N, D>{

    const ret: BitStructure<N, D> = new Map<FN, string>()

    let currentIndex = 0

    const totalDefinitionMinLength = structureDefinition.map(d => d.bits).filter(b => b >= 0).reduce((prev, cur)=>(prev || 0) + cur)

    if(bitString.length < totalDefinitionMinLength){
        throw new Error('bitString is shorted then structurDefinition requires (' + totalDefinitionMinLength + '): ' + bitString.length)
    }

    for(let i = 0; i < structureDefinition.length; i++){
        const def = structureDefinition[i]

        let nextIndex = currentIndex + def.bits

        if(def.bits === -1){
            if(i < structureDefinition.length - 1){
                throw new Error('only last entry in structureDefinition can set "bits" to -1')
            }

            nextIndex = bitString.length
        }

        const bits = bitString.slice(currentIndex, nextIndex)

        ret.set(def.name, bits)
        currentIndex = nextIndex
    }

    return ret
}

/*
function parseMlatTimestamp(bytes: number[]): BeastMlatTimestamp {

    // format: first 18 bits = seconds of day, next 30 bits: nanoseconds

    // see https://github.com/denzen84/dump1090/blob/master/sdr_beast.c @ void MLATtime_beast()


    const bits = bytesToBitString(bytes)

    const secondsOfDayBits = bits.substring(0, 18)
    const nanoSecondsBits = bits.substring(18)

    const gpsSecondsOfDay = bitStringToInteger(secondsOfDayBits)
    const gpsNanoSecondsOfSecond = bitStringToInteger(nanoSecondsBits)

    //TODO remove this debug code
    const messageNow = new Date('2025-01-29T11:42:00.000Z')

    const nowSecondsOfDay = messageNow.getUTCHours() * 60 * 60 + messageNow.getUTCMinutes() * 60 + messageNow.getUTCSeconds()

    return {
        gpsSecondsOfDay,
        gpsNanoSecondsOfSecond
    }
}*/


/**
 * @see bytesToBitString()
 */
function bytesToBitString(bytes: number[]){
    let str = ''

    bytes.forEach(byte => {
        str += byteToBitString(byte)
    })

    return str
}

/**
 * e.g. (5) => "101"
 */
function byteToBitString(byte: number){
    return (byte >>> 0).toString(2)
}



/**
 * e.g. ("101") => 5
 * @see bitStringToUnsignedIntegerSafe()
 */
function bitStringToUnsignedInteger<N extends number>(bitString: string) : N {
    if(bitString.length > 64){
        throw new Error('bitString exceeds 64 bits (c limit for long integer): ' + bitString.length)
    }

    const bigInt = BigInt('0b' + bitString)

    const ret = BigInt.asUintN(64, bigInt)

    if(ret < Number.MAX_SAFE_INTEGER && ret > Number.MIN_SAFE_INTEGER){
        const numb = parseInt('' + Number(ret).valueOf())

        return numb as N
    } else {
        throw new Error('number is larger than max safe js integer')
    }
}


/**
 * performs a check if resulting number is an allowed value
 * @see bitStringToUnsignedInteger()
 * @see bitStringToUnsignedIntegerSafeRanges()
 */
function bitStringToUnsignedIntegerSafe<N extends number>(bitString: string, allowedValues: N[], debugLabel?: string) : N {

    const numb = bitStringToUnsignedInteger(bitString)

    if(!allowedValues.includes(numb as N)){
        throw new Error('unsignedInteger value is not allowed: ' + numb + (debugLabel ? ' (for "' + debugLabel + '")' : ''))
    }

    return numb as N
}

/**
 *
 * @param bits above 8, correct typescript typing is not supported anymore
 * @returns
 */
function bitStringToUnsignedIntegerSafeRangeFromBits<B extends number, N =
    B extends 1 ? ComputeRange<2>[number] :
    B extends 2 ? ComputeRange<4>[number] :
    B extends 3 ? ComputeRange<8>[number] :
    B extends 4 ? ComputeRange<16>[number] :
    B extends 5 ? ComputeRange<32>[number] :
    B extends 6 ? ComputeRange<64>[number] :
    B extends 7 ? ComputeRange<128>[number] :
    B extends 8 ? ComputeRange<256>[number] :
    number>(bitString: string, bits: B, debugLabel?: string){

    const numb = bitStringToUnsignedIntegerSafeRanges(bitString, [[0, (2 ** bits) - 1]], debugLabel)

    return numb as N
}

/**
 * performs a check if resulting number is an allowed value
 * @param allowedRanges e.g. [[from, to], [from, to]]
 * @see bitStringToUnsignedInteger()
 * @see bitStringToUnsignedIntegerSafe()
 */
function bitStringToUnsignedIntegerSafeRanges(bitString: string, allowedRanges: [number, number][], debugLabel?: string){

    const numb = bitStringToUnsignedInteger(bitString)

    for(const range of allowedRanges){
        if(numb >= range[0] && numb <= range[1]){
            return numb
        }
    }

    throw new Error('unsignedInteger value is not allowed: ' + numb + (debugLabel ? ' (for "' + debugLabel + '")' : ''))

    return numb
}






const line1 = Buffer.from("GjEAAAAAAAAAAAAaMQAAAAAAAAAAABoxAAAAAAAAAAAAGjEAAAAAAAAAAAAaMQAAAAAAAAAAAA==", 'base64')
//const bin = bytesToBitString(line1)

const line1Frames = parseBeastLine(line1)


// this message has been recorded at roughly new Date('2025-01-29T11:42:00.000Z') which should result in gps seconds of day: 42138 and gps day of year 31
const line2 = Buffer.from("GjP/AE1MQWAfjUQGjljTAG7X1ZSaUHwaM/8ATUxBYA2NRAAcWLFxPQWSzm05yRoz/wBNTEFgDY1EAByZCBw6MByhwLV0GjP/AE1MQWAbjahVPFjJA4s27cSLYRcaM/8ATUxBYAqNQH/KmRSrAlg4heuZ2hoy/wBNTEFgDAAFAj2cAtQaMv8ATUxBYAxdRAGq0ejDGjP/AE1MQWASjatyaOEQswAAAABvknUaM/8ATUxBYNWoAAu8/75lGb/sbHKjUhoz/wBNTEFgDKAAFxj/2JMyIATiDxg0GjP/AE1MQWA3jUQGBFi99ZGJprOJ9KsaM/8ATUxBYB2NTSJvYLUFSyiYLjcXWBoz/wBNTEFgDo1LGALhE5cAAAAAE8lcGjP/AE1MQWALjUyt5Vi5h5HSR8dwjWkaM/8ATUxBYBiNCgCQIxASMsMtoHCsfRoz/wBNTEFgUI00MoKZlJmMAFgLp1D4GjP/AE1MQWBlqAARG+W6NS+/3AEQbVsaM/8ATUxBYBiNCgCQ+CEAAgBJuBZ7fhoz/wBNTEFgPqgAAQr/+60bYCR71Boaihoz/wBNTEFgFY1MrfkjSZS504Dg2XToGjP/AE1MQWBCjegEaPghAAIASbwBa6waM/8ATUxBYFCoABQT1WnvL//H/mNZDBoz/wBNTEFgTo2sb1eZDUCfYAyI2WuSGjP/AE1MQWBPoAAXn4AaGlcvv/zXhw5SGjP/AE1MQWBEjUvISVi99vJoG5754bEaM/8ATUxBYBuNS7IE+CMAAgBJuPGGaBoz/wBNTEFgII2nPdPhGhoFAAAAAOY/Yhoz/wBNTEFgaY2ml8+ZDKiW6ASWyhoa4hoz/wBNTEFgEo2nPdNYR0YVwMJTxRneGjP/AE1MQWAUjaqyv1jBYXaKQoDUXTwaMv8ATUxBYAsgABQgGX/zGjP/AE1MQWD5jafbC1hFYH0Ha2LIiQgaM/8ATUxBYO2Np9sLmQk0HMCwExBxWxoz/wBNTEFgd42iBBVZYgRQZznFqNMPGjP/AE1MQWAVoAAXsIM58TAgLAC5OOoaM/8ATUxBYBaNRABQWL8CT7dSKqk4CBoz/wBNTEFgFqgAEKKAMPs9YATaXWkVGjP/AE1MQWASjU0kIFhFtHOzuSxuSGMaM/8ATUxBYBKNTSQg+CMAAwBJuNPktRoy/wBNTEFgCl1EADcnvwgaM/8ATUxBYBiNdYJM4QGNAAAAADzpJxoz/wBNTEFg0411hyOZCIcOOCwMtbGKGjP/AE1MQWAbjXWCTFhB5P2Ybh0uoHsaM/8ATUxBYD2NdYJMmQxkqphoJ96kZRoz/wBNTEFgU4+m7rkjKJB1w2ygWBa0GjP/AE1MQWCbjaYVkiNUEzPnHGCyQKEaMv8ATUxBYGJfpu65pqJEGjP/AE1MQWAVjay6MFihBNgeaHEgcBkaM/8ATUxBYCWNp7ihmQxan0C4lZv6ahoz/wBNTEFgB4055KwjBGSz3QIg2S2RGjP/AE1MQWAMoAAVue3KGzCgJACYvgQaM/8ATUxBYBONcGBXWLmHmsEiKqLsiBoz/wBNTEFgFo1GktpYqfdUBamihFIXGjP/AE1MQWAtjTnkrFihJ8KzF6KS2/8=", 'base64')

const line2Frames = parseBeastLine(line2)

for(const frame of line2Frames){
    parseBeastFrame(frame)
}


console.log('bye')
