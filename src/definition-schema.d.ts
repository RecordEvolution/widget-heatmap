/* eslint-disable */
/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run json-schema-to-typescript to regenerate this file.
 */

export type Title = string;
export type Subtitle = string;
export type XAxisLabel = string;
export type YAxisLabel = string;
/**
 * If checked, a legend will be shown in the chart.
 */
export type ShowLegend = boolean;
/**
 * The minimum value of the heatmap. Values below this will be colored with the first color in the heatmap colors.
 */
export type MinValue = number;
/**
 * The maximum value of the heatmap. Values above this will be colored with the last color in the heatmap colors.
 */
export type MaxValue = number;
/**
 * If checked, the heatmap will be drawn as a continuous gradient. Otherwise it will be drawn as discrete blocks.
 */
export type Continuous = boolean;
/**
 * If checked, the heatmap will show the values of the data points in the chart.
 */
export type ShowValues = boolean;
export type HeatColors = Color[];
/**
 * The name for this data series
 */
export type Label = string;
/**
 * The x value of the data point.
 */
export type XValue = string;
/**
 * The y value of the data point.
 */
export type YValue = string;
/**
 * The heat value of the data point. This is the value that will be used to determine the color of the heatmap.
 */
export type HeatValue = number;
/**
 * You can specify a column in the input data to autogenerate dataseries for each distinct entry in this column. E.g. if you have a table with columns [city, timestamp, temperature] and specify 'city' as split column, then you will get a line for each city.
 */
export type SplitDataBy = string;
/**
 * The data used to draw this data series.
 */
export type Data = {
    x?: XValue;
    y?: YValue;
    heat?: HeatValue;
    pivot?: SplitDataBy;
    [k: string]: unknown;
}[];
export type Dataseries = {
    label?: Label;
    data?: Data;
    [k: string]: unknown;
}[];

export interface InputData {
    title?: Title;
    subTitle?: Subtitle;
    axis?: AxisSettings;
    heatMap?: HeatSettings;
    dataseries?: Dataseries;
    [k: string]: unknown;
}
export interface AxisSettings {
    xAxisLabel?: XAxisLabel;
    yAxisLabel?: YAxisLabel;
    showLegend?: ShowLegend;
    [k: string]: unknown;
}
export interface HeatSettings {
    min?: MinValue;
    max?: MaxValue;
    continuous?: Continuous;
    showValues?: ShowValues;
    colors?: HeatColors;
    [k: string]: unknown;
}
/**
 * The color of the state in the chart.
 */
export interface Color {
    [k: string]: unknown;
}
