import { IChatroomEmotes } from "@/api/emote";

import { ConnectToChatroom, SendChatMessage } from '@wailsjs/chatter-wails/appservice';
import { RequestSevenTVEmotes } from "@wailsjs/chatter-wails/services/7tv/seventvservice";
import { RequestTwitchEmotes } from "@wailsjs/chatter-wails/services/native/emoteservice";
import { Events } from "@wailsio/runtime";

import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppEmoteSet, AppUser } from "@wailsjs/chatter-wails/shared/types";
import { ESChatMessage, StreamData } from "@wailsjs/chatter-wails/services/eventsub";
import { assertDefined, isDefined } from "@/util/assert";
import { GlobalContext } from "@/contexts/global-context";
import { RequestBTTVEmotes } from "@wailsjs/chatter-wails/services/bttv/bttvservice";
import { RequestFFZEmotes } from "@wailsjs/chatter-wails/services/ffz/ffzservice";

export type TBanTypeInfo = 
    | {
        isPermanent: false,
        duration: number
      }
    | {
        isPermanent: true,
      }

export type TBanInfo = 
    | {
        isBanned: true,
        banTypeInfo: TBanTypeInfo,
      }
    | {
        isBanned: false,
      }

export interface IAppChatMessage extends ESChatMessage {
    banInfo: TBanInfo;
    deleted: boolean;
}

interface IMessageBuffer {
    messages: IAppChatMessage[];

    // set of message id's that were deleted
    deletions: Set<string>;
    bans: Map<string, TBanInfo>
}


