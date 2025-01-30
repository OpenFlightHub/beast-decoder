# ADSB ModeS Beast Parser
Parses messages coming from a BEAST TCP port. For example out.adsb.lol:1337 [adsb.lol](https://www.adsb.lol/docs/overview/introduction/)

### Dependencies
* none

## Usage

[install via npm](https://www.npmjs.com/package/beast-decoder):
```
npm i --save beast-decoder
```


```typescript
TODO

// parsing does minimal work and just makes sure the structure is correct
parse()

// decodeLocation will only decode the location part of the message (so you can tell wether this is an interesting packet for you, and you want to fully decode it)
decodeLocation()


// fully decodes the message into values that is human readable, self explanatory and uses real world units
decode()
```

## Changelog

see [CHANGELOG.md](CHANGELOG.md)

# For Developers

see [DEV.md](DEV.md)
