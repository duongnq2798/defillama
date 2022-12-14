import * as React from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import styled from 'styled-components'
import {
	Panel,
	BreakpointPanels,
	BreakpointPanel,
	PanelHiddenMobile,
	ChartAndValuesWrapper,
	DownloadButton,
	DownloadIcon
} from '~/components'
import Announcement from '~/components/Announcement'
import { ProtocolsTable } from '~/components/Table'
import { RowFixed } from '~/components/Row'
import { ProtocolsChainsSearch } from '~/components/Search'
import { RowLinksWithDropdown, TVLRange } from '~/components/Filters'
import SEO from '~/components/SEO'
import { OptionButton } from '~/components/ButtonStyled'
import LocalLoader from '~/components/LocalLoader'
import { useCalcProtocolsTvls } from '~/hooks/data'
import { useDarkModeManager, useDefiManager } from '~/contexts/LocalStorage'
import { formattedNum, getPercentChange, getPrevTvlFromChart, getTokenDominance } from '~/utils'
import { chainCoingeckoIds } from '~/constants/chainTokens'
import { useDenominationPriceHistory } from '~/api/categories/protocols/client'
import llamaLogo from '~/assets/peeking-llama.png'
import { ListHeader, ListOptions } from './shared'
import { ArrowUpRight } from 'react-feather'
import PieChart from '../ECharts/PieChart'
import { TableTVL } from '../Table/Defi/Protocols/TableTVL'
import { Button } from 'ariakit'

const EasterLlama = styled.button`
	padding: 0;
	width: 41px;
	height: 34px;
	position: absolute;
	bottom: -36px;
	left: 0;

	img {
		width: 41px !important;
		height: 34px !important;
	}
`

const Chart = dynamic(() => import('~/components/GlobalChart'), {
	ssr: false
})

const Game = dynamic(() => import('~/game'))

const BASIC_DENOMINATIONS = ['USD']

const setSelectedChain = (newSelectedChain) => (newSelectedChain === 'All' ? '/' : `/chain/${newSelectedChain}`)

