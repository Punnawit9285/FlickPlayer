import {seriesIndexOf} from './app/theme/theme-presets';

export function colorByFolderName(name: string) {
    const index = seriesIndexOf(name);
    return index < 0 ? 'var(--flick-series-fallback)' : `var(--flick-series-${index})`;
}
