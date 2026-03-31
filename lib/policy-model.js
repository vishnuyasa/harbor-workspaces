import {HOME_WORKSPACE_INDEX} from './constants.js';

export function getCompactedWorkspaceCount(
    occupiedSecondaryCount,
    homeWorkspaceIndex = HOME_WORKSPACE_INDEX
) {
    return Math.max(homeWorkspaceIndex + 2, homeWorkspaceIndex + occupiedSecondaryCount + 2);
}

export function getEmptySecondaryFallbackIndex(
    activeIndex,
    homeWorkspaceIndex = HOME_WORKSPACE_INDEX
) {
    return Math.max(homeWorkspaceIndex, activeIndex - 1);
}

export function shouldRedirectFromEmptySecondary(
    activeIndex,
    homeWorkspaceIndex = HOME_WORKSPACE_INDEX
) {
    return activeIndex > homeWorkspaceIndex;
}
