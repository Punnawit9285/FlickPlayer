import {SERIES_COUNT} from './app/theme/theme-presets';

/** Stable index for a name, so a folder always gets the same colour from the theme's series. */
function seriesIndex(name: string): number {
    let hash = 0;
    for (const character of name ?? '') {
        hash = (hash * 31 + character.charCodeAt(0)) % 1000003;
    }
    return hash % SERIES_COUNT;
}

export function colorByFolderName(name: string) {
    return `var(--flick-series-${seriesIndex(name)})`;
}
