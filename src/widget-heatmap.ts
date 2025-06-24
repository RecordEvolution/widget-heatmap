import { html, css, LitElement, PropertyValueMap } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'

import * as echarts from 'echarts/core'
import { TooltipComponent, GridComponent, VisualMapComponent, TitleComponent } from 'echarts/components'
import { HeatmapChart } from 'echarts/charts'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([
    TooltipComponent,
    GridComponent,
    VisualMapComponent,
    HeatmapChart,
    CanvasRenderer,
    TitleComponent
])

import { InputData } from './definition-schema'
import { EChartsOption, SeriesOption } from 'echarts'

type Theme = {
    theme_name: string
    theme_object: any
}
@customElement('widget-heatmap-versionplaceholder')
export class WidgetHeatmap extends LitElement {
    @property({ type: Object })
    inputData?: InputData

    @property({ type: Object })
    theme?: Theme

    @state()
    private canvasList: Map<
        string,
        { echart?: echarts.ECharts; series: SeriesOption[]; doomed?: boolean; element?: HTMLDivElement }
    > = new Map()

    @state() private themeBgColor?: string
    @state() private themeTitleColor?: string
    @state() private themeSubtitleColor?: string

    boxes?: HTMLDivElement[]
    origWidth: number = 0
    origHeight: number = 0
    template: EChartsOption
    modifier: number = 1
    version: string = 'versionplaceholder'
    chartContainer: HTMLDivElement | null | undefined
    resizeObserver?: ResizeObserver

    constructor() {
        super()

        this.template = {
            title: {
                text: 'Profile',
                left: '10%',
                top: 20
            },
            tooltip: {
                position: 'top'
            },
            grid: { top: 80 },
            xAxis: {
                type: 'category',
                data: [],
                splitArea: {
                    show: true
                }
            },
            yAxis: {
                type: 'category',
                data: [],
                splitArea: {
                    show: true
                }
            },
            visualMap: [
                {
                    type: 'continuous',
                    show: false,
                    min: 0,
                    max: 14,
                    calculable: true,
                    realtime: true,
                    orient: 'horizontal',
                    right: '9%',
                    top: 20,
                    inRange: { color: ['green', 'yellow', 'red'] }
                }
            ],
            series: [
                {
                    name: 'Punch Card',
                    type: 'heatmap',
                    data: [],
                    label: {
                        show: true
                    },
                    emphasis: {
                        itemStyle: {
                            shadowBlur: 10,
                            shadowColor: 'rgba(0, 0, 0, 0.5)'
                        }
                    }
                }
            ]
        } as EChartsOption
    }

    update(changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>): void {
        if (changedProperties.has('inputData') && this.chartContainer) {
            this.transformData()
            this.applyData()
        }

        if (changedProperties.has('theme')) {
            this.registerTheme(this.theme)
            this.deleteCharts()
            this.transformData()
            this.applyData()
        }
        super.update(changedProperties)
    }

    protected firstUpdated(_changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>): void {
        this.chartContainer = this.shadowRoot?.querySelector('.chart-container')
        this.transformData()
        this.applyData()
        this.registerTheme(this.theme)
        // Add ResizeObserver for chart container
        if (this.chartContainer) {
            console.log('Adding ResizeObserver to chart container', this.chartContainer)
            this.resizeObserver = new ResizeObserver(() => {
                this.canvasList.forEach((chart) => {
                    chart.echart?.resize()
                })
            })
            this.resizeObserver.observe(this.chartContainer)
        }
    }

    registerTheme(theme?: Theme) {
        const cssTextColor = getComputedStyle(this).getPropertyValue('--re-text-color').trim()
        const cssBgColor = getComputedStyle(this).getPropertyValue('--re-tile-background-color').trim()
        this.themeBgColor = cssBgColor || this.theme?.theme_object?.backgroundColor
        this.themeTitleColor = cssTextColor || this.theme?.theme_object?.title?.textStyle?.color
        this.themeSubtitleColor =
            cssTextColor || this.theme?.theme_object?.title?.subtextStyle?.color || this.themeTitleColor

        if (!theme || !theme.theme_object || !theme.theme_name) return

        echarts.registerTheme(theme.theme_name, theme.theme_object)
    }