function GlobalPage({
	selectedChain = 'All',
	chainsSet,
	filteredProtocols,
	chart,
	extraVolumesCharts = {},
	parentProtocols
}) {
	const [extraTvlsEnabled] = useDefiManager()

	const router = useRouter()

	const denomination = router.query?.currency ?? 'USD'

	const { minTvl, maxTvl } = router.query

	const [easterEgg, setEasterEgg] = React.useState(false)
	const [tvlData, setTVLData] = React.useState({})
	const [tvlCsvData, setTvlCsvData] = React.useState({})
	const [darkMode, toggleDarkMode] = useDarkModeManager()
	const activateEasterEgg = () => {
		if (easterEgg) {
			if (!darkMode) {
				toggleDarkMode()
			}
			window.location.reload()
		} else {
			if (darkMode) {
				toggleDarkMode()
			}
			setEasterEgg(true)
		}
	}

	// const initialTvl = chart[chart.length - 1][1]
	// const doublecounted = extraVolumesCharts['doublecounted'][extraVolumesCharts['doublecounted'].length - 1][1]
	// const liquidstaking = extraVolumesCharts['liquidstaking'][extraVolumesCharts['liquidstaking'].length - 1][1]
	// const overlap = extraVolumesCharts['dcAndLsOverlap'][extraVolumesCharts['dcAndLsOverlap'].length - 1][1]
	// console.log(['doublecounted', 'liquidstaking', 'total'])
	// console.log(['on', 'on', initialTvl])
	// console.log(['on', 'off', initialTvl - liquidstaking + overlap])
	// console.log(['off', 'on', initialTvl - doublecounted + overlap])
	// console.log(['off', 'off', initialTvl - doublecounted - liquidstaking + overlap])

	const { totalVolumeUSD, volumeChangeUSD, globalChart } = React.useMemo(() => {
		const globalChart = chart.map((data) => {
			let sum = data[1]
			Object.entries(extraVolumesCharts).forEach(([prop, propCharts]) => {
				const stakedData = propCharts.find((x) => x[0] === data[0])

				// find current date and only add values on that date in "data" above
				if (stakedData) {
					if (prop === 'doublecounted' && !extraTvlsEnabled['doublecounted']) {
						sum -= stakedData[1]
					}

					if (prop === 'liquidstaking' && !extraTvlsEnabled['liquidstaking']) {
						sum -= stakedData[1]
					}

					if (prop === 'dcAndLsOverlap') {
						if (!extraTvlsEnabled['doublecounted'] || !extraTvlsEnabled['liquidstaking']) {
							sum += stakedData[1]
						}
					}

					if (extraTvlsEnabled[prop.toLowerCase()] && prop !== 'doublecounted' && prop !== 'liquidstaking') {
						sum += stakedData[1]
					}
				}
			})
			return [data[0], sum]
		})

		const tvl = getPrevTvlFromChart(globalChart, 0)
		const tvlPrevDay = getPrevTvlFromChart(globalChart, 1)
		const volumeChangeUSD = getPercentChange(tvl, tvlPrevDay)

		return { totalVolumeUSD: tvl, volumeChangeUSD, globalChart }
	}, [chart, extraTvlsEnabled, extraVolumesCharts])

	let chainOptions = ['All'].concat(chainsSet).map((label) => ({ label, to: setSelectedChain(label) }))

	const protocolTotals = useCalcProtocolsTvls({ protocols: filteredProtocols, parentProtocols })

	const topToken = { name: 'Uniswap', tvl: 0 }
	if (protocolTotals.length > 0) {
		topToken.name = protocolTotals[0]?.name
		topToken.tvl = protocolTotals[0]?.tvl
		if (topToken.name === 'AnySwap') {
			topToken.name = protocolTotals[1]?.name
			topToken.tvl = protocolTotals[1]?.tvl
		}
	}

	const tvl = formattedNum(totalVolumeUSD, true)

	const percentChange = volumeChangeUSD?.toFixed(2)

	const volumeChange = (percentChange > 0 ? '+' : '') + percentChange + '%'

	const [DENOMINATIONS, chainGeckoId] = React.useMemo(() => {
		let DENOMINATIONS = []
		let chainGeckoId = null
		if (selectedChain !== 'All') {
			let chainDenomination = chainCoingeckoIds[selectedChain] ?? null

			chainGeckoId = chainDenomination?.geckoId ?? null

			if (chainGeckoId && chainDenomination.symbol) {
				DENOMINATIONS = [...BASIC_DENOMINATIONS, chainDenomination.symbol]
			}
		}
		return [DENOMINATIONS, chainGeckoId]
	}, [selectedChain])

	const { data: denominationPriceHistory, loading } = useDenominationPriceHistory(chainGeckoId)

	const [finalChartData, chainPriceInUSD] = React.useMemo(() => {
		if (denomination !== 'USD' && denominationPriceHistory && chainGeckoId) {
			let priceIndex = 0
			let prevPriceDate = 0
			const denominationPrices = denominationPriceHistory.prices
			const newChartData = []
			let priceInUSD = 1
			for (let i = 0; i < globalChart.length; i++) {
				const date = globalChart[i][0] * 1000
				while (
					priceIndex < denominationPrices.length &&
					Math.abs(date - prevPriceDate) > Math.abs(date - denominationPrices[priceIndex][0])
				) {
					prevPriceDate = denominationPrices[priceIndex][0]
					priceIndex++
				}
				priceInUSD = denominationPrices[priceIndex - 1][1]
				newChartData.push([globalChart[i][0], globalChart[i][1] / priceInUSD])
			}
			return [newChartData, priceInUSD]
		} else return [globalChart, 1]
	}, [chainGeckoId, globalChart, denominationPriceHistory, denomination])

	const updateRoute = (unit) => {
		router.push({
			query: {
				...router.query,
				currency: unit
			}
		})
	}

	const totalVolume = totalVolumeUSD / chainPriceInUSD

	const dominance = getTokenDominance(topToken, totalVolumeUSD)

	const isLoading = denomination !== 'USD' && loading

	const finalProtocolTotals = React.useMemo(() => {
		const isValidTvlRange =
			(minTvl !== undefined && !Number.isNaN(Number(minTvl))) || (maxTvl !== undefined && !Number.isNaN(Number(maxTvl)))

		const dataRS = isValidTvlRange
			? protocolTotals.filter((p) => (minTvl ? p.tvl > minTvl : true) && (maxTvl ? p.tvl < maxTvl : true))
			: protocolTotals

		const result = []
		dataRS.reduce((res, value) => {
			if (!res[value.category]) {
				res[value.category] = { category: value.category, tvl: 0, count: 0, change_1d: 0, change_7d: 0, change_1m: 0 }
				result.push(res[value.category])
			}
			res[value.category].tvl += Number(value.tvl)
			res[value.category].count += 1
			res[value.category].name = value.category
			res[value.category].change_1d += value.change_1d
			res[value.category].change_7d += value.change_7d
			res[value.category].change_1m += value.change_1m
			return res
		}, {})

		setTVLData(result)

		const csvString = [
			['Category', 'Change 1 day', 'Change 7 days', 'Change 1 month', 'TVL', 'Total Dapp'],
			...result.map((item) => [item.name, item.change_1d, item.change_7d, item.change_1m, item.tvl, item.count])
		]
			.map((e) => e.join(','))
			.join('\n')

		setTvlCsvData(csvString)

		return dataRS
	}, [minTvl, maxTvl, protocolTotals])

	const download = () => {
		var pom = document.createElement('a')
		var csvContent = tvlCsvData
		var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
		var url = URL.createObjectURL(blob)
		pom.href = url
		pom.setAttribute('download', 'group-tvl-by-category.csv')
		pom.click()
	}

	return (
		<>
			<SEO cardName={selectedChain} chain={selectedChain} tvl={tvl} volumeChange={volumeChange} />

			<Announcement>
				<span>We just launched a</span>{' '}
				<Link href={`/cexs`}>
					<a>
						{' '}
						CEX transparency dashboard <ArrowUpRight size={14} style={{ display: 'inline' }} />{' '}
					</a>
				</Link>
			</Announcement>

			<ProtocolsChainsSearch
				step={{
					category: 'Home',
					name: selectedChain === 'All' ? 'All Protocols' : selectedChain
				}}
			/>

			<button className="button-tvl" onClick={() => download()} href="#">
				Download .csv
			</button>

			<TableTVL data={tvlData} />
		</>
	)
}

export default GlobalPage
