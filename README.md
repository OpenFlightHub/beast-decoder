# Beast Decoder
Parses messages coming from a BEAST TCP port. For example out.adsb.lol:1337 [adsb.lol](https://www.adsb.lol/docs/overview/introduction/)

**Currently supported:**
* Mode S
* ADSB (ModeS Extended Squitter)
* DEBUG

**Not yet supported:**
* Mode AC

## Usage

[install via npm](https://www.npmjs.com/package/beast-decoder):
```
npm i --save beast-decoder
```


```typescript

import { parseADSB, ADSB_ParsedMessage, parseModeS, ModeS_ParsedMessage } from 'beast-decoder'
import net from 'net'

const socket: new net.Socket()
socket.connect({
    port: 1337,
    host: 'out.adsb.lol',
    family: 4 // force ipv4
})

socket.on('data', data =>{

    const frames = parseBeastSocketData(data)

    for(const frame of frames){
        if(frame.format === 'ADSB'){

            // parsing does minimal work and just makes sure the structure is correct
            const parsedAdsbMessage = parseADSB(frame.dataBytes)

            // decoding only location, to keep required work small
            const decodedLocation = decodeLocation(parsedAdsbMessage)

            // if location is in our area of interest, decode the full message (into a human readable, descriptive format that uses real world units)
            const fullyDecoded = decode(parsedAdsbMessage, decodedLocation) // we can supply the already decoded location to minimize the work
        }
    }
})
```

## Dependencies
* none

## Changelog

see [CHANGELOG.md](CHANGELOG.md)

# For Developers

see [DEV.md](DEV.md)
