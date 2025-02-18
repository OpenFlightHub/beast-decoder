import EventManager from "./util/event_manager";
import {BeastParsedFrame, BeastParsedFrameType, parseBeastSocketData} from './parse'
import { decodeBasics, parseADSB, parseModeS, calculateUnambigiousLocation, CprData } from "mode-s-adsb-parser";

export type AircraftData = {
    icaoAddress: AircraftIcaoAddress
}

export interface AircraftDataWithLocation extends AircraftData {
    location: {
        //TODO
    }
}

export type BeastHandlerEvents = {
    'aircraft': AircraftData
    'aircraft_with_location': AircraftDataWithLocation
    'warning': {message: string, context: any}
    'removed_from_cache': AircraftIcaoAddress
}

type AircraftIcaoAddress = string

type EncodedCprData = {
    receivedTime: number
    cpr: CprData
}

type AircraftCacheData = {
    lastDataReceivedTime: number
    lastUnambigiousLocation?: {
        latitude: number
        longitude: number
    }
    lastEncodedLocationOdd?: EncodedCprData
    lastEncodedLocationEven?: EncodedCprData
}

const MAX_AIRCRAFT_CACHE_TIME = 1000 * 60 * 30 // 30 minutes

export default class BeastHandler extends EventManager<BeastHandlerEvents> {

    private readonly aircraftCache = new Map<AircraftIcaoAddress, AircraftCacheData>()

    constructor(){
        super()

        setInterval(()=>{
            this.cleanUpCache()
        }, 1000 * 30)
    }

    //TODO rewrite to be non-blocking
    private cleanUpCache(){

        const now = Date.now()

        for(const aircraftEntry of this.aircraftCache){
            const aircraft = aircraftEntry[1]

            if(now - aircraft.lastDataReceivedTime > MAX_AIRCRAFT_CACHE_TIME){
                const icaoAddress = aircraftEntry[0]
                this.aircraftCache.delete(icaoAddress)

                this.dispatch('removed_from_cache', icaoAddress)
            }
        }
    }


    handleBeastData(data: Buffer<ArrayBufferLike>){
        const frames = parseBeastSocketData(data, true)

        for(const frame of frames){
            this.handleBeastFrame(frame)
        }
    }

    private handleBeastFrame(frame: BeastParsedFrame<BeastParsedFrameType>){
        if(frame.type === 'ADSB'){
            try {
                const parsedModeS = parseModeS(frame.dataBytes)
                const parsedADSB = parseADSB(parsedModeS)

                const myIcaoAddressHex = icaoNumberToHex(parsedModeS.icaoAddress)

                const aircraft: AircraftCacheData = this.aircraftCache.get(myIcaoAddressHex) || {
                    lastDataReceivedTime: Date.now()
                }

                this.aircraftCache.set(myIcaoAddressHex, aircraft)

                const decodedBasics = decodeBasics(parsedADSB)

                if(decodedBasics.locationInformation.locationAvailable){
                    if(decodedBasics.locationInformation.location.format === 'even'){
                        aircraft.lastEncodedLocationEven = {
                            receivedTime: Date.now(),//TODO shouldnt we use mlatTimestamp for this?
                            cpr: decodedBasics.locationInformation.location
                        }
                    } else {
                        aircraft.lastEncodedLocationOdd = {
                            receivedTime: Date.now(),//TODO shouldnt we use mlatTimestamp for this?
                            cpr: decodedBasics.locationInformation.location
                        }
                    }
                }

                if(aircraft.lastEncodedLocationEven && aircraft.lastEncodedLocationOdd){
                    if(Math.abs(aircraft.lastEncodedLocationEven.receivedTime - aircraft.lastEncodedLocationOdd.receivedTime) < 1000 * 60 * 2){// 2 minutes

                        const olderMessage = aircraft.lastEncodedLocationEven.receivedTime < aircraft.lastEncodedLocationOdd.receivedTime ? aircraft.lastEncodedLocationEven.cpr : aircraft.lastEncodedLocationOdd.cpr

                        const moreRecentMessage = aircraft.lastEncodedLocationEven.receivedTime < aircraft.lastEncodedLocationOdd.receivedTime ? aircraft.lastEncodedLocationOdd.cpr : aircraft.lastEncodedLocationEven.cpr

                        const unambigiousLocation = calculateUnambigiousLocation([olderMessage, moreRecentMessage])

                        aircraft.lastUnambigiousLocation = unambigiousLocation

                        this.dispatch('aircraft_with_location', {
                            icaoAddress: myIcaoAddressHex,
                            location: unambigiousLocation
                        })
                    }
                }

                if(!aircraft.lastUnambigiousLocation){
                    this.dispatch('aircraft', {
                        icaoAddress: myIcaoAddressHex
                    })
                }

            } catch (err){
                this.dispatch('warning', {
                    message: 'Failed to decode adsb frame',
                    context: err
                })
            }
        } else if(frame.type === 'MODE_S') {
            try {
                const parsedModeS = parseModeS(frame.dataBytes)

                const myIcaoAddressHex = icaoNumberToHex(parsedModeS.icaoAddress)

                const aircraft: AircraftCacheData = this.aircraftCache.get(myIcaoAddressHex) || {
                    lastDataReceivedTime: Date.now()
                }

                this.aircraftCache.set(myIcaoAddressHex, aircraft)
                this.dispatch('aircraft', {
                    icaoAddress: myIcaoAddressHex
                })

            } catch (err){
                this.dispatch('warning', {
                    message: 'Failed to decode mode s frame',
                    context: err
                })
            }
        } else {
            this.dispatch('warning', {
                message: 'Unsupported frame type',
                context: frame.type
            })
        }
    }

}

function icaoNumberToHex(n: number){
    return n.toString(16)
}
