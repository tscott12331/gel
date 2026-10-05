package types

type NewEmoteSetEvent struct{
	BroadcasterId string
	ChannelSpecific bool
	AppEmoteSet
}

type EmptyEvent any
const EVENT_NOOP = -1


type SwitchTabNextEvent struct{
	Forward bool
}
