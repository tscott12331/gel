import { useContext, useEffect, useRef, useState } from 'react';
import Tab from './tab';
import PlusIcon from '../svg/plus-icon';
import { useNavigate } from 'react-router-dom';
import { Events } from "@wailsio/runtime";
import { SharedChatParticipant } from '@wailsjs/chatter-wails/services/eventsub';
import SearchIcon from '../svg/search-icon';
import { createTab, createTabRoute, FIXED_TAB_COUNT, TabContext, TTab } from '@/contexts/tab-context';
import GelIcon from '../svg/gel-icon';
import { WINDOW_CONTROLS_HEIGHT } from '../window/window-controls';

export const TAB_MANAGER_HEIGHT = 36;

interface ITabManagerProps {

}

export default function TabManager({

}: ITabManagerProps) {
    const tabsRef = useRef<Record<string, {current: HTMLDivElement|null}>>({})

    const [isAddingTab, setIsAddingTab] = useState<boolean>(false);
    const [newTabText, setNewTabText] = useState<string>("");

    const { homeTab: home, searchTab, tabs, curTab, selectTab, addTab, removeTab, editTab, rotateTabs } = useContext(TabContext)

    const navigate = useNavigate();

    const handleTabSelect = (tab: TTab) => {
        selectTab(tab);
    }

    const handleAddTab = (tab: TTab) => {
        addTab(tab);
    }

    const handleTabRemove = (tab: TTab) => {
        removeTab(tab);
        delete tabsRef.current[tab.tabRoute];
    }

    const addParticipantsToTabName = (channel: string, participants: Record<string, SharedChatParticipant|null|undefined>) => {
        const eventRoute = createTabRoute(channel);
        const tabToChangeIndex = tabs.findIndex(t => t.tabRoute === eventRoute);
        editTab(tabToChangeIndex, (tab) => ({
            ...tab,
            tabName: Object.values(participants)
                        .map(p => p?.name ?? "unknown")
                        .reduce((p, c) => `${p}, ${c}`),
        }));
    }

    const handleSharedChatBegin = (event: Events.WailsEvent<"gel:shared-chat-begin">) => {
        if(!event.data.participant) return tabs;
        addParticipantsToTabName(event.data.channel, event.data.participant);
    }

    const handleSharedChatUpdate = (event: Events.WailsEvent<"gel:shared-chat-update">) => {
        if(!event.data.participant) return tabs;
        addParticipantsToTabName(event.data.channel, event.data.participant);
    }

    const handleSharedChatEnd = (event: Events.WailsEvent<"gel:shared-chat-end">) => {
        const eventRoute = createTabRoute(event.data.channel);
        const tabToChangeIndex = tabs.findIndex(t => t.tabRoute === eventRoute);
        editTab(tabToChangeIndex, (tab) => ({
            ...tab,
            tabName: event.data.channel,
        }));
    }

    const handleAddTabKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if(e.key === 'Enter') {
            const tabName = newTabText.trim();
            if(!tabName.includes(' ') && tabName.length >= 3
               && tabName.length <= 25) {
                   const newTab = createTab(tabName);

                   handleAddTab(newTab);
                   setIsAddingTab(false);
                   setNewTabText('');
                   e.currentTarget.value = '';
               }
        }
    }

    const handleTabPlace = (movedTabIndex: number) => {
        const movedTab = tabs[movedTabIndex];
        const movedTabElement = tabsRef.current[movedTab.tabRoute].current;
        if(!movedTabElement) return;
        const movedTabRect = movedTabElement.getBoundingClientRect()

        let furthestPassedIndex = FIXED_TAB_COUNT-1;
        for(let i = FIXED_TAB_COUNT; i < tabs.length; i++) {
            const tab = tabs[i];
            const tabElement = tabsRef.current[tab.tabRoute];
            if(!tabElement.current) continue;

            const tabRect = tabElement.current.getBoundingClientRect();
            
            if(movedTabRect.x < tabRect.x) break;

            furthestPassedIndex = i;
        }

        if(furthestPassedIndex === movedTabIndex) return;

        let leftIndex: number = 0;
        let rightIndex: number = 0;
        let dir: 'left'|'right' = 'left';
        if(movedTabIndex > furthestPassedIndex) {
            leftIndex = Math.min(furthestPassedIndex + 1, tabs.length - 1);
            rightIndex = movedTabIndex;
            dir = 'right';
        } else if(movedTabIndex < furthestPassedIndex) {
            leftIndex = movedTabIndex;
            rightIndex = furthestPassedIndex;
            dir = 'left';
        }

        rotateTabs(leftIndex, rightIndex, dir);
    }

    const listenersOn = () => {
        const offFns: (() => void)[] = [];
        offFns.push(Events.On('gel:shared-chat-begin', handleSharedChatBegin));
        offFns.push(Events.On('gel:shared-chat-update', handleSharedChatUpdate));
        offFns.push(Events.On('gel:shared-chat-end', handleSharedChatEnd));
    }

    useEffect(() => {
        navigate(curTab.tabRoute);
    }, [curTab])

    useEffect(() => {
        return listenersOn();
    }, []);

    return (
        <div className={`sticky flex max-w-full items-center w-full gap-1 border-b p-1 border-chatter-border-strong bg-chatter-surface`}
            style={{
                height: `${TAB_MANAGER_HEIGHT}px`,
                top: `${WINDOW_CONTROLS_HEIGHT}px`,
            }}
        >
            <div className={`shrink-0 flex items-center justify-center w-7 h-7 border rounded-sm p-1 [&_svg]:fill-chatter-text-primary hover:bg-chatter-surface-elevated hover:border-chatter-border-strong ${curTab.tabRoute === home.tabRoute ? 'bg-chatter-accent/15 border-chatter-accent' : 'border-chatter-border'} cursor-pointer`}
                onClick={() => handleTabSelect(home)}
                data-selected={curTab.tabRoute === home.tabRoute ? 'true' : 'false'}
            >
                <GelIcon className="size-full" />
            </div>
            <div className={`shrink-0 flex items-center justify-center w-7 h-7 border rounded-sm p-1.5 [&_svg]:fill-chatter-text-primary hover:bg-chatter-surface-elevated hover:border-chatter-border-strong  ${curTab.tabRoute === searchTab.tabRoute ? 'bg-chatter-accent/15 border-chatter-accent' : 'border-chatter-border'} cursor-pointer`}
                onClick={() => handleTabSelect(searchTab)}
                data-selected={curTab.tabRoute === searchTab.tabRoute ? 'true' : 'false'}
            >
                <SearchIcon className="size-full" />
            </div>
            {tabs.slice(FIXED_TAB_COUNT).map((tab, i) =>
            <Tab
                tab={tab}
                key={tab.tabRoute}
                ref={tabsRef.current[tab.tabRoute] ??= { current: null }}
                selected={tab.tabRoute === curTab.tabRoute}
                onTabSelect={handleTabSelect}
                onTabRemove={handleTabRemove}
                onTabPlace={() => handleTabPlace(i+FIXED_TAB_COUNT)}
            />
                     )}
            <div className={(isAddingTab ? '' : ' hidden') + ' flex justify-start items-center border border-chatter-accent rounded-sm text-sm p-1 h-7 bg-chatter-surface max-w-50 basis-25'}
            >
                <input
                    className="max-w-50 min-w-25 h-full bg-transparent! border-none!"
                    type='text'
                    ref={(node: HTMLInputElement|null) => {node && node.focus()}}
                    onKeyDown={handleAddTabKeyDown}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTabText(e.currentTarget.value)}
                    onBlur={() => setIsAddingTab(false)}
                />
            </div>
            <div
                className={'shrink-0 flex justify-center items-center w-7 h-7 p-2 [&_svg]:fill-chatter-text-primary hover:[&_svg]:fill-chatter-text-secondary hover:[&_svg]:brightness-90 cursor-pointer' + (isAddingTab ? ' hidden' : '')}
                onClick={() => setIsAddingTab(true)}
            >
                <PlusIcon className="size-full" />
            </div>
        </div>
    )
}
