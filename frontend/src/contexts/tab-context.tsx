import { createContext, useContext, useMemo, useState } from "react";
import { GlobalContext } from "./global-context";
import { DisconnectFromChatroom } from "@wailsjs/chatter-wails/appservice";
import { rotateArr } from "@/util/arr";

export type TTab = {
    readonly tabRoute: string;
    readonly tabName: string;
    removable: boolean;
}

interface ITabState {
    tabs: TTab[];
    curTab: {
        tab: TTab;
        index: number;
    }
}

export const createTabRoute = (channel: string): string => {
    return `/chatroom/${channel.toLowerCase()}`;
}

export const createTab = (channel: string): TTab => {
    return {
        tabName: channel,
        tabRoute: createTabRoute(channel),
        removable: true,
    };
}

interface ITabContext {
    homeTab: TTab;
    searchTab: TTab;
    tabs: TTab[];
    curTab: TTab;
    addTab: (tab: TTab) => void;
    removeTab: (tab: TTab) => void;
    selectTab: (tab: TTab) => void;
    editTab: (index: number, changeFn: (tab: TTab) => TTab) => void;
    rotateTabs: (leftIndex: number, rightIndex: number, dir: 'left'|'right') => void;
    switchTabNext: (forward: boolean) => void;
}

const HOME_TAB: TTab = {
    tabRoute: '/',
    tabName: 'home',
    removable: false,
};

const SEARCH_TAB: TTab = {
    tabRoute: '/search',
    tabName: 'search',
    removable: false,
};

export const FIXED_TAB_COUNT = 2;

export const TabContext = createContext<ITabContext>({
    homeTab: HOME_TAB,
    searchTab: SEARCH_TAB,
    tabs: [],
    curTab: HOME_TAB,
    addTab(_tab) {},
    removeTab(_tab) {},
    selectTab(_tab) {},
    editTab(_index, _changeFn) {},
    rotateTabs(_leftIndex, _rightIndex, _dir) {},
    switchTabNext(_forward) {},
});

export function TabContextProvider({
    children
}: { children: React.ReactNode }) {

    const { broadcastError } = useContext(GlobalContext);

    const [tabState, setTabState] = useState<ITabState>({
        tabs: [HOME_TAB, SEARCH_TAB],
        curTab: {
            tab: HOME_TAB,
            index: 0,
        },
    });

    const removeTab = (tab: TTab) => {
        if(!tab.removable) return;
        setTabState(tabState => {
            const tabIndex = tabState.tabs.findIndex(t => t.tabRoute === tab.tabRoute);
            if(tabIndex === -1) return tabState;

            let newCurTab = tabState.curTab;
            if(tab.tabRoute === tabState.curTab.tab.tabRoute) {
                newCurTab = {
                    tab: HOME_TAB,
                    index: 0,
                };
            }

            DisconnectFromChatroom(tab.tabRoute.split('/chatroom/')[1]).catch(broadcastError);
            return {
                tabs: tabState.tabs.filter(t => t.tabRoute !== tab.tabRoute),
                curTab: newCurTab,
            };

        });
    }

    const addTab = (tab: TTab) => {
        setTabState(tabState => {
            if(!tabState.tabs.find(t => t.tabRoute === tab.tabRoute)) {
                return {
                    ...tabState,
                    tabs: [...tabState.tabs, tab],
                };
            }

            return tabState;
        });
    }

    const selectTab = (tab: TTab) => {
        setTabState(tabState => {
            const index = tabState.tabs.findIndex((t) => t.tabRoute === tab.tabRoute);
            if(index !== -1) {
                return {
                    tabs: [...tabState.tabs],
                    curTab: {
                        tab,
                        index,
                    }
                };
            }

            return tabState;
        });
    }

    const editTab = (index: number, changeFn: (tab: TTab) => TTab) => {
        setTabState(tabState => {
            if(index < 0 || index >= tabState.tabs.length) return tabState;
            const changed = changeFn(tabState.tabs[index]);
            const newTabs = [
                ...tabState.tabs.slice(0, index),
                changed,
                ...tabState.tabs.slice(index+1)
            ];
            return {
                ...tabState,
                tabs: newTabs,
            };
        });
    }

    const rotateTabs = (leftIndex: number, rightIndex: number, dir: 'left'|'right') => {
        if(leftIndex == rightIndex) return;

        setTabState(tabState => {
            const preRotateSegement = [...tabState.tabs.slice(leftIndex, rightIndex + 1)];
            const rotatedSegement = rotateArr(preRotateSegement, dir)
            let newCurTab = tabState.curTab;
            if(tabState.curTab.index >= leftIndex && tabState.curTab.index <= rightIndex) {
                const rotLen = rightIndex-leftIndex+1
                newCurTab = {
                    ...tabState.curTab,
                    index: dir == 'right'
                        ? ((tabState.curTab.index-leftIndex+1)%rotLen)+leftIndex
                        : ((tabState.curTab.index-leftIndex+rotLen-1)%rotLen)+leftIndex
                };
            }

            const newTabs = [
                ...tabState.tabs.slice(0, leftIndex),
                ...rotatedSegement,
                ...tabState.tabs.slice(rightIndex + 1)
            ];

            return {
                ...tabState,
                tabs: newTabs,
                curTab: newCurTab,
            };
        });
    }

    const switchTabNext = (forward: boolean) => {
        setTabState(tabState => {
            const nextIndex = forward
                ? (tabState.curTab.index+1)%tabState.tabs.length
                : (tabState.curTab.index+tabState.tabs.length-1)%tabState.tabs.length;

            const nextTab = tabState.tabs.at(nextIndex);
            if(!nextTab) return tabState;
            return {
                ...tabState,
                curTab: {
                    tab: nextTab,
                    index: nextIndex,
                }
            };
        });
    }

    const ctxValue = useMemo<ITabContext>(() => ({
        homeTab: HOME_TAB,
        searchTab: SEARCH_TAB,
        tabs: tabState.tabs,
        curTab: tabState.curTab.tab,
        addTab,
        removeTab,
        selectTab,
        editTab,
        rotateTabs,
        switchTabNext,
    }), [tabState.tabs, tabState.curTab.index, tabState.curTab.tab.tabRoute, tabState.curTab.tab.tabName])

    return (
        <TabContext.Provider value={ctxValue}>
            {children}
        </TabContext.Provider>
    )

}
