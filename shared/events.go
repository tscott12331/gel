package shared

import (
	"chatter-wails/shared/types"

	"github.com/wailsapp/wails/v3/pkg/application"
)

func EmitNewSet(app *application.App, set *types.AppEmoteSet, channelSpecific bool, broadcasterId string) {
	app.Event.Emit("gel:emote:new-set", types.NewEmoteSetEvent{
		BroadcasterId: broadcasterId,
		ChannelSpecific: channelSpecific,
		AppEmoteSet:   *set,
	})
}