export default function useChat({ channel, user, maxMessages = 200 }: {
    channel: string|undefined,
    user: AppUser,
    maxMessages?: number,
}) {
    const MESSAGE_BATCH_RATE = 250;

    const [chatMessages, setChatMessages] = useState<IAppChatMessage[]>([]);
    const messageBuffer = useRef<IMessageBuffer>({messages:[], deletions: new Set(), bans: new Map()});

    const [emotes, setEmotes] = useState<IChatroomEmotes>({providers: new Map(), _hash: 0});
    const [streamData, setStreamData] = useState<StreamData>({channel: "", live: false, viewCount: 0, title: "", gameName: "" });
    const [broadcasterId, setBroadcasterId] = useState<string>("");

    const { broadcastError } = useContext(GlobalContext);
    

    const appendMessageBuffer = () => {
        const { messages, deletions, bans } = messageBuffer.current;
        if(messages.length === 0 && deletions.size === 0 && bans.size === 0) return;

        // copy buffer data and clear immediately to avoid data loss on future batches
        const bufferedMessages = [...messages];
        const bufferedDeletions = new Set(deletions);
        const bufferedBans = new Map(bans);

        messageBuffer.current.messages = [];
        messageBuffer.current.deletions.clear();
        messageBuffer.current.bans.clear();

        setChatMessages(cm => {
            const newMessages = [...cm, ...bufferedMessages];
            const numExtraMessages = newMessages.length - maxMessages;

            if(numExtraMessages >= 0) {
                newMessages.splice(0, numExtraMessages);
            }

            for(let i = 0; i < newMessages.length; i++) {
                if(bufferedDeletions.has(newMessages[i].id)) {
                    newMessages[i] = { ...newMessages[i], deleted: true };
                }

                const banInfo = bufferedBans.get(newMessages[i].username.toLowerCase());
                if(isDefined(banInfo)) {
                    newMessages[i] = { ...newMessages[i], banInfo };
                }
            }

            return newMessages;
        });
    }

    const appendChatMessageToBuffer = (message: ESChatMessage) => {
        const appMessage: IAppChatMessage = {
            ...message,
            banInfo: { isBanned: false },
            deleted: false,
        }

        messageBuffer.current.messages.push(appMessage);
    }

    const handleChatMessageEvent = (event: Events.WailsEvent<"gel:chat-message">) => {
        if(event.data?.channel && channel === event.data.channel) {
            appendChatMessageToBuffer(event.data);
        }
    }

    const handleBanEvent = (event: Events.WailsEvent<"gel:ban">) => {
        if(event.data.channel !== channel) return;

        const banTypeInfo: TBanTypeInfo = event.data.isPermanent
        ? {
            isPermanent: true,
          }
        : {
            isPermanent: false,
            duration: event.data.duration ?? 0,
          }
        const banInfo: TBanInfo = {
            isBanned: true,
            banTypeInfo,
        }

        messageBuffer.current.bans.set(event.data.userLogin, banInfo);
    }

    const handleClearMsgEvent = (event: Events.WailsEvent<"gel:clear-msg">) => {
        if(event.data.channel !== channel) return;

        messageBuffer.current.deletions.add(event.data.messageID);
    }

    const handleNewSetEvent = (event: Events.WailsEvent<"gel:emote:new-set">, broadcasterId: string) => {
        if(event.data.ChannelSpecific && event.data.BroadcasterId !== broadcasterId) return;

        addEmoteSet(event.data);
    }

    const sendChatMessage = useCallback(async (message: string, replyId: string|null|undefined) => {
        if(!channel) return false;
        const trimmed = message.trim();
        if(trimmed.length === 0) return false;

        try {
            await SendChatMessage(channel, trimmed, replyId ?? null);
            return true;
        } catch(err) {
            broadcastError(err);
            return false;
        }
    }, [channel, broadcastError]);
    
    const addEmoteSet = (set: AppEmoteSet) => {
        // merge with provider, override section if necessary
        setEmotes(curEmotes => {
            if(!isDefined(set.Emotes)) return curEmotes;
            
            // copy existing provider map or create new one if not present
            const curProviderMap = curEmotes.providers.get(set.Provider);
            const providerMap = isDefined(curProviderMap)
                                ? new Map(curProviderMap)
                                : new Map<string, AppEmoteSet>();

            providerMap.set(set.Section, set);
            

            const newEmotes: IChatroomEmotes = {
                providers: new Map(curEmotes.providers),
                _hash: curEmotes._hash+1,
            };
            newEmotes.providers.set(set.Provider, providerMap);

            return newEmotes;
        });
    }

    const emitChatOpenState = (channel: string, accessToken: string, open: boolean) => {
        Events.Emit('gel:chat-open', {
            channel,
            accessToken,
            open,
        });
    }

    const listenersOn = (broadcasterId: string) => {
        const offFns: (() => void)[] = [
            Events.On('gel:chat-message', handleChatMessageEvent),
            Events.On('gel:stream-data', (e) => setStreamData(e.data)),
            Events.On('gel:ban', handleBanEvent),
            Events.On('gel:clear-msg', handleClearMsgEvent),
            Events.On('gel:emote:new-set', (e) => handleNewSetEvent(e, broadcasterId))
        ];

        const interval = setInterval(() => {
            appendMessageBuffer();
        }, MESSAGE_BATCH_RATE);

        return () => {
            offFns.forEach(fn => fn());
            clearInterval(interval);
        }
    }

    useEffect(() => {
        if(!channel) return;
        const abortController = new AbortController();

        setChatMessages([]);
        setEmotes({providers: new Map(), _hash: 0});

        ConnectToChatroom(channel)
            .then(d => {
                emitChatOpenState(channel, user.access_token, true)

                assertDefined(d);
                setBroadcasterId(d?.broadcasterId);
            })
            .cancelOn(abortController.signal)
            .catch(broadcastError);

        return () => {
            abortController.abort("Channel/user changed");
            emitChatOpenState(channel, user.access_token, false);
        }
    }, [channel, user]);

    useEffect(() => {
        if(broadcasterId.length === 0) return;

        // TODO: make optional?
        RequestSevenTVEmotes(broadcasterId).catch(broadcastError);
        RequestBTTVEmotes(broadcasterId).catch(broadcastError);
        RequestFFZEmotes(broadcasterId).catch(broadcastError);
        RequestTwitchEmotes(broadcasterId).catch(broadcastError);

        const listenersOff = listenersOn(broadcasterId);
        
        return () => {
            listenersOff();
        }
    }, [broadcasterId])

    return { chatMessages, sendChatMessage, emotes, streamData }
}
