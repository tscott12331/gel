package main

import (
	"chatter-wails/services/eventsub"
	"chatter-wails/shared/types"
	"embed"
	"fmt"
	"log"

	"github.com/wailsapp/wails/v3/pkg/application"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	// Register events
	application.RegisterEvent[*eventsub.ESChatMessage]("gel:chat-message")
	application.RegisterEvent[eventsub.StreamData]("gel:stream-data")
	application.RegisterEvent[eventsub.ChatOpenData]("gel:chat-open")
	application.RegisterEvent[*types.AppUser]("gel:user-login")
	application.RegisterEvent[eventsub.SharedChatBeginEventData]("gel:shared-chat-begin")
	application.RegisterEvent[eventsub.SharedChatUpdateEventData]("gel:shared-chat-update")
	application.RegisterEvent[eventsub.SharedChatEndEventData]("gel:shared-chat-end")
	application.RegisterEvent[eventsub.BanEventData]("gel:ban")
	application.RegisterEvent[eventsub.ClearMsgEventData]("gel:clear-msg")
	application.RegisterEvent[types.NewEmoteSetEvent]("gel:emote:new-set")
	application.RegisterEvent[types.EmptyEvent]("gel:new-tab")
	application.RegisterEvent[types.SwitchTabNextEvent]("gel:switch-tab-next")

	// Create an instance of the app structure
	// Create application with options
	app := application.New(application.Options{
		Name: "Gel",
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		PanicHandler: func(panicDetails *application.PanicDetails) {
			application.Get().Dialog.Error().
				SetTitle("Gel crashed").
				SetMessage(fmt.Sprintf("%+v\n\nStack Trace:\n%s",
					panicDetails.Error,
					panicDetails.FullStackTrace)).
				Show()
		},
	})

	appServiceRaw := NewAppService(app)

	appService := application.NewService(appServiceRaw)
	esService := application.NewService(appServiceRaw.esService)
	emoteService := application.NewService(appServiceRaw.emoteService)
	badgeService := application.NewService(appServiceRaw.badgeService)
	authService := application.NewService(appServiceRaw.authService)
	seventvService := application.NewService(appServiceRaw.seventvService)
	bttvService := application.NewService(appServiceRaw.bttvService)
	ffzService := application.NewService(appServiceRaw.ffzService)

	app.RegisterService(appService)
	app.RegisterService(esService)
	app.RegisterService(emoteService)
	app.RegisterService(badgeService)
	app.RegisterService(authService)
	app.RegisterService(seventvService)
	app.RegisterService(bttvService)
	app.RegisterService(ffzService)


	app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:  "gel",
		Width:  1024,
		Height: 768,
		Frameless: true,
		BackgroundColour: application.NewRGBA(27, 38, 54, 1),
		BackgroundType: application.BackgroundTypeSolid,
	})

	// Keybindings
	app.KeyBinding.Add("Ctrl+T", func(window application.Window) {
		window.EmitEvent("gel:new-tab", types.EVENT_NOOP)
	})
	app.KeyBinding.Add("Ctrl+N", func(window application.Window) {
		log.Printf("forward switch")
		window.EmitEvent("gel:switch-tab-next", types.SwitchTabNextEvent{
			Forward: true,
		})
	})
	app.KeyBinding.Add("Ctrl+Shift+N", func(window application.Window) {
		log.Printf("reverse switch")
		window.EmitEvent("gel:switch-tab-next", types.SwitchTabNextEvent{
			Forward: false,
		})
	})

	err := app.Run()

	if err != nil {
		println("ERROR:", err.Error())
	}
}