    transformData() {
        if (!this?.inputData?.dataseries?.length) return

        // reset all existing chart dataseries
        this.canvasList.forEach((chartM) => {
            chartM.series = []
            chartM.doomed = true
        })
        this.inputData.dataseries.forEach((ds, l) => {
            ds.data ??= []

            // pivot data
            const distincts = [...new Set(ds.data.map((d) => d.pivot ?? ''))].sort()

            distincts.forEach((piv) => {
                const prefix = piv ?? ''
                const label = ds.label ?? ''
                const name = prefix + (!!prefix && !!label ? ' - ' : '') + label

                const data =
                    (distincts.length === 1 ? ds.data : ds.data?.filter((d) => d.pivot === piv)) ?? []

                let binWidth = 0
                let axisMax
                let data1
                if (this.xAxisType() === 'value') {
                    const xValues = data.map((d) => Number(d.x)).sort((a, b) => a - b) ?? []
                    binWidth =
                        Math.min(...xValues.map((x, i, arr) => (i > 0 ? x - arr[i - 1] : Infinity))) ?? 0
                    axisMax = Math.max(...xValues) + 1
                    const offset = binWidth / 2

                    data1 = data.map((d: any, j) => [Number(d.x) + 0.5, d.y, d.heat])
                } else {
                    data1 = data.map((d: any, j) => [d.x, d.y, d.heat])
                }
                // preparing the echarts series option for later application
                const pds: any = {
                    type: 'heatmap',
                    axisMax,
                    name: name,
                    label: {
                        show: this.inputData?.heatMap?.showValues ?? false
                    },
                    emphasis: {
                        itemStyle: {
                            borderColor: '#333',
                            borderWidth: 1
                        }
                    },
                    data: data1 ?? []
                }
                const chart = this.setupChart(name)
                chart?.series.push(pds)
            })
        })

        const doomedCharts: string[] = []
        // remove all doomed charts
        this.canvasList.forEach((chart, label) => {
            if (!chart.doomed) return
            chart.echart?.dispose()
            chart.element?.remove()
            doomedCharts.push(label)
        })

        doomedCharts.forEach((label) => this.canvasList.delete(label))
    }

    applyData() {
        const modifier = 1

        this.canvasList.forEach((chart, label) => {
            chart.series.sort((a, b) => ((a.name as string) > (b.name as string) ? 1 : -1))
            this.requestUpdate()

            const option: any = chart.echart?.getOption() ?? window.structuredClone(this.template)

            // Title
            option.title.text = label

            // Axis
            option.xAxis.name = this.inputData?.axis?.xAxisLabel ?? ''
            option.yAxis.name = this.inputData?.axis?.yAxisLabel ?? ''

            option.xAxis.type = this.xAxisType()
            option.yAxis.type = this.yAxisType()

            let allData
            if (option.xAxis.type === 'category') {
                allData = chart.series.flatMap((s: any) => s.data)
                const xCategories = [...new Set(allData.map((d: any) => d[0]))]
                option.xAxis.data = xCategories
            }
            if (option.yAxis.type === 'category') {
                allData ??= chart.series.flatMap((s: any) => s.data)
                const yCategories = [...new Set(allData.map((d: any) => d[1]))]
                option.yAxis.data = yCategories
            }

            if (option.xAxis.type === 'value') {
                option.xAxis.max = Math.max(...chart.series.map((s: any) => s.axisMax))
            }

            // VisualMap
            option.visualMap[0].show = this.inputData?.axis?.showLegend ?? true
            option.visualMap[0].min = this.inputData?.heatMap?.min ?? 0
            option.visualMap[0].max = this.inputData?.heatMap?.max ?? 14
            option.visualMap[0].type = this.inputData?.heatMap?.continuous ? 'continuous' : 'piecewise'
            option.visualMap[0].inRange.color = this.inputData?.heatMap?.colors?.map(
                (c, i) => c || this.theme?.theme_object?.visualMap?.color?.[i]
            )
            if (!option.visualMap[0].inRange.color?.length) {
                option.visualMap[0].inRange.color = this.theme?.theme_object?.visualMap?.color ?? [
                    '#bf444c',
                    '#d88273',
                    '#f6efa6'
                ]
            }

            // Series
            const notMerge = option.series?.length !== chart.series.length
            option.series = chart.series

            chart.echart?.setOption(option, { notMerge })
            chart.echart?.resize()
        })
    }

