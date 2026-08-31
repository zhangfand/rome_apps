import type { JsSource } from '@rspack/binding';
import { type Source } from '../../compiled/webpack-sources/types.js';
export declare class SourceAdapter {
    static fromBinding(source: JsSource): Source;
    static toBinding(source: Source): JsSource;
}
