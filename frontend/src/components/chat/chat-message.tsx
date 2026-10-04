import { TooltipContext } from '@/contexts/tooltip-context';
import { IAppChatMessage } from '@/hooks/chat';
import ReplyIcon from '@components/svg/reply-icon';
import { AppEmote } from '@wailsjs/chatter-wails/shared/types';
import { AppChatMessageFragment } from '@wailsjs/chatter-wails/services/eventsub';
import React, { useContext } from 'react';
import Emote from './emote';
import Anchor from '../util/anchor';

export interface IChatMessageFragment {
    type: 'text'|'cheermote'|'emote'|'mention';
    text: string;
    cheermote: {
        prefix: string;
        bits: number;
        tier: number;
    }|null;
    emote: AppEmote|null;
    mention: {
        user_id: string;
        user_name: string;
        user_login: string;
    }|null;
}

export interface IMessageBadge {
    srcSet: string;
    info: string;
    title: string;
}

export interface IMessageReply {
    parent_message_body: string;
    parent_message_id: string;
    parent_user_id: string;
    parent_user_login: string;
    parent_user_name: string;
    thread_message_id: string;
    thread_user_id: string;
    thread_user_login: string;
    thread_user_name: string;
}

interface ChatMessageProps {
    message: IAppChatMessage;
    onChatReplyClick?: (message: IAppChatMessage) => void;
    showChatReplyButton?: boolean;
    getChatterColor: (username: string) => string;
    showUserPopup: (username: string|undefined, mouseX: number, mouseY: number) => void;
}

const LINK_RE: RegExp = /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,63}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)/g;

export default function ChatMessage({
    message,
    onChatReplyClick=() => {},
    showChatReplyButton=true,
    getChatterColor,
    showUserPopup,
}: ChatMessageProps) {
    const { tooltipOnPartial, tooltipOff } = useContext(TooltipContext);

    const fragmentToNode = (fragment: AppChatMessageFragment, index: number): React.ReactNode => {
        switch(fragment.type) {
            case 'emote':
                if(!fragment.emote) return fragment.text;

                return (
                    <span 
                        className="inline-block align-middle h-[2em] [content-visibility:auto] [contain-intrinsic-size:auto_2em]"
                        key={index}
                    >
                        <Emote 
                            emote={fragment.emote} 
                            tooltipOnPartial={tooltipOnPartial}
                            tooltipOff={tooltipOff}
                        />
                    </span>
                );
            case 'mention':
                if(!fragment.mention) return fragment.text;
                return (
                    <span
                        style={{
                            color: getChatterColor(fragment.mention.user_name),
                        }}
                        onClick={(e: React.MouseEvent<HTMLSpanElement>) =>
                                showUserPopup(fragment.mention?.user_name, e.pageX, e.pageY)}
                        className="cursor-pointer"
                        key={index}
                    >{fragment.text}</span>
                );
            case 'text':
                const allMatches = fragment.text.matchAll(LINK_RE).toArray();
                const nodes: React.ReactNode[] = [];
                // txt then link
                let lastLinkEnd = 0;
                for(let i = 0; i < allMatches.length; i++) {
                    const linkMatch = allMatches[i];
                    const link = linkMatch[0];

                    const linkStart = linkMatch.index;
                    if(linkStart - lastLinkEnd > 0) {
                        nodes.push(<span key={`${index}-${i}t`}>{fragment.text.slice(lastLinkEnd, linkStart)}</span>);
                    }

                    nodes.push(<span key={`${index}-${i}l`}><Anchor href={link}>{link}</Anchor></span>)
                    
                    lastLinkEnd = linkMatch.index+link.length;
                }

                if(lastLinkEnd < fragment.text.length) {
                    nodes.push(<span key={`${index}-${allMatches.length}t`}>{fragment.text.slice(lastLinkEnd)}</span>);
                }

                return nodes;
            default:
                return fragment.text;
        }
    }

    const defragmentMessage = (fragments: (AppChatMessageFragment|null)[]): React.ReactNode => {
        return fragments.map((fragment, i) => fragment && fragmentToNode(fragment, i));
    }

    const badgeToNode = (badge: IMessageBadge, index: number): React.ReactNode => {
        return <img 
                    className="inline mr-1 size-4"
                    srcSet={badge.srcSet}
                    onMouseEnter={e => tooltipOnPartial({
                            type: "image",
                            imageSrcSet: badge.srcSet,
                            imageDesc: badge.title,
                    }, badge.title, e.currentTarget)}
                    onMouseLeave={() => tooltipOff(badge.title)}
                    key={index} 
                />
    }

    const badgesToNodes = (badges: IMessageBadge[]): React.ReactNode => {
        return badges.map((badge, i) =>
            badgeToNode(badge, i)
        );
    }

    return (
        // TODO: (maybe make content visibility stuff optional?)
        <div className={`p-1.5 relative hover:bg-chatter-surface hover:[&_.chat-controls]:visible ${message.deleted && 'line-through hover:no-underline'}`}>
            {message.reply &&
            <p 
                className='w-full text-chatter-text-tertiary text-sm ellipsis'
                onMouseEnter={e =>
                    tooltipOnPartial({
                        type: "text",
                        text: message.reply?.parent_message_body ?? "",
                    }, message.id + message.reply?.parent_message_id, e.currentTarget)
                }
                onMouseLeave={() => tooltipOff(message.id + message.reply?.parent_message_id)}
            >replying to @{message.reply.parent_user_name}: {message.reply.parent_message_body}
            </p>
            }
            <div>
                {message.badges && badgesToNodes(message.badges)}
                <span
                    className="contrast-300 font-medium my-0 mr-0.5 cursor-pointer"
                    style={{
                        color: message.color
                    }}
                    onClick={(e: React.MouseEvent<HTMLSpanElement>) => showUserPopup(message.username, e.pageX, e.pageY)}
                >
                    {message.username}
                </span>
                <span>: </span>
                {message.fragments && defragmentMessage(message.fragments)}
            </div>
            <div
                className='chat-controls absolute -top-1 right-5 invisible flex justify-end items-center'
            >
                {showChatReplyButton &&
                <div className="w-6 h-6 p-1 rounded-xs bg-chatter-surface-elevated/80 backdrop-blur-xs contrast-100 hover:outline hover:outline-chatter-border-strong hover:contrast-200 hover:brightness-120 [&_svg]:fill-chatter-text-primary [&_svg]:contrast-200 cursor-pointer"
                    onClick={() => onChatReplyClick(message)}
                >
                    <ReplyIcon className="size-full" />
                </div>
                }
            </div>
            {(message.banInfo.isBanned || message.deleted) &&
            <>
            <div className="absolute inset-0 bg-chatter-bg/30 pointer-events-none">
            </div>
            <p className="text-right text-chatter-text-tertiary pe-2">
                {
                message.banInfo.isBanned
                ? message.banInfo.banTypeInfo.isPermanent
                    ? "permanently banned"
                    : `timed out (${message.banInfo.banTypeInfo.duration}s)`
                : 'deleted'
                }
            </p>
            </>
            }
        </div>
    )
}