    xAxisType(): 'value' | 'log' | 'category' | 'time' | undefined {
        if (this.inputData?.axis?.timeseries) return 'time'
        const onePoint = this.inputData?.dataseries?.[0]?.data?.[0]
        if (!isNaN(Number(onePoint?.x))) return 'value'
        return 'category'
    }

    yAxisType(): 'value' | 'log' | 'category' | undefined {
        const onePoint = this.inputData?.dataseries?.[0]?.data?.[0]
        if (!isNaN(Number(onePoint?.y))) return 'value'
        return 'category'
    }

    deleteCharts() {
        this.canvasList.forEach((chart, label) => {
            chart.echart?.dispose()
            chart.element?.remove()
            this.canvasList.delete(label)
        })
    }

    setupChart(label: string) {
        const existingChart = this.canvasList.get(label)

        if (existingChart) {
            delete existingChart.doomed
            return existingChart
        }

        if (!this.chartContainer) {
            console.warn('Chart container not found')
            return
        }
        const newContainer = document.createElement('div')
        newContainer.setAttribute('name', label)
        newContainer.setAttribute('class', 'sizer')
        this.chartContainer.appendChild(newContainer)

        const newChart = echarts.init(newContainer, this.theme?.theme_name)
        const chart = { echart: newChart, series: [] as SeriesOption[], element: newContainer }
        this.canvasList.set(label, chart)

        return chart
    }

    disconnectedCallback() {
        if (this.resizeObserver && this.chartContainer) {
            this.resizeObserver.unobserve(this.chartContainer)
            this.resizeObserver.disconnect()
        }
        super.disconnectedCallback()
    }

    static styles = css`
        :host {
            display: block;
            font-family: sans-serif;
            box-sizing: border-box;
            position: relative;
            margin: auto;
        }

        .paging:not([active]) {
            display: none !important;
        }

        .wrapper {
            display: flex;
            flex-direction: column;
            height: 100%;
            width: 100%;
            padding: 16px;
            box-sizing: border-box;
            gap: 12px;
        }

        .sizer {
            flex: 1;
            overflow: hidden;
            position: relative;
        }

        .chart-container {
            display: flex;
            flex: 1;
            overflow: hidden;
            position: relative;
        }

        header {
            display: flex;
            flex-direction: column;
        }
        h3 {
            margin: 0;
            max-width: 300px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        p {
            margin: 10px 0 0 0;
            max-width: 300px;
            font-size: 14px;
            line-height: 17px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .chart {
            width: 600px; /* will be overriden by adjustSizes */
            height: 230px;
        }

        .columnLayout {
            flex-direction: column;
        }

        .no-data {
            font-size: 20px;
            display: flex;
            height: 100%;
            width: 100%;
            text-align: center;
            align-items: center;
            justify-content: center;
        }
    `

    render() {
        return html`
            <div
                class="wrapper"
                style="background-color: ${this.themeBgColor}; color: ${this.themeTitleColor}"
            >
                <header class="paging" ?active=${this.inputData?.title || this.inputData?.subTitle}>
                    <h3 class="paging" ?active=${this.inputData?.title}>${this.inputData?.title}</h3>
                    <p
                        class="paging"
                        ?active=${this.inputData?.subTitle}
                        style="color: ${this.themeSubtitleColor}"
                    >
                        ${this.inputData?.subTitle}
                    </p>
                </header>
                <div class="paging no-data" ?active=${this.canvasList.size === 0}>No Data</div>
                <div
                    class="chart-container ${this?.inputData?.axis?.columnLayout ? 'columnLayout' : ''}"
                ></div>
            </div>
        `
    }
}
